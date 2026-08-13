/**
 * lib/rewards/recomputeEntitlements.ts
 *
 * PRD 4H — Centralized reward policy recomputation.
 *
 * Entry point called whenever an order's financial reality changes
 * (partial refund, full refund after rewards were issued, or cancellation).
 * Each sub-function is failure-isolated — a failure in mission recomputation
 * never blocks or rolls back a completed referral clawback.
 *
 * Idempotency guarantee: every financial operation inside is keyed on
 * `triggerId` (a stable, unique string per event: the refund._id for
 * REFUND_PROCESSED, or `cancel:{orderId}` for ORDER_CANCELLED). Retrying
 * the same triggerId is safe — all writes are no-ops on the second call.
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import DamruTransaction from "@/models/DamruTransaction";
import User from "@/models/User";
import {
  applyPartialReversal,
  applyReversal,
  calculatePartialReversalAmount,
  getTotalReversedAmount,
  findReversibleTransactions,
} from "@/lib/rewards/reversalEngine";
import { evaluateRiskSafely, evaluateRefundRisk } from "@/lib/rewards/riskEngine";
import { paymentEligibleOrderFilter } from "@/lib/orders/orderPaymentPolicy";

export interface RecomputeContext {
  userId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
  /** "ORDER_CANCELLED" — full order-level cancellation (COD or never-paid online).
   *  "REFUND_PROCESSED" — a Razorpay refund reached "processed" state. */
  trigger: "ORDER_CANCELLED" | "REFUND_PROCESSED";
  /** Stable identifier for this event — used as the idempotency discriminator
   *  in every financial write below. Must be unique per distinct event:
   *  - REFUND_PROCESSED: String(refund._id)
   *  - ORDER_CANCELLED: `cancel:${orderId}` */
  triggerId: string;
  /** Amount refunded in THIS event (Razorpay refunds only). */
  partialRefundAmount?: number;
  /** Cumulative refundedAmount on the Order AFTER this event. */
  totalRefundedAmount?: number;
  /** Order.paymentAmount — the gateway-captured amount. */
  paymentAmount?: number;
}

export interface RecomputeResult {
  orderId: string;
  trigger: string;
  triggerId: string;
  orderReward: { reversed: number; skipped: boolean; error?: string };
  firstOrder: { requalified: boolean; skipped: boolean; error?: string };
  referral: { clawedBack: boolean; requalified: boolean; skipped: boolean; error?: string };
  missions: { reversed: number; skipped: boolean; error?: string };
  achievements: { reversed: number; skipped: boolean; error?: string };
  loyalty: { downgraded: boolean; skipped: boolean; error?: string };
}

// ---------------------------------------------------------------------------
// 1. Order Reward Recomputation (partial and full)
// ---------------------------------------------------------------------------
async function recomputeOrderRewards(ctx: RecomputeContext): Promise<RecomputeResult["orderReward"]> {
  try {
    const originals = await findReversibleTransactions(ctx.orderId);
    if (originals.length === 0) return { reversed: 0, skipped: true };

    const isFullReversal = ctx.trigger === "ORDER_CANCELLED" ||
      (ctx.totalRefundedAmount != null && ctx.paymentAmount != null && ctx.totalRefundedAmount >= ctx.paymentAmount);

    let totalReversed = 0;

    for (const original of originals) {
      const reason = isFullReversal
        ? (ctx.trigger === "ORDER_CANCELLED" ? "ORDER_CANCELLED" as const : "FULL_REFUND" as const)
        : "PARTIAL_REFUND" as const;

      if (isFullReversal) {
        const result = await applyReversal(original._id, {
          reason,
          triggerId: ctx.triggerId,
          orderId: ctx.orderId,
          refundId: ctx.trigger === "REFUND_PROCESSED" ? ctx.triggerId : undefined,
          note: reason === "FULL_REFUND" ? "Order fully refunded." : undefined,
        });
        if (result.applied) totalReversed += original.amount;
      } else {
        // Partial refund — compute proportional reversal.
        const order = await Order.findById(ctx.orderId)
          .select("eligibleRewardAmount")
          .lean<{ eligibleRewardAmount: number }>();
        const originalEligibleAmount = order?.eligibleRewardAmount ?? 0;
        const alreadyReversed = await getTotalReversedAmount(original._id);
        const campaignSnapshot = original.campaignSnapshot as Record<string, unknown> | undefined;

        const { additionalReversal } = calculatePartialReversalAmount({
          originalEligibleAmount,
          originalReward: original.amount,
          refundedAmount: ctx.totalRefundedAmount ?? ctx.partialRefundAmount ?? 0,
          paymentAmount: ctx.paymentAmount ?? 1,
          alreadyReversed,
          campaignSnapshot,
        });

        if (additionalReversal > 0) {
          const result = await applyPartialReversal(original._id, additionalReversal, {
            reason: "PARTIAL_REFUND",
            triggerId: ctx.triggerId,
            orderId: ctx.orderId,
            refundId: ctx.triggerId,
          });
          if (result.applied) totalReversed += additionalReversal;
        }
      }
    }

    return { reversed: totalReversed, skipped: false };
  } catch (error) {
    console.error("[recomputeEntitlements] orderReward failed:", error);
    return { reversed: 0, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// 2. First-Order Requalification
// ---------------------------------------------------------------------------
async function recomputeFirstOrder(ctx: RecomputeContext): Promise<RecomputeResult["firstOrder"]> {
  try {
    // Only act when the full order value is lost (cancellation or full refund).
    const isFullLoss = ctx.trigger === "ORDER_CANCELLED" ||
      (ctx.totalRefundedAmount != null && ctx.paymentAmount != null && ctx.totalRefundedAmount >= ctx.paymentAmount);
    if (!isFullLoss) return { requalified: false, skipped: true };

    // Was there a first_order reward tied to this order?
    const firstOrderTx = await DamruTransaction.findOne({
      userId: ctx.userId,
      orderId: ctx.orderId,
      category: "first_order",
      type: "credit",
      amount: { $gt: 0 },
    }).lean<{ _id: mongoose.Types.ObjectId; amount: number }>();

    if (!firstOrderTx) return { requalified: false, skipped: true };

    // Reverse the first-order reward for this order.
    await applyReversal(firstOrderTx._id, {
      reason: ctx.trigger === "ORDER_CANCELLED" ? "ORDER_CANCELLED" : "FULL_REFUND",
      triggerId: ctx.triggerId,
      orderId: ctx.orderId,
      refundId: ctx.trigger === "REFUND_PROCESSED" ? ctx.triggerId : undefined,
      allowManualCredit: true,
    });

    // Find next eligible order to requalify.
    const { checkAndAwardFirstOrderReward } = await import("@/lib/rewardEngine");
    const nextOrder = await Order.findOne({
      userId: ctx.userId,
      _id: { $ne: ctx.orderId },
      status: "delivered",
      ...paymentEligibleOrderFilter(),
    })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!nextOrder) return { requalified: false, skipped: false };

    const result = await checkAndAwardFirstOrderReward(ctx.userId, nextOrder._id, {
      requalificationSuffix: ctx.triggerId,
    });
    return { requalified: !result.skipped && !result.duplicate, skipped: false };
  } catch (error) {
    console.error("[recomputeEntitlements] firstOrder failed:", error);
    return { requalified: false, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// 3. Referral Clawback & Requalification
// ---------------------------------------------------------------------------
async function recomputeReferral(ctx: RecomputeContext): Promise<RecomputeResult["referral"]> {
  try {
    const isFullLoss = ctx.trigger === "ORDER_CANCELLED" ||
      (ctx.totalRefundedAmount != null && ctx.paymentAmount != null && ctx.totalRefundedAmount >= ctx.paymentAmount);
    if (!isFullLoss) return { clawedBack: false, requalified: false, skipped: true };

    const { evaluateReferralClawback } = await import("@/lib/referralEngine");
    const clawbackResult = await evaluateReferralClawback(ctx.orderId, ctx.triggerId);
    if (clawbackResult.skipped) return { clawedBack: false, requalified: false, skipped: true };

    return {
      clawedBack: clawbackResult.clawedBack ?? false,
      requalified: clawbackResult.requalified ?? false,
      skipped: false,
    };
  } catch (error) {
    console.error("[recomputeEntitlements] referral failed:", error);
    return { clawedBack: false, requalified: false, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// 4. Mission Progress Recomputation
// ---------------------------------------------------------------------------
async function recomputeMissions(ctx: RecomputeContext): Promise<RecomputeResult["missions"]> {
  try {
    const isFullLoss = ctx.trigger === "ORDER_CANCELLED" ||
      (ctx.totalRefundedAmount != null && ctx.paymentAmount != null && ctx.totalRefundedAmount >= ctx.paymentAmount);
    if (!isFullLoss) return { reversed: 0, skipped: true };

    const { recomputeMissionProgress } = await import("@/lib/missionEngine");
    const result = await recomputeMissionProgress(ctx.userId, ctx.orderId, ctx.triggerId);
    return { reversed: result.reversed, skipped: false };
  } catch (error) {
    console.error("[recomputeEntitlements] missions failed:", error);
    return { reversed: 0, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// 5. Achievement Recomputation
// ---------------------------------------------------------------------------
async function recomputeAchievements(ctx: RecomputeContext): Promise<RecomputeResult["achievements"]> {
  try {
    const isFullLoss = ctx.trigger === "ORDER_CANCELLED" ||
      (ctx.totalRefundedAmount != null && ctx.paymentAmount != null && ctx.totalRefundedAmount >= ctx.paymentAmount);
    if (!isFullLoss) return { reversed: 0, skipped: true };

    const { recomputeAchievementProgress } = await import("@/lib/achievementEngine");
    const result = await recomputeAchievementProgress(ctx.userId, ctx.triggerId);
    return { reversed: result.reversed, skipped: false };
  } catch (error) {
    console.error("[recomputeEntitlements] achievements failed:", error);
    return { reversed: 0, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// 6. Loyalty Tier Downgrade
// ---------------------------------------------------------------------------
async function recomputeLoyalty(ctx: RecomputeContext): Promise<RecomputeResult["loyalty"]> {
  try {
    const { evaluateLoyaltyTier } = await import("@/lib/loyaltyEngine");
    // issueBonus: false — we never issue an upgrade bonus triggered by a refund event.
    const result = await evaluateLoyaltyTier(ctx.userId, { issueBonus: false });
    return { downgraded: result.changed, skipped: false };
  } catch (error) {
    console.error("[recomputeEntitlements] loyalty failed:", error);
    return { downgraded: false, skipped: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates all reward policy recomputation after a financial invalidation.
 *
 * SAFE TO RETRY: every sub-function is idempotent on the same `triggerId`.
 * FAILURE-ISOLATED: each sub-function failure is caught and logged; the
 * overall result records which sub-functions errored without aborting others.
 */
export async function recomputeRewardEntitlements(ctx: RecomputeContext): Promise<RecomputeResult> {
  await connectDB();

  // Validate user exists before orchestrating anything.
  const user = await User.findById(ctx.userId).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
  if (!user) {
    throw new Error(`recomputeRewardEntitlements: User ${ctx.userId} not found.`);
  }

  const [orderReward, firstOrder, referral, missions, achievements, loyalty] = await Promise.all([
    recomputeOrderRewards(ctx),
    recomputeFirstOrder(ctx),
    recomputeReferral(ctx),
    recomputeMissions(ctx),
    recomputeAchievements(ctx),
    recomputeLoyalty(ctx),
  ]);

  // Emit risk signals if this was a refund event.
  if (ctx.trigger === "REFUND_PROCESSED") {
    await evaluateRiskSafely("recompute-refund-risk", () =>
      evaluateRefundRisk({
        userId: ctx.userId as mongoose.Types.ObjectId,
        refundId: ctx.triggerId as unknown as mongoose.Types.ObjectId,
        orderId: ctx.orderId as mongoose.Types.ObjectId,
      })
    );
  }

  return {
    orderId: String(ctx.orderId),
    trigger: ctx.trigger,
    triggerId: ctx.triggerId,
    orderReward,
    firstOrder,
    referral,
    missions,
    achievements,
    loyalty,
  };
}
