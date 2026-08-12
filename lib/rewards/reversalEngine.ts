import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { allocateDebit, releaseAllocation } from "@/lib/rewards/damruAllocation";
import { notifyRewardEvent } from "@/lib/notifications/rewardNotificationService";
import DamruTransaction, { IDamruTransaction } from "@/models/DamruTransaction";
import Order from "@/models/Order";
import RewardReversal, { RewardReversalReason } from "@/models/RewardReversal";
import User from "@/models/User";
import { evaluateRewardDebtRisk, evaluateRewardReversalRisk, evaluateRiskSafely } from "@/lib/rewards/riskEngine";

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
  const [original, reversal] = await Promise.all([
    DamruTransaction.findById(originalTransactionId).select("type amount").lean<{ type: string; amount: number }>(),
    RewardReversal.findOne({ originalTransactionId }).select("amount status").lean<{ amount: number; status: string }>(),
  ]);
  if (!original || original.type !== "credit") return 0;
  return reversal ? Math.max(0, original.amount - reversal.amount) : original.amount;
}

export async function reserveReversal(original: IDamruTransaction, input: ReversalInput) {
  const idempotencyKey = `reward-reversal:${original._id}:${input.triggerId}`;
  try {
    const reversal = await RewardReversal.create({
      userId: original.userId,
      originalTransactionId: original._id,
      orderId: input.orderId || original.orderId,
      refundId: input.refundId,
      amount: original.amount,
      walletAmount: 0,
      debtAmount: 0,
      reason: input.reason,
      note: input.note?.trim() || undefined,
      status: "RESERVED",
      idempotencyKey,
      createdBy: input.createdBy,
    });
    return { reversal, duplicate: false as const };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const reversal = await RewardReversal.findOne({ originalTransactionId: original._id });
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

function legacyCustomerDescription(reason: RewardReversalReason, orderNumber?: string) {
  if (reason === "FULL_REFUND") return orderNumber ? `Reward Adjusted — Order #${orderNumber} was refunded.` : "Reward Adjusted — an order was refunded.";
  if (reason === "ORDER_CANCELLED") return orderNumber ? `Reward Adjusted — Order #${orderNumber} was cancelled.` : "Reward Adjusted — an order was cancelled.";
  if (reason === "PAYMENT_REVERSED") return orderNumber ? `Reward Adjusted — payment for Order #${orderNumber} was reversed.` : "Reward Adjusted — an order payment was reversed.";
  return "Reward Adjusted — an account reward was corrected.";
}

function customerDescription(reason: RewardReversalReason, orderNumber?: string) {
  if (reason === "FULL_REFUND") return orderNumber ? `Reward Adjusted - Order #${orderNumber} was refunded.` : "Reward Adjusted - an order was refunded.";
  if (reason === "ORDER_CANCELLED") return orderNumber ? `Reward Adjusted - Order #${orderNumber} was cancelled.` : "Reward Adjusted - an order was cancelled.";
  if (reason === "PAYMENT_REVERSED") return orderNumber ? `Reward Adjusted - payment for Order #${orderNumber} was reversed.` : "Reward Adjusted - an order payment was reversed.";
  return "Reward Adjusted - an account reward was corrected.";
}

void legacyCustomerDescription;

export async function applyReversal(originalTransactionId: string | mongoose.Types.ObjectId, input: ReversalInput) {
  await connectDB();
  const original = await DamruTransaction.findById(originalTransactionId);
  if (!original || original.type !== "credit" || original.amount <= 0) return { applied: false as const, unsupported: true as const };
  const directlySupported = DIRECT_ORDER_CATEGORIES.includes(original.category as (typeof DIRECT_ORDER_CATEGORIES)[number]) && Boolean(original.orderId);
  if (!directlySupported && !input.allowManualCredit) return { applied: false as const, unsupported: true as const };
  if ((input.reason === "ADMIN_CORRECTION" || input.reason === "OTHER") && !input.note?.trim()) {
    throw new Error("A note is required for this reversal reason.");
  }

  const reserved = await reserveReversal(original, input);
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
      idempotencyKey: `reward-reversal:${original._id}`,
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

export function calculatePostRefundEligibility() {
  return { supported: false as const, reason: "Partial reward reversal is disabled until a product policy is approved." };
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
