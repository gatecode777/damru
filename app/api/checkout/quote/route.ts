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

export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  try {
    const body = await req.json();
    const isDineIn = Boolean(body.tableToken);
    if (!user && !isDineIn) return NextResponse.json({ error: "Login required." }, { status: 401 });
    await connectDB();
    const [cart, config] = await Promise.all([
      user ? Cart.findOne({ userId: user.id }).lean() : Promise.resolve(null),
      getCheckoutChargesConfig(),
    ]);
    const items = await resolveOrderItems(user ? cart?.items || [] : Array.isArray(body.items) ? body.items : []);
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

    const requestedDamru = Number(body.requestedDamru || 0);
    const damruPromise = (async () => {
      if (requestedDamru <= 0) return 0;
      if (!user) return NextResponse.json({ error: "Login is required to redeem Damru." }, { status: 401 });
      const [account, rewardConfig] = await Promise.all([
        User.findById(user.id).select("damruBalance").lean<{ damruBalance: number }>(),
        getDamruConfig(),
      ]);
      if (!Number.isFinite(requestedDamru) || requestedDamru < rewardConfig.minRedemption || requestedDamru > rewardConfig.maxRedemptionPerOrder || requestedDamru > (account?.damruBalance || 0)) {
        throw new Error("The requested Damru amount is not eligible for redemption.");
      }
      return Math.round(requestedDamru * rewardConfig.redemptionRate);
    })();

    const [coupon, deliveryResult, damruResult] = await Promise.all([couponPromise, deliveryPromise, damruPromise]);
    if (damruResult instanceof NextResponse) return damruResult;
    const damruDiscount = damruResult;
    const { branchId, distanceKm, deliveryError } = deliveryResult;

    if (deliveryError) {
      const partialTotals = calculateOrderTotals({
        ...config,
        delivery: { ...config.delivery, enabled: false },
      }, {
        subtotal,
        couponDiscount: coupon.discount,
        damruDiscount,
        orderType: "delivery",
      });
      return NextResponse.json({ error: deliveryError, partialTotals }, { status: 422 });
    }

    const totals = calculateOrderTotals(config, {
      subtotal,
      couponDiscount: coupon.discount,
      damruDiscount,
      orderType: isDineIn ? "dine_in" : "delivery",
      branchId,
      distanceKm,
    });
    return NextResponse.json({ totals, couponCode: coupon.code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate checkout totals." }, { status: 400 });
  }
}
