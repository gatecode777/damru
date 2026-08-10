import { connectDB } from "@/lib/mongodb";
import { getDamruConfig } from "@/lib/getDamruConfig";
import Order, { IOrder } from "@/models/Order";
import DamruTransaction from "@/models/DamruTransaction";
import { notifyPaymentEvent } from "@/lib/notifications/paymentNotificationService";

/**
 * The authoritative payable amount for a given order, in rupees. `order.total`
 * only ever reflects the coupon discount (see app/api/orders/route.ts) — a
 * Damru redemption for the same order is a separate call (lib/rewardEngine.ts's
 * redeemDamru) that debits the wallet and returns a ₹ discount to the caller
 * WITHOUT writing it back onto the order. For COD that's fine (the existing,
 * unchanged behavior: full order.total collected, Damru shown as a recorded
 * rebate). For an actual gateway charge we cannot silently overcharge by that
 * same amount, so we net it out here — server-side, never trusting the client.
 */
export async function computePayableAmount(order: Pick<IOrder, "_id" | "total">): Promise<number> {
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
    await notifyPaymentEvent({
      userId: order.userId,
      type: "PAYMENT_SUCCESSFUL",
      sourceId: order._id,
      sourceType: "Order",
      orderNumber: order.orderId,
      route: "/my-profile?tab=orders",
    });
  }

  return { success: true, alreadyFinalized: false, order };
}

/** Marks a payment attempt failed. Never overwrites an already-paid order. */
export async function markRazorpayPaymentFailed(input: { orderId: string; razorpayOrderId: string }): Promise<void> {
  await connectDB();
  const order = await Order.findOneAndUpdate(
    { _id: input.orderId, razorpayOrderId: input.razorpayOrderId, paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "failed", paymentFailedAt: new Date() } },
    { new: true }
  );

  if (order?.userId) {
    await notifyPaymentEvent({
      userId: order.userId,
      type: "PAYMENT_FAILED",
      sourceId: order._id,
      sourceType: "Order",
      orderNumber: order.orderId,
      route: "/my-profile?tab=orders",
    });
  }
}
