import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { allocateDebit, releaseAllocation } from "@/lib/rewards/damruAllocation";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";
import DamruTransaction, { IDamruTransaction } from "@/models/DamruTransaction";
import Order from "@/models/Order";
import RewardReversal, { RewardReversalReason } from "@/models/RewardReversal";
import User from "@/models/User";
import { evaluateRewardDebtRisk, evaluateRewardReversalRisk, evaluateRiskSafely } from "@/lib/rewards/riskEngine";

// Order-linked categories that are directly reversible by the order reversal
// pipeline. "referral", "mission", and "achievement" are intentionally absent
// here — those are reversed by their own domain engines (referralEngine,
// missionEngine, achievementEngine) which call applyReversal with
// allowManualCredit: true.
const DIRECT_ORDER_CATEGORIES = ["order_reward", "first_order", "campaign"] as const;

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
  }).select("partialAmount").lean<Array<{ partialAmount: number }>>();
  return rows.reduce((sum, r) => sum + (r.partialAmount || 0), 0);
}

/**
 * Computes the additional reversal amount warranted by a partial refund.
 *
 * Policy: the Damru reward is proportional to the eligible order amount,
 * floored to the nearest integer per the same rule as the award:
 *   reward = floor(eligibleAmount / 10)
 *
 * For campaign rewards (FIXED_DAMRU mode): the full original reward is
 * reversed regardless of refund fraction. For percentage/multiplier campaigns:
 * reapply the formula against the remaining eligible amount using the stored
 * campaignSnapshot.
 *
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
}): { targetTotalReversal: number; additionalReversal: number } {
  const {
    originalEligibleAmount,
    originalReward,
    refundedAmount,
    paymentAmount,
    alreadyReversed,
    campaignSnapshot,
  } = input;

  if (paymentAmount <= 0 || originalEligibleAmount <= 0) {
    return { targetTotalReversal: originalReward, additionalReversal: Math.max(0, originalReward - alreadyReversed) };
  }

  // Remaining eligible after all processed refunds.
  const refundFraction = Math.min(1, Math.max(0, refundedAmount / paymentAmount));
  const refundedEligible = Math.round(originalEligibleAmount * refundFraction);
  const remainingEligible = Math.max(0, originalEligibleAmount - refundedEligible);

  let targetReward: number;

  if (campaignSnapshot) {
    const mode = campaignSnapshot.rewardMode as string | undefined;
    if (mode === "FIXED_DAMRU") {
      // Fixed campaign bonus: fully reverse when the trigger order is refunded.
      targetReward = 0;
    } else if (mode === "PERCENT_BONUS") {
      const value = Number(campaignSnapshot.rewardValue) || 0;
      targetReward = Math.floor(remainingEligible * (value / 100));
    } else {
      // MULTIPLIER or unknown: scale proportionally with eligible amount.
      targetReward = Math.floor((remainingEligible / originalEligibleAmount) * originalReward);
    }
  } else {
    // Standard order reward: floor(eligibleAmount / 10).
    targetReward = Math.floor(remainingEligible / 10);
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

  let wallet: Awaited<ReturnType<typeof debitAvailableBalance>> | null = null;
  let debtAmount = 0;
  try {
    wallet = await debitAvailableBalance(original.userId, original.amount);
    debtAmount = original.amount - wallet.walletAmount;
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
      amount: original.amount,
      balanceAfter: wallet.newBalance,
      description,
      idempotencyKey: `reward-reversal:${original._id}:${input.triggerId}`,
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
    reserved.reversal.walletAmount = wallet.walletAmount;
    reserved.reversal.debtAmount = debtAmount;
    reserved.reversal.reversalTransactionId = transaction._id;
    await reserved.reversal.save();

    await notifyRewardEvent({
      userId: original.userId,
      type: "REWARD_ADJUSTED",
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount: original.amount,
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

  // Compute remaining reversible headroom.
  const alreadyReversed = await getTotalReversedAmount(originalTransactionId);
  const remaining = Math.max(0, original.amount - alreadyReversed);
  if (remaining <= 0) return { applied: false, skipped: true, reason: "already_fully_reversed" };

  const clampedAmount = Math.min(partialAmount, remaining);

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
      partialAmount: clampedAmount,
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
