import { connectDB } from "@/lib/mongodb";
import Order, { IOrder } from "@/models/Order";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { finalizeRazorpayPayment, markRazorpayPaymentFailed } from "@/lib/payments/finalizePayment";

/**
 * How long a Razorpay order can sit "pending" before it's eligible for
 * background reconciliation. Centralized here (matching how RATE_LIMITS
 * centralizes its own timing constants) rather than scattered through the
 * codebase — this project has no numeric-config-via-env-var precedent to
 * follow instead (site settings like tax/delivery live in the database, not
 * env vars).
 */
export const PAYMENT_RECONCILE_AFTER_MINUTES = 15;

export interface ReconcileResult {
  reconciled: boolean;
  outcome: string;
}

/**
 * Single-order reconciliation — the shared logic behind both the background
 * scheduler and the admin "Recheck Payment" action. Fetches Razorpay's own
 * record of the order's payments (the trusted state) and reconciles our
 * internal record to match, via the SAME finalizeRazorpayPayment()/
 * markRazorpayPaymentFailed() the verify route and webhook already use — no
 * separate finalization logic.
 *
 * Network/API failure is explicitly NOT treated as payment failure (PRD:
 * "gateway could not be contacted" != "gateway says failed") — on an
 * unreachable Razorpay API, internal state is left untouched.
 */
export async function reconcileOrderPayment(orderId: string): Promise<ReconcileResult> {
  await connectDB();

  const order = await Order.findById(orderId).select("paymentStatus paymentMethod razorpayOrderId").lean<
    Pick<IOrder, "paymentStatus" | "paymentMethod" | "razorpayOrderId">
  >();
  if (!order) return { reconciled: false, outcome: "Order not found." };
  if (order.paymentMethod === "cod") return { reconciled: false, outcome: "Cash on Delivery order — nothing to reconcile." };
  if (!order.razorpayOrderId) return { reconciled: false, outcome: "No Razorpay order was ever created for this order." };
  if (order.paymentStatus !== "pending") {
    return { reconciled: false, outcome: `Already "${order.paymentStatus}" — no reconciliation needed.` };
  }

  let payments;
  try {
    const result = await getRazorpayClient().orders.fetchPayments(order.razorpayOrderId);
    payments = result.items;
  } catch (err) {
    console.error(`Reconciliation: Razorpay API unreachable for order ${orderId}:`, err);
    return { reconciled: false, outcome: "Could not reach Razorpay right now — will retry later." };
  }

  const captured = payments.filter((p) => p.status === "captured");
  if (captured.length > 1) {
    // Section 56: a genuine double-payment must be flagged, never silently
    // ignored, even though only the first is ever used to finalize the order
    // (finalizeRazorpayPayment's own idempotency guard would reject a second
    // finalize attempt regardless). No automatic remediation exists for this
    // — it needs a human to look at the Razorpay dashboard and decide.
    console.error(
      `DUPLICATE PAYMENT DETECTED for order ${orderId}: ${captured.length} captured payments ` +
      `(${captured.map((p) => p.id).join(", ")}) for Razorpay order ${order.razorpayOrderId}. Manual review required.`
    );
  }
  if (captured.length > 0) {
    await finalizeRazorpayPayment({ orderId, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: captured[0].id });
    return {
      reconciled: true,
      outcome: captured.length > 1
        ? "Payment was captured on Razorpay (multiple captured payments detected — flagged for manual review)."
        : "Payment was captured on Razorpay — order marked paid.",
    };
  }

  const allFailed = payments.length > 0 && payments.every((p) => p.status === "failed");
  if (allFailed) {
    await markRazorpayPaymentFailed({ orderId, razorpayOrderId: order.razorpayOrderId });
    return { reconciled: true, outcome: "All payment attempts failed on Razorpay — order marked failed." };
  }

  return { reconciled: false, outcome: "No captured payment found yet on Razorpay — still pending." };
}

/**
 * Batched, indexed lookup of stale pending Razorpay orders for the background
 * scheduler — never loads the full order history into memory.
 */
export async function findStalePendingPayments(limit = 50) {
  await connectDB();
  const cutoff = new Date(Date.now() - PAYMENT_RECONCILE_AFTER_MINUTES * 60_000);
  return Order.find({
    paymentStatus: "pending",
    paymentMethod: { $ne: "cod" },
    razorpayOrderId: { $exists: true },
    createdAt: { $lt: cutoff },
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}
