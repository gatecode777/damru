import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import Cart from "@/models/Cart";
import Address from "@/models/Address";
import { notifyOrderEvent } from "@/lib/notifications/orderNotificationService";
import { notifyPaymentEvent } from "@/lib/notifications/paymentNotificationService";
import { checkDeliveryServiceability } from "@/lib/delivery/serviceability";
import { calculateOrderTotals, CheckoutPricingError, getCheckoutChargesConfig } from "@/lib/checkout/checkoutCharges";
import { priceCoupon } from "@/lib/checkout/couponPricing";
import { resolveOrderItems } from "@/lib/checkout/resolveOrderItems";
import { redeemDamru } from "@/lib/rewardEngine";

function generateOrderId(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DMR-${dateStr}-${rand}`;
}

// ── GET /api/orders — user's order history ───────────────────
export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ orders: [] }, { status: 401 });

  try {
    await connectDB();
    const orders = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ orders: JSON.parse(JSON.stringify(orders)) });
  } catch (err) {
    console.error("GET orders error:", err);
    return NextResponse.json({ orders: [] }, { status: 500 });
  }
}

// ── POST /api/orders — place a new order ─────────────────────
// Body: { addressId?, paymentMethod, couponCode?, notes?, tableToken?, items? }
export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  let reservedCouponCode = "";
  let orderPersisted = false;

  try {
    const { addressId, paymentMethod, couponCode, notes = "", tableToken, items: bodyItems, requestedDamru = 0 } = await req.json();
    if (!paymentMethod) {
      return NextResponse.json({ error: "Select Cash on Delivery or Pay Online before placing your order." }, { status: 400 });
    }
    if (!(["cod", "razorpay"] as const).includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }

    // Check if we are doing a dine-in table order
    let isDineIn = false;
    let tableId: string | undefined;
    let tableNumber: string | undefined;

    if (tableToken) {
      const { verifyTableToken } = await import("@/lib/tableAuth");
      const validatedTable = await verifyTableToken(tableToken);
      if (!validatedTable) {
        return NextResponse.json({ error: "Invalid or expired table session. Please re-scan the table QR code." }, { status: 400 });
      }
      isDineIn = true;
      tableId = validatedTable.tableId;
      tableNumber = validatedTable.tableNumber;
    }

    if (!user && !isDineIn) {
      return NextResponse.json({ error: "Login required to place an order." }, { status: 401 });
    }

    if (!user && paymentMethod === "razorpay") {
      return NextResponse.json({ error: "Login is required for online payment. Please log in or select pay at counter." }, { status: 401 });
    }

    if (!isDineIn && !addressId) {
      return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
    }

    await connectDB();

    // ── Fetch cart/items and delivery address in parallel — neither depends on the other ──
    const [cart, address] = await Promise.all([
      user ? Cart.findOne({ userId: user.id }) : Promise.resolve(null),
      (!isDineIn && addressId) ? Address.findOne({ _id: addressId, userId: user?.id }) : Promise.resolve(null),
    ]);

    let rawOrderItems: Parameters<typeof resolveOrderItems>[0] = [];
    if (user) {
      if (!cart || cart.items.length === 0) {
        return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
      }
      rawOrderItems = cart.items;
    } else {
      // Guest ordering at a table
      if (!bodyItems || bodyItems.length === 0) {
        return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
      }
      rawOrderItems = bodyItems;
    }
    const orderItems = await resolveOrderItems(rawOrderItems);

    if (!isDineIn && addressId && !address) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    const chargesConfig = await getCheckoutChargesConfig();
    let delivery: Awaited<ReturnType<typeof checkDeliveryServiceability>> | null = null;
    if (!isDineIn && address) {
      const serviceRadius = chargesConfig.delivery.maximumDistanceKm ?? 100;
      delivery = await checkDeliveryServiceability(address, serviceRadius);
      if (!delivery.serviceable) {
        const error = delivery.reason === "OUT_OF_RANGE"
          ? `This address is ${delivery.nearestDistanceKm} km from our nearest branch. We currently deliver within ${serviceRadius} km.`
          : delivery.reason === "ADDRESS_NOT_FOUND"
            ? "We could not verify this delivery address. Please check the address and pincode, then try again."
            : "Delivery is unavailable because no active restaurant branch could be verified.";
        return NextResponse.json({ error, code: "ADDRESS_NOT_SERVICEABLE" }, { status: 422 });
      }
    }

    // Resolve all prices from active MenuItem records. Client/cart prices are display data only.
    const subtotal = orderItems.reduce((sum: number, i: { price: number; qty: number }) => sum + i.price * i.qty, 0);
    const coupon = await priceCoupon({ code: couponCode, subtotal, userId: user?.id, reserve: Boolean(couponCode) });
    if (coupon.reserved) reservedCouponCode = coupon.code;
    const subtotalAfterDiscount = Math.max(0, subtotal - coupon.discount);
    // Rewards policy: merchandise subtotal after coupon, before tax/shipping/Damru redemption.
    const eligibleRewardAmount = subtotalAfterDiscount;
    const totals = calculateOrderTotals(chargesConfig, {
      subtotal,
      couponDiscount: coupon.discount,
      orderType: isDineIn ? "dine_in" : "delivery",
      branchId: delivery?.serviceable ? String(delivery.branchId) : undefined,
      distanceKm: delivery?.serviceable ? delivery.distanceKm : undefined,
    });

    // ── Create order ──────────────────────────────────────────
    let orderId = generateOrderId();
    // Ensure unique orderId
    while (await Order.findOne({ orderId })) { orderId = generateOrderId(); }

    const orderData: Record<string, unknown> = {
      orderId,
      userId:    user ? user.id : undefined,
      userName:  user ? user.name : `Guest (Table ${tableNumber})`,
      userEmail: user ? user.email : undefined,
      items: orderItems.map(i => ({
        menuItemId:  i.menuItemId,
        categoryId:  i.categoryId,
        name:        i.name,
        image:       i.image,
        variantType: i.variantType,
        custom:      i.custom,
        price:       i.price,
        qty:         i.qty,
      })),
      subtotal,
      discount: totals.couponDiscount,
      couponDiscount: totals.couponDiscount,
      couponCode: coupon.code,
      eligibleRewardAmount,
      tax: totals.taxAmount,
      taxAmount: totals.taxAmount,
      shipping: totals.deliveryFee,
      deliveryFee: totals.deliveryFee,
      damruDiscount: 0,
      finalAmount: totals.finalAmount,
      total: totals.finalAmount,
      chargesSnapshot: {
        configId: totals.configId,
        configVersion: totals.configVersion,
        currency: totals.currency,
        taxName: totals.taxName,
        taxRate: totals.taxRate,
        taxCalculationType: totals.taxCalculationType,
        taxApplyOn: totals.taxApplyOn,
        taxDeliveryFee: totals.taxDeliveryFee,
        deliveryMode: totals.deliveryMode,
        appliedDeliveryRule: totals.appliedDeliveryRule,
        freeDeliveryApplied: totals.freeDeliveryApplied,
      },
      paymentMethod,
      paymentStatus: "pending",
      status:        paymentMethod === "cod" ? "confirmed" : "pending",
      notes,
    };

    if (isDineIn) {
      orderData.tableId = tableId;
      orderData.tableNumber = tableNumber;
    } else if (address) {
      if (delivery?.serviceable) {
        orderData.branchId = delivery.branchId;
        orderData.deliveryDistanceKm = delivery.distanceKm;
      }
      orderData.deliveryAddress = {
        label:    address.label,
        fullName: address.fullName,
        phone:    address.phone,
        house:    address.house,
        area:     address.area,
        city:     address.city,
        state:    address.state,
        pincode:  address.pincode,
      };
    }

    let order = await Order.create(orderData);
    orderPersisted = true;
    let redemption: { success: boolean; discount?: number; error?: string; amount?: number } | undefined;
    const damruAmount = Number(requestedDamru);
    if (user && Number.isFinite(damruAmount) && damruAmount > 0) {
      const result = await redeemDamru(user.id, damruAmount, order._id);
      if (result.success) {
        const finalTotals = calculateOrderTotals(chargesConfig, {
          subtotal,
          couponDiscount: coupon.discount,
          damruDiscount: result.discount,
          orderType: isDineIn ? "dine_in" : "delivery",
          branchId: delivery?.serviceable ? String(delivery.branchId) : undefined,
          distanceKm: delivery?.serviceable ? delivery.distanceKm : undefined,
        });
        order = (await Order.findByIdAndUpdate(order._id, {
          $set: { damruDiscount: finalTotals.damruDiscount, finalAmount: finalTotals.finalAmount, total: finalTotals.finalAmount },
        }, { new: true }))!;
        redemption = { success: true, discount: finalTotals.damruDiscount, amount: damruAmount };
      } else {
        redemption = { success: false, error: result.error };
      }
    }

    // Post-creation side effects are independent of each other — run concurrently.
    await Promise.all([
      isDineIn && tableId && paymentMethod === "cod"
        ? import("@/models/Table").then(({ default: Table }) => Table.findByIdAndUpdate(tableId, { status: "occupied" }))
        : Promise.resolve(),
      user
        ? Cart.findOneAndUpdate({ userId: user.id }, { items: [] })
        : Promise.resolve(),
    ]);

    if (user) {
      if (paymentMethod === "cod") {
        await notifyOrderEvent({ userId: user.id, type: "ORDER_PLACED", sourceId: order._id, orderNumber: order.orderId, route: "/my-profile?tab=orders" });
        await notifyPaymentEvent({ userId: user.id, type: "COD_CONFIRMED", sourceId: order._id, sourceType: "Order", orderNumber: order.orderId, route: "/my-profile?tab=orders" });
      }
    }

    return NextResponse.json({
      success: true,
      order: JSON.parse(JSON.stringify(order)),
      redemption,
    });

  } catch (err) {
    if (reservedCouponCode && !orderPersisted) {
      const { releaseCouponUsage } = await import("@/lib/payments/refunds");
      await releaseCouponUsage(reservedCouponCode).catch((releaseError) => {
        console.error("Coupon reservation rollback failed:", releaseError);
      });
    }
    console.error("POST orders error:", err);
    if (err instanceof CheckoutPricingError) return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    if (err instanceof Error && /coupon|minimum order|cart|item|option|customisation/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to place order. Please try again." }, { status: 500 });
  }
}
