import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { allocateDebit, releaseAllocation } from "@/lib/rewards/damruAllocation";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";
import DamruTransaction, { IDamruTransaction } from "@/models/DamruTransaction";
import Order from "@/models/Order";
import RewardReversal, { RewardReversalReason } from "@/models/RewardReversal";
import User from "@/models/User";
import { evaluateRewardDebtRisk, evaluateRewardReversalRisk, evaluateRiskSafely } from "@/lib/rewards/riskEngine";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { baseEarnDamru, valueSnapshot } from "@/lib/rewards/damruValue";
import { toPaise } from "@/lib/checkout/money";

// Order-linked categories that are directly reversible by the order reversal
// pipeline. "referral", "mission", and "achievement" are intentionally absent
// here — those are reversed by their own domain engines (referralEngine,
// missionEngine, achievementEngine) which call applyReversal with
// allowManualCredit: true.
const DIRECT_ORDER_CATEGORIES = ["order_reward", "item_reward", "category_reward", "tier_reward", "first_order", "campaign"] as const;

/**
 * Atomically claims up to `requested` Damru of an original credit's remaining
 * reversible headroom and returns how much was granted. This is the guard that
 * keeps reversals from DIFFERENT triggers (e.g. a cancellation and a later
 * refund of the same order) from together clawing back more than was credited.
 * Legacy credits (pre-dating `reversedAmount`) start from their recorded
 * RewardReversal total.
 */
async function claimReversalHeadroom(originalId: mongoose.Types.ObjectId, requested: number): Promise<number> {
  const legacyReversed = await getTotalReversedAmount(originalId);
  const reversed = { $ifNull: ["$reversedAmount", legacyReversed] };
  const before = await DamruTransaction.findOneAndUpdate(
    { _id: originalId, type: "credit" },
    [{ $set: { reversedAmount: { $min: ["$amount", { $add: [reversed, requested] }] } } }],
    { new: false, updatePipeline: true }
  ).select("amount reversedAmount").lean<{ amount: number; reversedAmount?: number }>();
  if (!before) return 0;
  const already = before.reversedAmount ?? legacyReversed;
  return Math.max(0, Math.min(before.amount, already + requested) - already);
}

async function releaseReversalHeadroom(originalId: mongoose.Types.ObjectId, granted: number) {
  if (granted > 0) await DamruTransaction.updateOne({ _id: originalId, reversedAmount: { $gte: granted } }, { $inc: { reversedAmount: -granted } });
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000;
}

export interface ReversalInput {
  reason: RewardReversalReason;
  triggerId: string;
  orderId?: string | mongoose.Types.ObjectId;
  refundId?: string | mongoose.Types.ObjectId;
  createdBy?: string | mongoose.Types.ObjectId;
  note?: string;
  allowManualCredit?: boolean;
}

export async function findReversibleTransactions(orderId: string | mongoose.Types.ObjectId) {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return [];
  return DamruTransaction.find({
    orderId,
    type: "credit",
    category: { $in: DIRECT_ORDER_CATEGORIES },
    amount: { $gt: 0 },
  }).sort({ createdAt: 1 });
}

export async function calculateReversibleAmount(originalTransactionId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const [original, totalReversed] = await Promise.all([
    DamruTransaction.findById(originalTransactionId).select("type amount").lean<{ type: string; amount: number }>(),
    getTotalReversedAmount(originalTransactionId),
  ]);
  if (!original || original.type !== "credit") return 0;
  return Math.max(0, original.amount - totalReversed);
}

/**
 * Returns the sum of all APPLIED partial/full reversal amounts against a
 * given original credit transaction. Used to compute remaining reversible
 * balance before each new reversal.
 */
export async function getTotalReversedAmount(originalTransactionId: string | mongoose.Types.ObjectId): Promise<number> {
  await connectDB();
  const rows = await RewardReversal.find({
    originalTransactionId,
    status: "APPLIED",
  }).select("partialAmount amount").lean<Array<{ partialAmount?: number; amount: number }>>();
  // Rows written before partialAmount existed were always full reversals.
  return rows.reduce((sum, r) => sum + (r.partialAmount ?? r.amount ?? 0), 0);
}

/**
 * Computes the additional reversal amount warranted by a partial refund.
 *
 * Refunds are amount-based (PaymentRefund has no item lines), so the refunded
 * share of the payment is applied to the order's eligible amount, and each
 * credit is recomputed from its OWN snapshot — never from today's rules:
 * - base order reward with a ruleSnapshot: the snapshotted per-₹ rate is
 *   re-applied to the remaining eligible amount (the original formula);
 * - campaign FIXED_DAMRU: fully reversed on any refund of the trigger order;
 * - campaign MULTIPLIER / PERCENT_BONUS, dish, category and order-value
 *   rewards, and legacy credits without a snapshot: scaled in proportion to
 *   the eligible amount that remains. A dish reward can't be tied to the
 *   refunded dish because refunds carry no lines — see the implementation report.
 *
 * All arithmetic is in integer paise; results are floored.
 * Returns `additionalReversal` — the amount to reverse on top of what has
 * already been reversed — clamped to [0, originalReward - alreadyReversed].
 */
export function calculatePartialReversalAmount(input: {
  originalEligibleAmount: number;
  originalReward: number;
  refundedAmount: number;
  paymentAmount: number;
  alreadyReversed: number;
  campaignSnapshot?: Record<string, unknown>;
  ruleSnapshot?: Record<string, unknown>;
}): { targetTotalReversal: number; additionalReversal: number } {
  const {
    originalEligibleAmount,
    originalReward,
    refundedAmount,
    paymentAmount,
    alreadyReversed,
    campaignSnapshot,
    ruleSnapshot,
  } = input;

  if (paymentAmount <= 0 || originalEligibleAmount <= 0) {
    return { targetTotalReversal: originalReward, additionalReversal: Math.max(0, originalReward - alreadyReversed) };
  }

  // Remaining eligible (paise) after all processed refunds.
  const eligiblePaise = toPaise(originalEligibleAmount);
  const refundedPaise = Math.min(toPaise(paymentAmount), Math.max(0, toPaise(refundedAmount)));
  const refundedEligiblePaise = Math.round((eligiblePaise * refundedPaise) / toPaise(paymentAmount));
  const remainingEligiblePaise = Math.max(0, eligiblePaise - refundedEligiblePaise);
  const proportional = Math.floor((remainingEligiblePaise * originalReward) / eligiblePaise);

  let targetReward: number;
  // A daily-limit-capped credit no longer follows its formula, so it scales proportionally.
  const rate = ruleSnapshot?.kind === "BASE" && !ruleSnapshot.dailyLimit ? Number(ruleSnapshot.rupeesPerDamru) : NaN;

  if (campaignSnapshot) {
    const mode = campaignSnapshot.rewardMode as string | undefined;
    // Fixed campaign bonus: fully reverse when the trigger order is refunded.
    targetReward = mode === "FIXED_DAMRU" ? 0 : proportional;
  } else if (Number.isInteger(rate) && rate >= 1) {
    targetReward = Math.min(originalReward, baseEarnDamru(remainingEligiblePaise, rate));
  } else {
    targetReward = proportional;
  }

  // Clamp to what was originally awarded and what is not yet reversed.
  const targetTotalReversal = Math.min(originalReward, Math.max(0, originalReward - targetReward));
  const additionalReversal = Math.min(
    Math.max(0, targetTotalReversal - alreadyReversed),
    originalReward - alreadyReversed
  );
  return { targetTotalReversal, additionalReversal };
}

export async function reserveReversal(original: IDamruTransaction, input: ReversalInput, partialAmount?: number) {
  const amount = partialAmount ?? original.amount;
  const idempotencyKey = `reward-reversal:${original._id}:${input.triggerId}`;
  try {
    const reversal = await RewardReversal.create({
      userId: original.userId,
      originalTransactionId: original._id,
      orderId: input.orderId || original.orderId,
      refundId: input.refundId,
      amount: original.amount,
      partialAmount: amount,
      walletAmount: 0,
      debtAmount: 0,
      reason: input.reason,
      triggerId: input.triggerId,
      note: input.note?.trim() || undefined,
      status: "RESERVED",
      idempotencyKey,
      createdBy: input.createdBy,
    });
    return { reversal, duplicate: false as const };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const reversal = await RewardReversal.findOne({ idempotencyKey });
    if (!reversal) throw error;
    return { reversal, duplicate: true as const };
  }
}

async function debitAvailableBalance(userId: mongoose.Types.ObjectId, amount: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const user = await User.findById(userId).select("damruBalance").lean<{ damruBalance: number }>();
    if (!user) throw new Error("Reward owner not found.");
    const walletAmount = Math.min(amount, Math.max(0, user.damruBalance || 0));
    if (walletAmount === 0) return { walletAmount: 0, newBalance: 0, allocations: [] };
    const allocation = await allocateDebit(userId, walletAmount);
    if (allocation.success) return { walletAmount, newBalance: allocation.newBalance || 0, allocations: allocation.allocations };
  }
  throw new Error("Wallet changed repeatedly while applying reward reversal.");
}

function customerDescription(reason: RewardReversalReason, orderNumber?: string) {
  if (reason === "FULL_REFUND") return orderNumber ? `Reward Adjusted - Order #${orderNumber} was refunded.` : "Reward Adjusted - an order was refunded.";
  if (reason === "PARTIAL_REFUND") return orderNumber ? `Reward Adjusted - Order #${orderNumber} was partially refunded.` : "Reward Adjusted - an order was partially refunded.";
  if (reason === "ORDER_CANCELLED") return orderNumber ? `Reward Adjusted - Order #${orderNumber} was cancelled.` : "Reward Adjusted - an order was cancelled.";
  if (reason === "PAYMENT_REVERSED") return orderNumber ? `Reward Adjusted - payment for Order #${orderNumber} was reversed.` : "Reward Adjusted - an order payment was reversed.";
  return "Reward Adjusted - an account reward was corrected.";
}

export async function applyReversal(originalTransactionId: string | mongoose.Types.ObjectId, input: ReversalInput) {
  await connectDB();
  const original = await DamruTransaction.findById(originalTransactionId);
  if (!original || original.type !== "credit" || original.amount <= 0) return { applied: false as const, unsupported: true as const };
  const directlySupported = DIRECT_ORDER_CATEGORIES.includes(original.category as (typeof DIRECT_ORDER_CATEGORIES)[number]) && Boolean(original.orderId);
  if (!directlySupported && !input.allowManualCredit) return { applied: false as const, unsupported: true as const };
  if ((input.reason === "ADMIN_CORRECTION" || input.reason === "OTHER") && !input.note?.trim()) {
    throw new Error("A note is required for this reversal reason.");
  }

  const reserved = await reserveReversal(original, input, original.amount);
  if (reserved.duplicate) return { applied: reserved.reversal.status === "APPLIED", duplicate: true as const, reversal: reserved.reversal };

  // Only what earlier reversals (from any trigger) have not already clawed back.
  const amount = await claimReversalHeadroom(original._id, original.amount);
  if (amount <= 0) {
    await RewardReversal.deleteOne({ _id: reserved.reversal._id, status: "RESERVED" });
    return { applied: false as const, alreadyReversed: true as const };
  }
  const { paisePerDamru: currentRate } = await getDamruConfig();

  let wallet: Awaited<ReturnType<typeof debitAvailableBalance>> | null = null;
  let debtAmount = 0;
  try {
    wallet = await debitAvailableBalance(original.userId, amount);
    debtAmount = amount - wallet.walletAmount;
    if (debtAmount > 0) await User.updateOne({ _id: original.userId }, { $inc: { rewardDebt: debtAmount } });

    const orderObjectId = (input.orderId || original.orderId) as mongoose.Types.ObjectId | undefined;
    const order = orderObjectId
      ? await Order.findById(orderObjectId).select("orderId").lean<{ orderId: string }>()
      : null;
    const description = customerDescription(input.reason, order?.orderId);
    const [transaction] = await DamruTransaction.create([{
      userId: original.userId,
      type: "debit",
      category: "reward_reversal",
      amount,
      balanceAfter: wallet.newBalance,
      description,
      idempotencyKey: `reward-reversal:${original._id}:${input.triggerId}`,
      // Valued at the rate the original credit was issued at, so issued − reversed stays consistent.
      ...valueSnapshot(amount, original.paisePerDamru ?? currentRate),
      orderId: orderObjectId,
      refundId: input.refundId,
      campaignId: original.campaignId,
      originalTransactionId: original._id,
      originalCategory: original.category,
      sourceType: input.refundId ? "PaymentRefund" : orderObjectId ? "Order" : "Admin",
      sourceId: input.triggerId,
      reversalReason: input.reason,
      reversalNote: input.note?.trim() || undefined,
      adjustedBy: input.createdBy,
      allocations: wallet.allocations.length ? wallet.allocations : undefined,
    }]);

    reserved.reversal.status = "APPLIED";
    reserved.reversal.partialAmount = amount;
    reserved.reversal.walletAmount = wallet.walletAmount;
    reserved.reversal.debtAmount = debtAmount;
    reserved.reversal.reversalTransactionId = transaction._id;
    await reserved.reversal.save();

    await notifyRewardEvent({
      userId: original.userId,
      type: "REWARD_ADJUSTED",
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount,
      orderNumber: order?.orderId,
      description: input.reason === "FRAUD_CONFIRMED" ? "A reward adjustment was made to your account." : description,
      route: "/my-profile?tab=rewards",
    });

    await evaluateRiskSafely("reward-reversal", () => Promise.all([
      evaluateRewardDebtRisk({
        userId: original.userId,
        sourceType: "RewardReversal",
        sourceId: String(reserved.reversal._id),
        transactionId: transaction._id,
      }),
      evaluateRewardReversalRisk({
        userId: original.userId,
        reversalId: reserved.reversal._id,
        transactionId: transaction._id,
      }),
    ]));

    return { applied: true as const, duplicate: false as const, reversal: reserved.reversal, transaction };
  } catch (error) {
    if (wallet?.walletAmount) await releaseAllocation(original.userId, wallet.allocations, wallet.walletAmount);
    if (debtAmount > 0) await User.updateOne({ _id: original.userId }, { $inc: { rewardDebt: -debtAmount } });
    await releaseReversalHeadroom(original._id, amount);
    await RewardReversal.deleteOne({ _id: reserved.reversal._id, status: "RESERVED" });
    throw error;
  }
}

/**
 * Applies a PARTIAL reversal against a single credit transaction.
 *
 * The caller is responsible for computing `partialAmount` using
 * `calculatePartialReversalAmount`. This function enforces:
 * - Idempotency: same (originalTransactionId, triggerId) never double-reverses.
 * - Ceiling: amount is clamped to remainingReversible at reserve time.
 * - Debt: any amount exceeding wallet balance becomes rewardDebt, same as
 *   a full reversal.
 */
export async function applyPartialReversal(
  originalTransactionId: string | mongoose.Types.ObjectId,
  partialAmount: number,
  input: ReversalInput
): Promise<{ applied: boolean; duplicate?: boolean; skipped?: boolean; reason?: string; reversal?: InstanceType<typeof RewardReversal>; transaction?: InstanceType<typeof DamruTransaction> }> {
  await connectDB();
  if (partialAmount <= 0) return { applied: false, skipped: true, reason: "zero_amount" };

  const original = await DamruTransaction.findById(originalTransactionId);
  if (!original || original.type !== "credit" || original.amount <= 0) return { applied: false, skipped: true, reason: "invalid_original" };

  const idempotencyKey = `reward-reversal:${original._id}:${input.triggerId}`;
  let reservedRecord: InstanceType<typeof RewardReversal> | null = null;
  let isDuplicate = false;
  try {
    reservedRecord = await RewardReversal.create({
      userId: original.userId,
      originalTransactionId: original._id,
      orderId: input.orderId || original.orderId,
      refundId: input.refundId,
      amount: original.amount,
      partialAmount,
      walletAmount: 0,
      debtAmount: 0,
      reason: input.reason,
      triggerId: input.triggerId,
      note: input.note?.trim() || undefined,
      status: "RESERVED",
      idempotencyKey,
      createdBy: input.createdBy,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await RewardReversal.findOne({ idempotencyKey });
    if (!existing) throw error;
    return { applied: existing.status === "APPLIED", duplicate: true, reversal: existing };
  }

  // Ceiling: atomically claim what is still reversible across ALL triggers.
  const clampedAmount = await claimReversalHeadroom(original._id, partialAmount);
  if (clampedAmount <= 0) {
    await RewardReversal.deleteOne({ _id: reservedRecord._id, status: "RESERVED" });
    return { applied: false, skipped: true, reason: "already_fully_reversed" };
  }
  const { paisePerDamru: currentRate } = await getDamruConfig();

  let wallet: Awaited<ReturnType<typeof debitAvailableBalance>> | null = null;
  let debtAmount = 0;
  try {
    wallet = await debitAvailableBalance(original.userId, clampedAmount);
    debtAmount = clampedAmount - wallet.walletAmount;
    if (debtAmount > 0) await User.updateOne({ _id: original.userId }, { $inc: { rewardDebt: debtAmount } });

    const orderObjectId = (input.orderId || original.orderId) as mongoose.Types.ObjectId | undefined;
    const order = orderObjectId
      ? await Order.findById(orderObjectId).select("orderId").lean<{ orderId: string }>()
      : null;
    const description = customerDescription(input.reason, order?.orderId);

    const [transaction] = await DamruTransaction.create([{
      userId: original.userId,
      type: "debit",
      category: "reward_reversal",
      amount: clampedAmount,
      balanceAfter: wallet.newBalance,
      description,
      idempotencyKey,
      ...valueSnapshot(clampedAmount, original.paisePerDamru ?? currentRate),
      orderId: orderObjectId,
      refundId: input.refundId,
      campaignId: original.campaignId,
      originalTransactionId: original._id,
      originalCategory: original.category,
      sourceType: input.refundId ? "PaymentRefund" : orderObjectId ? "Order" : "Admin",
      sourceId: input.triggerId,
      reversalReason: input.reason,
      reversalNote: input.note?.trim() || undefined,
      adjustedBy: input.createdBy,
      allocations: wallet.allocations.length ? wallet.allocations : undefined,
    }]);

    reservedRecord.status = "APPLIED";
    reservedRecord.partialAmount = clampedAmount;
    reservedRecord.walletAmount = wallet.walletAmount;
    reservedRecord.debtAmount = debtAmount;
    reservedRecord.reversalTransactionId = transaction._id;
    await reservedRecord.save();

    await notifyRewardEvent({
      userId: original.userId,
      type: "REWARD_ADJUSTED",
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount: clampedAmount,
      orderNumber: order?.orderId,
      description,
      route: "/my-profile?tab=rewards",
    });

    await evaluateRiskSafely("partial-reversal", () => Promise.all([
      evaluateRewardDebtRisk({ userId: original.userId, sourceType: "RewardReversal", sourceId: String(reservedRecord!._id), transactionId: transaction._id }),
      evaluateRewardReversalRisk({ userId: original.userId, reversalId: reservedRecord!._id, transactionId: transaction._id }),
    ]));

    isDuplicate = false;
    return { applied: true, duplicate: isDuplicate, reversal: reservedRecord, transaction };
  } catch (error) {
    if (wallet?.walletAmount) await releaseAllocation(original.userId, wallet.allocations, wallet.walletAmount);
    if (debtAmount > 0) await User.updateOne({ _id: original.userId }, { $inc: { rewardDebt: -debtAmount } });
    await releaseReversalHeadroom(original._id, clampedAmount);
    await RewardReversal.deleteOne({ _id: reservedRecord._id, status: "RESERVED" });
    throw error;
  }
}

export async function reverseOrderRewards(input: {
  orderId: string | mongoose.Types.ObjectId;
  reason: RewardReversalReason;
  triggerId: string;
  refundId?: string | mongoose.Types.ObjectId;
  createdBy?: string | mongoose.Types.ObjectId;
  note?: string;
}) {
  const originals = await findReversibleTransactions(input.orderId);
  const results = [];
  for (const original of originals) results.push(await applyReversal(original._id, input));
  return results;
}

export async function reverseCampaignRewards(orderId: string | mongoose.Types.ObjectId, input: Omit<ReversalInput, "orderId">) {
  const originals = await DamruTransaction.find({ orderId, type: "credit", category: "campaign", amount: { $gt: 0 } });
  const results = [];
  for (const original of originals) results.push(await applyReversal(original._id, { ...input, orderId }));
  return results;
}

export async function recoverRewardDebtFromCredit(transactionId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const credit = await DamruTransaction.findOne({ _id: transactionId, type: "credit" });
  if (!credit) return { recovered: 0 };
  const key = `reward-debt-recovery:${credit._id}`;
  if (await DamruTransaction.exists({ idempotencyKey: key })) return { recovered: 0, duplicate: true as const };

  for (let attempt = 0; attempt < 5; attempt++) {
    const user = await User.findById(credit.userId).select("rewardDebt damruBalance").lean<{ rewardDebt: number; damruBalance: number }>();
    if (!user || !user.rewardDebt) return { recovered: 0 };
    const recovery = Math.min(credit.amount, user.rewardDebt, user.damruBalance);
    if (recovery <= 0) return { recovered: 0 };
    let transaction;
    try {
      transaction = await DamruTransaction.create({
        userId: credit.userId,
        type: "debit",
        category: "reward_debt_recovery",
        amount: recovery,
        balanceAfter: 0,
        description: `${recovery} Damru used to settle a prior reward adjustment.`,
        idempotencyKey: key,
        ...valueSnapshot(recovery, credit.paisePerDamru ?? (await getDamruConfig()).paisePerDamru),
        originalTransactionId: credit._id,
        originalCategory: credit.category,
        sourceType: "DamruTransaction",
        sourceId: String(credit._id),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) return { recovered: 0, duplicate: true as const };
      throw error;
    }
    const updated = await User.findOneAndUpdate(
      { _id: credit.userId, rewardDebt: { $gte: recovery }, damruBalance: { $gte: recovery } },
      { $inc: { rewardDebt: -recovery, damruBalance: -recovery } },
      { new: true }
    );
    if (!updated) { await DamruTransaction.deleteOne({ _id: transaction._id }); continue; }
    const lot = await DamruTransaction.updateOne({ _id: credit._id, remainingAmount: { $gte: recovery } }, { $inc: { remainingAmount: -recovery } });
    if (!lot.modifiedCount) {
      await User.updateOne({ _id: credit.userId }, { $inc: { rewardDebt: recovery, damruBalance: recovery } });
      await DamruTransaction.deleteOne({ _id: transaction._id });
      return { recovered: 0, unsupported: true as const };
    }
    transaction.balanceAfter = updated.damruBalance;
    transaction.allocations = [{ creditTransactionId: credit._id, amount: recovery }];
    await transaction.save();
    return { recovered: recovery, newBalance: updated.damruBalance, transaction };
  }
  throw new Error("Reward debt changed repeatedly while applying a new reward.");
}
