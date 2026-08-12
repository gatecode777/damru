import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import { notifyOrderEvent } from "@/lib/notifications/orderNotificationService";
import Order from "@/models/Order";
import { reverseOrderRewards } from "@/lib/rewards/reversalEngine";
import { evaluateOrderRisk, evaluateRiskSafely } from "@/lib/rewards/riskEngine";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const { message } = await req.json();
    const reason = typeof message === "string" ? message.trim() : "";
    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ error: "Please enter a cancellation message between 5 and 500 characters." }, { status: 400 });
    }

    await connectDB();
    const current = await Order.findOne({ _id: id, userId: user.id });
    if (!current) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (current.status === "cancelled") {
      await reverseOrderRewards({ orderId: current._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${current._id}` });
      if (current.userId) await evaluateRiskSafely("order-cancelled", () => evaluateOrderRisk({ userId: current.userId!, orderId: current._id }));
      return NextResponse.json({ success: true, order: current });
    }
    if (!["pending", "confirmed"].includes(current.status)) {
      return NextResponse.json({ error: "This order can no longer be cancelled because preparation has started." }, { status: 409 });
    }
    if (current.paymentMethod !== "cod" && current.paymentStatus === "paid") {
      return NextResponse.json({ error: "This paid order needs a refund. Please contact support so the payment can be refunded safely." }, { status: 409 });
    }

    const order = await Order.findOneAndUpdate(
      { _id: id, userId: user.id, status: { $in: ["pending", "confirmed"] } },
      { $set: { status: "cancelled", cancelledBy: "customer", cancellationReason: reason, cancelledAt: new Date() } },
      { new: true }
    );
    if (!order) return NextResponse.json({ error: "The order status changed. Refresh and try again." }, { status: 409 });

    await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
    if (order.userId) await evaluateRiskSafely("order-cancelled", () => evaluateOrderRisk({ userId: order.userId!, orderId: order._id }));

    if (order.couponCode) {
      const { releaseCouponUsage } = await import("@/lib/payments/refunds");
      await releaseCouponUsage(order.couponCode);
    }
    const { restoreDamruForOrder } = await import("@/lib/payments/refunds");
    await restoreDamruForOrder(order._id, order.userId, `cancel_${order._id}`);
    await notifyOrderEvent({
      userId: order.userId!,
      type: "ORDER_CANCELLED",
      sourceId: order._id,
      orderNumber: order.orderId,
      description: reason,
      route: "/my-profile?tab=orders",
    });

    return NextResponse.json({ success: true, order: JSON.parse(JSON.stringify(order)) });
  } catch (error) {
    console.error("POST customer order cancellation error:", error);
    return NextResponse.json({ error: "Unable to cancel the order. Please try again." }, { status: 500 });
  }
}
