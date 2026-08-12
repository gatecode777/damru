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
    const cart = user ? await Cart.findOne({ userId: user.id }).lean() : null;
    const items = await resolveOrderItems(user ? cart?.items || [] : Array.isArray(body.items) ? body.items : []);
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const coupon = await priceCoupon({ code: body.couponCode, subtotal, userId: user?.id });

    const config = await getCheckoutChargesConfig();
    let branchId: string | undefined;
    let distanceKm: number | undefined;
    let deliveryError = "";
    if (!isDineIn) {
      if (!body.addressId) {
        if (!body.estimateWithoutAddress) {
          return NextResponse.json({ error: "Select a valid delivery address." }, { status: 400 });
        }
        if (config.delivery.enabled && config.delivery.mode === "DISTANCE") {
          return NextResponse.json({ error: "Select an address to calculate distance-based delivery.", requiresAddress: true }, { status: 409 });
        }
      } else {
        const address = await Address.findOne({ _id: body.addressId, userId: user?.id });
        if (!address) return NextResponse.json({ error: "Select a valid delivery address." }, { status: 400 });
        const delivery = await checkDeliveryServiceability(address, config.delivery.maximumDistanceKm ?? 100);
        if (!delivery.serviceable) {
          deliveryError = delivery.reason === "OUT_OF_RANGE"
            ? `This address is ${delivery.nearestDistanceKm} km from the nearest Damru branch. Delivery is available within ${config.delivery.maximumDistanceKm ?? 100} km.`
            : delivery.reason === "ADDRESS_NOT_FOUND"
              ? "We could not locate this address. Please add a clearer area, landmark, and valid pincode."
              : "No active Damru branch with a verifiable location is currently available.";
        } else {
          branchId = String(delivery.branchId);
          distanceKm = delivery.distanceKm;
        }
      }
    }

    let damruDiscount = 0;
    const requestedDamru = Number(body.requestedDamru || 0);
    if (requestedDamru > 0) {
      if (!user) return NextResponse.json({ error: "Login is required to redeem Damru." }, { status: 401 });
      const [account, rewardConfig] = await Promise.all([
        User.findById(user.id).select("damruBalance").lean<{ damruBalance: number }>(),
        getDamruConfig(),
      ]);
      if (!Number.isFinite(requestedDamru) || requestedDamru < rewardConfig.minRedemption || requestedDamru > rewardConfig.maxRedemptionPerOrder || requestedDamru > (account?.damruBalance || 0)) {
        return NextResponse.json({ error: "The requested Damru amount is not eligible for redemption." }, { status: 400 });
      }
      damruDiscount = Math.round(requestedDamru * rewardConfig.redemptionRate);
    }

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
