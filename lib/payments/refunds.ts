import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Order, { PaymentStatus } from "@/models/Order";
import PaymentRefund, { IPaymentRefund } from "@/models/PaymentRefund";
import DamruTransaction, { IDamruAllocation } from "@/models/DamruTransaction";
import Coupon from "@/models/Coupon";
import User from "@/models/User";
import { getRazorpayClient, toRazorpayAmount } from "@/lib/payments/razorpay";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { assignLotFields } from "@/lib/rewards/damruAllocation";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";
import { notifyPaymentEvent } from "@/lib/notifications/paymentNotificationService";

/**
 * Releases one reserved usage of a coupon — called when an order that
 * reserved it is cancelled before ever completing payment (see cancelOrder in
 * app/actions/orders.ts and docs/PAYMENT_RELIABILITY_REFUNDS.md's Coupon
 * Restoration Policy). The `usedCount: { $gt: 0 }` guard makes this
 * atomically safe against usedCount ever going negative — a second release
 * attempt for an already-zero coupon is a no-op, not a decrement to -1.
 */
export async function releaseCouponUsage(couponCode: string): Promise<void> {
  await connectDB();
  await Coupon.updateOne({ code: couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000;
}

/**
 * Recomputes Order.paymentStatus from its refund counters — the single place
 * that derives the value, called after every mutation below, so a rollback
 * (duplicate request, failed refund) can never leave a stale "refund_pending"
 * behind. Never touches "pending"/"failed" (pre-payment states) — refunds
 * only apply to orders that were actually paid.
 */
async function syncOrderPaymentStatus(orderId: string | mongoose.Types.ObjectId): Promise<void> {
  const order = await Order.findById(orderId).select("paymentStatus refundedAmount pendingRefundAmount paymentAmount").lean<{
    paymentStatus: PaymentStatus; refundedAmount: number; pendingRefundAmount: number; paymentAmount?: number;
  }>();
  if (!order || order.paymentStatus === "pending" || order.paymentStatus === "failed") return;

  let next: PaymentStatus;
  if (order.pendingRefundAmount > 0) next = "refund_pending";
  else if (order.refundedAmount <= 0) next = "paid";
  else if (order.refundedAmount < (order.paymentAmount ?? 0)) next = "partially_refunded";
  else next = "refunded";

  if (next !== order.paymentStatus) {
    await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: next } });
  }
}

/**
 * Damru restoration — shared by both the actual-refund path (finalizeRefund
 * below) and cancelOrder's never-paid/COD path. Deliberately touches ONLY
 * damruBalance: not damruTotalEarned (this isn't a new earning — inflating it
 * would wrongly boost loyalty-tier progress from a refund) and not
 * damruTotalRedeemed (a lifetime stat; the redemption genuinely happened,
 * cancelling it doesn't erase that history). No loyalty recalculation runs.
 * `idempotencySuffix` should be a stable identifier for the ONE restoration
 * event (a refund's _id, or `cancel_<orderId>` for the never-paid case).
 *
 * Expiry policy (PRD 4A section 14): preferred behavior is restoring Damru
 * into the SAME lots it was originally redeemed from, so it keeps its
 * original expiry date rather than silently gaining a fresh one. This is only
 * possible when the original redemption transaction recorded per-lot
 * `allocations` (i.e. it happened after the lot-allocation architecture
 * shipped). For a legacy redemption with no allocation info — or any portion
 * that genuinely can't be traced back to a lot — the restored amount becomes
 * its own fresh lot on this refund_restore transaction instead, under the
 * standard expiry policy. This is the documented fallback, not a guess.
 */
export async function restoreDamruForOrder(
  orderId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId | undefined,
  idempotencySuffix: string
): Promise<void> {
  await connectDB();
  if (!userId) return;

  const redemption = await DamruTransaction.findOne({
    idempotencyKey: `redeem_order_${orderId}`,
    category: "redemption",
  }).select("amount allocations").lean<{ amount: number; allocations?: IDamruAllocation[] }>();
  if (!redemption || redemption.amount <= 0) return;

  const tracedAllocations = redemption.allocations || [];
  const tracedAmount = tracedAllocations.reduce((sum, a) => sum + a.amount, 0);
  const untracedShortfall = Math.max(0, redemption.amount - tracedAmount);

  const idempotencyKey = `refund_restore_${idempotencySuffix}`;
  let transaction;
  try {
    const config = await getDamruConfig();
    transaction = await DamruTransaction.create({
      userId,
      type: "credit",
      category: "refund_restore",
      amount: redemption.amount,
      balanceAfter: 0, // patched below
      description: "Damru restored — order cancelled/refunded before delivery",
      idempotencyKey,
      orderId,
      // Only the untraced shortfall becomes THIS transaction's own spendable lot —
      // the traced portion is restored directly into its original lots below, so
      // counting it here too would double the wallet-invariant sum.
      ...(untracedShortfall > 0 ? assignLotFields(untracedShortfall, "refund_restore", config) : {}),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return; // already restored — safe no-op
    throw err;
  }

  const user = await User.findByIdAndUpdate(userId, { $inc: { damruBalance: redemption.amount } }, { new: true });
  if (user) {
    transaction.balanceAfter = user.damruBalance;
    await transaction.save();
  }

  for (const alloc of tracedAllocations) {
    const restored = await DamruTransaction.findOneAndUpdate(
      {
        _id: alloc.creditTransactionId,
        $expr: { $lte: [{ $add: ["$remainingAmount", alloc.amount] }, "$originalAmount"] },
      },
      { $inc: { remainingAmount: alloc.amount } }
    );
    if (!restored) {
      // Defensive only — should be unreachable under normal operation, since
      // this exact amount was subtracted from this exact lot at redemption time.
      console.error(`Damru restore: could not restore ${alloc.amount} into lot ${alloc.creditTransactionId} (order ${orderId}) — original lot may have been altered.`);
    }
  }

  await notifyRewardEvent({
    userId,
    type: "DAMRU_RESTORED",
    sourceId: transaction._id,
    sourceType: "DamruTransaction",
    amount: redemption.amount,
    route: "/my-profile?tab=rewards",
  });
}

/**
 * Idempotent refund finalization — the ONLY place refundedAmount moves and
 * Damru restoration is triggered. Called identically from the synchronous
 * request-refund path (when Razorpay returns status "processed" immediately)
 * and from the refund.processed webhook, so neither can produce a different
 * outcome than the other. A `status: "pending"` guard on the conditional
 * update makes repeat calls (duplicate webhook, webhook racing the sync path)
 * safe no-ops.
 */
export async function finalizeRefund(refundId: string | mongoose.Types.ObjectId): Promise<{ alreadyFinalized: boolean; refund?: IPaymentRefund }> {
  await connectDB();

  const refund = await PaymentRefund.findOneAndUpdate(
    { _id: refundId, status: "pending" },
    { $set: { status: "processed", processedAt: new Date() } },
    { new: true }
  );
  if (!refund) return { alreadyFinalized: true };

  await Order.updateOne(
    { _id: refund.orderId },
    { $inc: { refundedAmount: refund.amount, pendingRefundAmount: -refund.amount } }
  );
  await syncOrderPaymentStatus(refund.orderId);

  // Policy A (see docs/PAYMENT_RELIABILITY_REFUNDS.md): restore Damru only
  // once the order has been refunded IN FULL — proportional restoration for
  // partial refunds is explicitly deferred, undefined product policy.
  const order = await Order.findById(refund.orderId).select("orderId paymentAmount refundedAmount userId").lean<{
    orderId: string; paymentAmount?: number; refundedAmount: number; userId?: mongoose.Types.ObjectId;
  }>();
  if (order && order.paymentAmount != null && order.paymentAmount > 0 && order.refundedAmount >= order.paymentAmount) {
    await restoreDamruForOrder(refund.orderId, order.userId, String(refund._id));
  }

  if (order?.userId) {
    await notifyPaymentEvent({
      userId: order.userId,
      type: "REFUND_PROCESSED",
      sourceId: refund._id,
      sourceType: "PaymentRefund",
      amount: refund.amount,
      orderNumber: order.orderId,
      route: `/my-profile?tab=orders`,
    });
  }

  return { alreadyFinalized: false, refund };
}

/**
 * Idempotent refund-failure handling — shared by the synchronous request path
 * (Razorpay API call itself throws) and the refund.failed webhook. A
 * `status: "pending"` guard means this is a safe no-op if the refund already
 * reached "processed" (a failure signal arriving after success is ignored,
 * never rolling back a completed refund) or was already marked failed.
 */
export async function markRefundFailed(refundId: string | mongoose.Types.ObjectId): Promise<void> {
  await connectDB();

  const refund = await PaymentRefund.findOneAndUpdate(
    { _id: refundId, status: "pending" },
    { $set: { status: "failed", failedAt: new Date() } },
    { new: true }
  );
  if (!refund) return;

  await Order.updateOne({ _id: refund.orderId }, { $inc: { pendingRefundAmount: -refund.amount } });
  await syncOrderPaymentStatus(refund.orderId);

  const order = await Order.findById(refund.orderId).select("orderId userId").lean<{ orderId: string; userId?: mongoose.Types.ObjectId }>();
  if (order?.userId) {
    await notifyPaymentEvent({
      userId: order.userId,
      type: "REFUND_FAILED",
      sourceId: refund._id,
      sourceType: "PaymentRefund",
      orderNumber: order.orderId,
      route: `/my-profile?tab=orders`,
    });
  }
}

export interface RequestRefundInput {
  orderId: string;
  amount: number;
  reason: string;
  note?: string;
  adminId: string | mongoose.Types.ObjectId;
  refundRequestId: string;
}

export type RequestRefundResult =
  | { success: true; refund: IPaymentRefund; duplicate?: boolean }
  | { success: false; error: string };

/**
 * Atomic reservation — the concurrency-safety boundary for "two admins both
 * refund the last ₹500 at once". Only the caller whose amount still fits
 * under (paymentAmount − refundedAmount − pendingRefundAmount) at the exact
 * instant this runs succeeds; a concurrent loser gets `false`, never a silent
 * over-refund. paymentStatus is NOT set inside this same atomic op —
 * syncOrderPaymentStatus() derives it right after, so a later rollback
 * (releaseRefundReservation) can never leave it stale. Exported standalone so
 * the concurrency guarantee is testable without a live Razorpay call.
 */
export async function reserveRefundAmount(orderId: string | mongoose.Types.ObjectId, amount: number): Promise<boolean> {
  await connectDB();
  const reserved = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: { $in: ["paid", "partially_refunded"] },
      $expr: { $lte: [{ $add: ["$refundedAmount", "$pendingRefundAmount", amount] }, "$paymentAmount"] },
    },
    { $inc: { pendingRefundAmount: amount } },
    { new: true }
  );
  if (!reserved) return false;
  await syncOrderPaymentStatus(orderId);
  return true;
}

/** Releases a reservation made by reserveRefundAmount() — used on rollback (duplicate request, failed API call). */
export async function releaseRefundReservation(orderId: string | mongoose.Types.ObjectId, amount: number): Promise<void> {
  await connectDB();
  await Order.updateOne({ _id: orderId }, { $inc: { pendingRefundAmount: -amount } });
  await syncOrderPaymentStatus(orderId);
}

/**
 * Backend-authoritative refund entry point (called only from the admin
 * refund route). Never accepts a client-computed "maximum refundable" —
 * that's recomputed here from Order.refundedAmount/pendingRefundAmount/
 * paymentAmount, atomically, so two concurrent requests can't both claim the
 * same remaining balance (see the reservation step below).
 */
export async function requestRefund(input: RequestRefundInput): Promise<RequestRefundResult> {
  await connectDB();

  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount) || input.amount <= 0) {
    return { success: false, error: "Refund amount must be a positive whole number." };
  }
  if (!input.reason?.trim()) {
    return { success: false, error: "A refund reason is required." };
  }
  if (!mongoose.isValidObjectId(input.orderId)) {
    return { success: false, error: "Invalid order." };
  }

  const order = await Order.findById(input.orderId);
  if (!order) return { success: false, error: "Order not found." };
  if (order.paymentMethod === "cod") {
    return { success: false, error: "Cash on Delivery orders have no gateway payment to refund — issue a manual cash refund instead." };
  }
  if (!order.razorpayPaymentId) {
    return { success: false, error: "This order has no captured payment to refund." };
  }
  if (order.paymentStatus === "refund_pending") {
    return { success: false, error: "A refund is already in progress for this order — wait for it to complete before requesting another." };
  }
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    return { success: false, error: "This order isn't in a refundable state." };
  }

  const reserved = await reserveRefundAmount(input.orderId, input.amount);
  if (!reserved) {
    return { success: false, error: "Requested amount exceeds the remaining refundable balance." };
  }

  let refund: IPaymentRefund;
  try {
    refund = await PaymentRefund.create({
      orderId: order._id,
      userId: order.userId,
      gateway: "razorpay",
      gatewayPaymentId: order.razorpayPaymentId,
      amount: input.amount,
      currency: "INR",
      status: "pending",
      reason: input.reason.trim(),
      note: input.note?.trim() || undefined,
      requestedBy: input.adminId,
      requestedAt: new Date(),
      refundRequestId: input.refundRequestId,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Same requestId retried — the reservation above double-counted for
      // this attempt; undo it and hand back the ORIGINAL refund's state.
      await releaseRefundReservation(input.orderId, input.amount);
      const existing = await PaymentRefund.findOne({ refundRequestId: input.refundRequestId });
      if (existing) return { success: true, refund: existing, duplicate: true };
      return { success: false, error: "This refund was already requested but could not be found. Please retry with a new request." };
    }
    // Something else failed after we reserved — release the reservation.
    await releaseRefundReservation(input.orderId, input.amount);
    throw err;
  }

  try {
    const rp = await getRazorpayClient().payments.refund(order.razorpayPaymentId, {
      amount: toRazorpayAmount(input.amount),
      speed: "normal",
      receipt: String(refund._id),
      notes: { internalOrderId: String(order._id), refundRequestId: input.refundRequestId },
    });
    refund.gatewayRefundId = rp.id;
    await refund.save();

    if (rp.status === "processed") {
      const result = await finalizeRefund(refund._id);
      return { success: true, refund: result.refund ?? refund };
    }
    // "pending" — most Indian payment methods process near-instantly, but
    // some (e.g. certain bank transfers) don't; the refund.processed webhook
    // finalizes it later. The order shows "refund_pending" until then.
    return { success: true, refund };
  } catch (err) {
    console.error("Razorpay refund API call failed:", err);
    await markRefundFailed(refund._id);
    return { success: false, error: "Unable to process the refund right now. Please try again shortly." };
  }
}
