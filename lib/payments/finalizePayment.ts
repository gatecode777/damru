import { connectDB } from "@/lib/mongodb";
import { getDamruConfig } from "@/lib/getDamruConfig";
import Order, { IOrder } from "@/models/Order";
import DamruTransaction from "@/models/DamruTransaction";
import { notifyPaymentEvent } from "@/lib/notifications/paymentNotificationService";
import { notifyOrderEvent } from "@/lib/notifications/orderNotificationService";

/**
 * Returns the backend-authoritative payable amount. New orders persist the
 * checkout engine's final amount; historical orders use the legacy redemption
 * lookup so existing payment records remain compatible.
 */
export async function computePayableAmount(order: Pick<IOrder, "_id" | "total" | "finalAmount" | "damruDiscount">): Promise<number> {
  // New orders snapshot the final payable after every configured charge and
  // Damru redemption. Historical orders predate those fields and retain the
  // transaction lookup below for backward compatibility.
  if (typeof order.finalAmount === "number") return Math.max(0, order.finalAmount);
  await connectDB();
  const redemption = await DamruTransaction.findOne({
    idempotencyKey: `redeem_order_${order._id}`,
    category: "redemption",
  }).select("amount").lean<{ amount: number }>();

  if (!redemption) return order.total;

  const { redemptionRate } = await getDamruConfig();
  const damruDiscount = Math.round(redemption.amount * redemptionRate);
  return Math.max(0, order.total - damruDiscount);
}

/**
 * Single source of truth for marking an order paid — called identically by
 * the client-verification route and the webhook handler (PRD: "prevents
 * client verification and webhook processing from behaving differently").
 * Idempotent via an atomic conditional update: if the order is already paid,
 * this matches zero documents and we report `alreadyFinalized` rather than
 * re-running any business effect.
 */
export async function finalizeRazorpayPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<{ success: true; alreadyFinalized: boolean; order?: IOrder } | { success: false; error: string }> {
  await connectDB();

  const existing = await Order.findById(input.orderId).select("razorpayOrderId paymentStatus").lean<{
    razorpayOrderId?: string;
    paymentStatus: string;
  }>();
  if (!existing) return { success: false, error: "Order not found." };
  if (existing.razorpayOrderId !== input.razorpayOrderId) {
    return { success: false, error: "Razorpay order mismatch." };
  }
  if (existing.paymentStatus === "paid") {
    return { success: true, alreadyFinalized: true };
  }

  const now = new Date();
  const order = await Order.findOneAndUpdate(
    { _id: input.orderId, razorpayOrderId: input.razorpayOrderId, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        status: "confirmed",
        razorpayPaymentId: input.razorpayPaymentId,
        paymentVerifiedAt: now,
        paidAt: now,
      },
    },
    { new: true }
  );

  // Lost a race against a concurrent finalize (webhook + client verify landing
  // together) — the other caller already marked it paid. Same outcome either way.
  if (!order) return { success: true, alreadyFinalized: true };

  if (order.userId) {
    await Promise.all([
      notifyPaymentEvent({
        userId: order.userId,
        type: "PAYMENT_SUCCESSFUL",
        sourceId: order._id,
        sourceType: "Order",
        orderNumber: order.orderId,
        route: "/my-profile?tab=orders",
      }),
      notifyOrderEvent({
        userId: order.userId,
        type: "ORDER_PLACED",
        sourceId: order._id,
        orderNumber: order.orderId,
        route: "/my-profile?tab=orders",
      }),
    ]);
  }

  return { success: true, alreadyFinalized: false, order };
}

/** Marks a payment attempt failed. Never overwrites an already-paid order. */
export async function markRazorpayPaymentFailed(input: { orderId: string; razorpayOrderId: string }): Promise<void> {
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: input.orderId, razorpayOrderId: input.razorpayOrderId, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "failed", status: "pending", paymentFailedAt: new Date() } },
    { new: true }
  );

  if (order?.userId) {
    await notifyPaymentEvent({
      userId: order.userId,
      type: "PAYMENT_FAILED",
      sourceId: order._id,
      sourceType: "Order",
      orderNumber: order.orderId,
      amount: order.paymentAmount ?? order.total,
      description: "No charge was confirmed. Tap retry to pay securely.",
      route: `/checkout?retryOrder=${order._id}`,
    });
  }
}
