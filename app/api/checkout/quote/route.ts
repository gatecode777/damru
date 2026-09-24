import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import { calculateOrderTotals, getCheckoutChargesConfig } from "@/lib/checkout/checkoutCharges";
import { priceCoupon } from "@/lib/checkout/couponPricing";
import { checkDeliveryServiceability } from "@/lib/delivery/serviceability";
import { getDamruConfig } from "@/lib/getDamruConfig";
import Cart from "@/models/Cart";
import Address from "@/models/Address";
import User from "@/models/User";
import { resolveOrderItems } from "@/lib/checkout/resolveOrderItems";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { damruToPaise, maxDamruForPaise, parseWholeDamru } from "@/lib/rewards/damruValue";
import { fromPaise, toPaise } from "@/lib/checkout/money";
import { estimateOrderDamru } from "@/lib/rewards/orderEarnings";

export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  try {
    const body = await req.json();
    const isDineIn = Boolean(body.tableToken);
    if (!user && !isDineIn) return NextResponse.json({ error: "Login required." }, { status: 401 });
    const requestedDamru = parseWholeDamru(body.requestedDamru);
    if (requestedDamru === null) return NextResponse.json({ error: "Damru must be redeemed in whole numbers." }, { status: 400 });
    await connectDB();
    const [cart, config] = await Promise.all([
      user ? Cart.findOne({ userId: user.id }).lean() : Promise.resolve(null),
      getCheckoutChargesConfig(),
    ]);
    const items = await resolveOrderItems(user ? cart?.items || [] : Array.isArray(body.items) ? body.items : []);
    if (items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const couponPromise = priceCoupon({ code: body.couponCode, subtotal, userId: user?.id });

    let deliveryPromise: Promise<{ branchId?: string; distanceKm?: number; deliveryError: string }> =
      Promise.resolve({ deliveryError: "" });
    if (!isDineIn) {
      if (!body.addressId) {
        if (!body.estimateWithoutAddress) {
          return NextResponse.json({ error: "Select a valid delivery address." }, { status: 400 });
        }
        if (config.delivery.enabled && config.delivery.mode === "DISTANCE") {
          return NextResponse.json({ error: "Select an address to calculate distance-based delivery.", requiresAddress: true }, { status: 409 });
        }
      } else {
        deliveryPromise = (async () => {
          const address = await Address.findOne({ _id: body.addressId, userId: user?.id });
          if (!address) throw new Error("Select a valid delivery address.");
          const delivery = await checkDeliveryServiceability(address, config.delivery.maximumDistanceKm ?? 100);
          if (!delivery.serviceable) {
            const deliveryError = delivery.reason === "OUT_OF_RANGE"
              ? `This address is ${delivery.nearestDistanceKm} km from the nearest Damru branch. Delivery is available within ${config.delivery.maximumDistanceKm ?? 100} km.`
              : delivery.reason === "ADDRESS_NOT_FOUND"
                ? "We could not locate this address. Please add a clearer area, landmark, and valid pincode."
                : "No active Damru branch with a verifiable location is currently available.";
            return { deliveryError };
          }
          return { branchId: String(delivery.branchId), distanceKm: delivery.distanceKm, deliveryError: "" };
        })();
      }
    }

    // Validate the redemption request itself (limits and balance). How much of
    // it the order can absorb is decided below, once the payable is known.
    const damruPromise = (async () => {
      const rewardConfig = await getDamruConfig();
      if (requestedDamru <= 0) return { rewardConfig };
      if (!user) return NextResponse.json({ error: "Login is required to redeem Damru." }, { status: 401 });
      const account = await User.findById(user.id).select("damruBalance").lean<{ damruBalance: number }>();
      if (requestedDamru < rewardConfig.minRedemption) throw new Error(`Minimum redemption is ${rewardConfig.minRedemption} Damru.`);
      if (requestedDamru > rewardConfig.maxRedemptionPerOrder) throw new Error(`Maximum redemption per order is ${rewardConfig.maxRedemptionPerOrder} Damru.`);
      if (requestedDamru > (account?.damruBalance || 0)) throw new Error("You don't have enough Damru for this redemption.");
      return { rewardConfig };
    })();

    const [coupon, deliveryResult, damruResult] = await Promise.all([couponPromise, deliveryPromise, damruPromise]);
    if (damruResult instanceof NextResponse) return damruResult;
    const { rewardConfig } = damruResult;
    const { branchId, distanceKm, deliveryError } = deliveryResult;

    const estimatePromise = estimateOrderDamru({
      userId: user?.id ?? null,
      items: items.map(item => ({ menuItemId: String(item.menuItemId), categoryId: String(item.categoryId), name: item.name, qty: item.qty })),
      eligibleAmount: Math.max(0, subtotal - coupon.discount),
      branchId: branchId ?? null,
    }).catch(err => {
      console.error("Damru estimate failed:", err);
      return null;
    });

    const deliveryConfig = deliveryError ? { ...config, delivery: { ...config.delivery, enabled: false } } : config;
    const totalsInput = {
      subtotal,
      couponDiscount: coupon.discount,
      orderType: (isDineIn ? "dine_in" : "delivery") as "dine_in" | "delivery",
      branchId,
      distanceKm,
    };

    // Cap the redemption at what the payable can absorb — the same rule the
    // order route enforces — so the customer is never charged Damru for a
    // discount they don't receive.
    const payableBeforeDamru = calculateOrderTotals(deliveryConfig, totalsInput).finalAmount;
    const maxRedeemable = Math.min(rewardConfig.maxRedemptionPerOrder, maxDamruForPaise(toPaise(payableBeforeDamru), rewardConfig.paisePerDamru));
    let appliedDamru = Math.min(requestedDamru, maxRedeemable);
    let redemptionMessage = "";
    if (requestedDamru > 0 && appliedDamru < rewardConfig.minRedemption) {
      appliedDamru = 0;
      redemptionMessage = `This order is too small to redeem the minimum of ${rewardConfig.minRedemption} Damru.`;
    } else if (appliedDamru < requestedDamru) {
      redemptionMessage = `Only ${appliedDamru} Damru can be applied to this order's payable amount.`;
    }
    const damruDiscount = fromPaise(damruToPaise(appliedDamru, rewardConfig.paisePerDamru));
    const damruRedemption = {
      requested: requestedDamru,
      applied: appliedDamru,
      capped: appliedDamru < requestedDamru,
      maxRedeemable,
      discount: damruDiscount,
      paisePerDamru: rewardConfig.paisePerDamru,
      message: redemptionMessage,
    };

    const estimate = await estimatePromise;
    const earn = { estimatedDamru: estimate?.estimatedDamru ?? 0, damruEstimate: estimate };

    if (deliveryError) {
      const partialTotals = calculateOrderTotals(deliveryConfig, { ...totalsInput, damruDiscount });
      return NextResponse.json({ error: deliveryError, partialTotals, damruRedemption, ...earn }, { status: 422 });
    }

    const totals = calculateOrderTotals(config, { ...totalsInput, damruDiscount });
    return NextResponse.json({
      totals,
      couponCode: coupon.code,
      damruRedemption,
      ...earn,
      paymentAvailability: { razorpay: isRazorpayConfigured() },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate checkout totals." }, { status: 400 });
  }
}
