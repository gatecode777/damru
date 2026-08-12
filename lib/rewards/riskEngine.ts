import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import DamruTransaction from "@/models/DamruTransaction";
import Order from "@/models/Order";
import PaymentRefund from "@/models/PaymentRefund";
import Referral from "@/models/Referral";
import RewardCampaignUsage from "@/models/RewardCampaignUsage";
import RewardReversal from "@/models/RewardReversal";
import RewardRiskEvent, {
  IRewardRiskEvent,
  RewardRiskDecision,
  RewardRiskEventType,
  RewardRiskSeverity,
  RewardRiskStatus,
} from "@/models/RewardRiskEvent";
import User from "@/models/User";
import { getRewardRiskConfig, PROMOTIONAL_REWARD_CATEGORIES, RewardRiskConfigValues } from "@/lib/rewards/riskConfig";

const OPEN_STATUSES: RewardRiskStatus[] = ["OPEN", "UNDER_REVIEW"];

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function sinceDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function periodKey(windowHours: number, now = new Date()) {
  const windowMs = windowHours * 60 * 60 * 1000;
  return String(Math.floor(now.getTime() / windowMs));
}

function sum(rows: Array<{ amount?: number }>) {
  return rows.reduce((total, row) => total + Math.max(0, Number(row.amount) || 0), 0);
}

export function calculateRiskScore(points: number[]) {
  return Math.max(0, Math.min(100, Math.round(points.reduce((total, value) => total + Math.max(0, value || 0), 0))));
}

export function classifyRiskScore(score: number, thresholds: RewardRiskConfigValues["scoring"] = { medium: 30, high: 60, critical: 80 }): RewardRiskSeverity {
  if (score >= thresholds.critical) return "CRITICAL";
  if (score >= thresholds.high) return "HIGH";
  if (score >= thresholds.medium) return "MEDIUM";
  return "LOW";
}

export interface CreateRiskEventInput {
  userId: string | mongoose.Types.ObjectId;
  eventType: RewardRiskEventType;
  ruleCode: string;
  periodKey: string;
  score: number;
  reasons: string[];
  sourceType: string;
  sourceId: string;
  orderId?: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
  referralId?: string | mongoose.Types.ObjectId;
  campaignId?: string | mongoose.Types.ObjectId;
  refundId?: string | mongoose.Types.ObjectId;
  reversalId?: string | mongoose.Types.ObjectId;
  actingAdminId?: string | mongoose.Types.ObjectId;
  relatedAmount?: number;
  metadata?: Record<string, unknown>;
}

export async function createRiskEvent(input: CreateRiskEventInput) {
  await connectDB();
  const score = calculateRiskScore([input.score]);
  const config = await getRewardRiskConfig();
  const now = new Date();
  const dedupeKey = `risk:${input.ruleCode}:${input.userId}:${input.periodKey}`;
  return RewardRiskEvent.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        userId: input.userId,
        eventType: input.eventType,
        ruleCode: input.ruleCode,
        dedupeKey,
        status: "OPEN",
        detectedAt: now,
        reviewDecision: "NONE",
      },
      $set: {
        severity: classifyRiskScore(score, config.scoring),
        score,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        orderId: input.orderId,
        transactionId: input.transactionId,
        referralId: input.referralId,
        campaignId: input.campaignId,
        refundId: input.refundId,
        reversalId: input.reversalId,
        actingAdminId: input.actingAdminId,
        reasons: input.reasons.slice(0, 12),
        relatedAmount: Math.max(0, input.relatedAmount || 0),
        metadata: input.metadata,
        lastDetectedAt: now,
      },
      $inc: { occurrenceCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: false }
  );
}

export async function evaluateRewardRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
  sourceType?: string;
  sourceId?: string;
}) {
  await connectDB();
  const riskConfig = await getRewardRiskConfig();
  const start = sinceHours(riskConfig.earningVelocity.windowHours);
  const [credits, sourceTransaction] = await Promise.all([
    DamruTransaction.find({
      userId: input.userId,
      type: "credit",
      createdAt: { $gte: start },
      category: { $nin: ["refund_restore", "legacy_opening_balance"] },
    }).select("amount category").lean<Array<{ amount: number; category: string }>>(),
    input.transactionId
      ? DamruTransaction.findById(input.transactionId).select("category campaignId sourceId").lean<{ category: string; campaignId?: mongoose.Types.ObjectId; sourceId?: string }>()
      : Promise.resolve(null),
  ]);
  const total = sum(credits);
  const promotional = sum(credits.filter(row => PROMOTIONAL_REWARD_CATEGORIES.includes(row.category as (typeof PROMOTIONAL_REWARD_CATEGORIES)[number])));
  const config = riskConfig.earningVelocity;
  const events: IRewardRiskEvent[] = [];

  if (total >= config.minimumTotalDamru && (credits.length >= config.minimumTransactionCount || promotional >= config.promotionalDamru)) {
    const points = [35, credits.length >= config.minimumTransactionCount ? 20 : 0, promotional >= config.promotionalDamru ? 20 : 0, total >= config.minimumTotalDamru * 2 ? 15 : 0];
    events.push(await createRiskEvent({
      userId: input.userId,
      eventType: "REWARD_EARNING_VELOCITY",
      ruleCode: "EARNING_VELOCITY_24H",
      periodKey: periodKey(config.windowHours),
      score: calculateRiskScore(points),
      reasons: [
        `${total} Damru earned in ${config.windowHours} hours.`,
        `${credits.length} reward credits were recorded.`,
        `${promotional} Damru came from promotional sources.`,
      ],
      sourceType: input.sourceType || "DamruTransaction",
      sourceId: input.sourceId || String(input.transactionId || input.userId),
      transactionId: input.transactionId,
      relatedAmount: total,
      metadata: { windowHours: config.windowHours, transactionCount: credits.length, promotionalAmount: promotional },
    }));
  }

  const debtEvent = await evaluateRewardDebtRisk({ userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId, transactionId: input.transactionId });
  if (debtEvent) events.push(debtEvent);
  if (sourceTransaction?.category === "campaign") {
    const campaignEvent = await evaluateCampaignRisk({
      userId: input.userId,
      campaignId: sourceTransaction.campaignId,
      sourceId: input.sourceId || sourceTransaction.sourceId || String(input.transactionId),
    });
    if (campaignEvent) events.push(campaignEvent);
  }
  if (sourceTransaction?.category === "referral") {
    const referralEvent = await evaluateReferralRisk({ userId: input.userId });
    if (referralEvent) events.push(referralEvent);
  }
  if (sourceTransaction?.category === "mission") {
    const missionEvent = await evaluateMissionRisk({ userId: input.userId, transactionId: input.transactionId });
    if (missionEvent) events.push(missionEvent);
  }
  return events;
}

export async function evaluateRedemptionRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
  orderId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).redemptionVelocity;
  const start = sinceHours(config.windowHours);
  const [redemptions, recentPromo] = await Promise.all([
    DamruTransaction.find({ userId: input.userId, category: "redemption", createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    DamruTransaction.exists({ userId: input.userId, type: "credit", category: { $in: PROMOTIONAL_REWARD_CATEGORIES }, createdAt: { $gte: sinceHours(config.recentPromotionalWindowHours) } }),
  ]);
  const total = sum(redemptions);
  if (redemptions.length < config.minimumTransactionCount && !(redemptions.length >= 2 && total >= config.minimumTotalDamru)) return null;
  const score = calculateRiskScore([35, redemptions.length >= config.minimumTransactionCount ? 20 : 0, total >= config.minimumTotalDamru ? 20 : 0, recentPromo ? 15 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "REDEMPTION_VELOCITY",
    ruleCode: "REDEMPTION_VELOCITY_1H",
    periodKey: periodKey(config.windowHours),
    score,
    reasons: [`${total} Damru redeemed in ${config.windowHours} hour.`, `${redemptions.length} redemption transactions were recorded.`, ...(recentPromo ? ["A recent promotional reward preceded redemption."] : [])],
    sourceType: "DamruTransaction",
    sourceId: String(input.transactionId || input.userId),
    transactionId: input.transactionId,
    orderId: input.orderId,
    relatedAmount: total,
    metadata: { windowHours: config.windowHours, redemptionCount: redemptions.length, recentPromotionalCredit: Boolean(recentPromo) },
  });
}

async function evaluateEarnRedeemRefundRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  refundId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
  orderCount: number;
  refundCount: number;
  refundAmount: number;
  reversalCount: number;
  reversalAmount: number;
  earnedAmount: number;
  redemptionAmount: number;
  rewardDebt: number;
  config: RewardRiskConfigValues;
}) {
  const config = input.config.earnRedeemRefund;
  if (
    input.refundCount < config.minimumRefundCount ||
    input.reversalCount < config.minimumReversalCount ||
    input.redemptionAmount < config.minimumRedemptionAmount
  ) return null;
  const score = calculateRiskScore([
    45,
    input.refundCount >= config.minimumRefundCount * 2 ? 10 : 0,
    input.reversalAmount > 0 ? 15 : 0,
    input.redemptionAmount >= config.minimumRedemptionAmount ? 15 : 0,
    input.rewardDebt > 0 ? 10 : 0,
  ]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "EARN_REDEEM_REFUND_ABUSE",
    ruleCode: "EARN_REDEEM_REFUND_30D",
    periodKey: periodKey(24),
    score,
    reasons: [
      `${input.refundCount} processed refunds followed reward activity in ${config.windowDays} days.`,
      `${input.earnedAmount} Damru was earned, ${input.redemptionAmount} redeemed, and ${input.reversalAmount} reversed in the same bounded period.`,
      ...(input.rewardDebt > 0 ? [`The sequence resulted in ${input.rewardDebt} Damru of reward debt.`] : []),
    ],
    sourceType: "PaymentRefund",
    sourceId: String(input.refundId),
    refundId: input.refundId,
    orderId: input.orderId,
    relatedAmount: input.reversalAmount,
    metadata: {
      windowDays: config.windowDays,
      orderCount: input.orderCount,
      refundCount: input.refundCount,
      refundAmount: input.refundAmount,
      reversalCount: input.reversalCount,
      reversalAmount: input.reversalAmount,
      earnedAmount: input.earnedAmount,
      redemptionAmount: input.redemptionAmount,
      rewardDebt: input.rewardDebt,
    },
  });
}

export async function evaluateRefundRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  refundId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const riskConfig = await getRewardRiskConfig();
  const config = riskConfig.refunds;
  const start = sinceDays(config.windowDays);
  const orders = await Order.find({
    userId: input.userId,
    status: "delivered",
    paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] },
    createdAt: { $gte: start },
  }).select("_id").lean<Array<{ _id: mongoose.Types.ObjectId }>>();
  const orderIds = orders.map(order => order._id);
  const [refunds, reversals, redemptions, earnings, user] = await Promise.all([
    PaymentRefund.find({ orderId: { $in: orderIds }, status: "processed", processedAt: { $gte: start } }).select("orderId amount").lean<Array<{ orderId: mongoose.Types.ObjectId; amount: number }>>(),
    RewardReversal.find({ userId: input.userId, status: "APPLIED", createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    DamruTransaction.find({ userId: input.userId, category: "redemption", createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    DamruTransaction.find({ userId: input.userId, type: "credit", category: { $nin: ["refund_restore", "legacy_opening_balance"] }, createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    User.findById(input.userId).select("rewardDebt").lean<{ rewardDebt: number }>(),
  ]);
  const refundedOrders = new Set(refunds.map(row => String(row.orderId))).size;
  const ratio = refundedOrders / orders.length;
  const refundAmount = sum(refunds);
  const reversalAmount = sum(reversals);
  const redemptionAmount = sum(redemptions);
  const earnedAmount = sum(earnings);
  await evaluateEarnRedeemRefundRisk({
    userId: input.userId,
    refundId: input.refundId,
    orderId: input.orderId,
    orderCount: orders.length,
    refundCount: refundedOrders,
    refundAmount,
    reversalCount: reversals.length,
    reversalAmount,
    earnedAmount,
    redemptionAmount,
    rewardDebt: user?.rewardDebt || 0,
    config: riskConfig,
  });
  if (orders.length < config.minimumOrderCount || ratio < config.ratio || refundAmount < config.minimumRefundedAmount) return null;
  const score = calculateRiskScore([40, ratio >= 0.75 ? 15 : 0, reversalAmount > 0 ? 15 : 0, redemptionAmount > 0 ? 15 : 0, (user?.rewardDebt || 0) > 0 ? 10 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "REFUND_ABUSE",
    ruleCode: "REFUND_RATIO_30D",
    periodKey: periodKey(24),
    score,
    reasons: [`${refundedOrders} of ${orders.length} recent orders were refunded.`, `Refunded value in the window is Rs ${refundAmount}.`, ...(reversalAmount ? [`${reversalAmount} Damru was reversed.`] : []), ...(redemptionAmount ? [`${redemptionAmount} Damru was redeemed in the same period.`] : [])],
    sourceType: "PaymentRefund",
    sourceId: String(input.refundId),
    refundId: input.refundId,
    orderId: input.orderId,
    relatedAmount: reversalAmount,
    metadata: { windowDays: config.windowDays, orderCount: orders.length, refundedOrders, refundRatio: ratio, refundAmount, reversalAmount, redemptionAmount, rewardDebt: user?.rewardDebt || 0 },
  });
}

export async function evaluateOrderRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).cancellations;
  const start = sinceDays(config.windowDays);
  const [totalOrders, cancelledOrders, reversalRows] = await Promise.all([
    Order.countDocuments({ userId: input.userId, createdAt: { $gte: start } }),
    Order.countDocuments({ userId: input.userId, status: "cancelled", createdAt: { $gte: start } }),
    RewardReversal.find({ userId: input.userId, reason: "ORDER_CANCELLED", createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
  ]);
  if (totalOrders < config.minimumOrderCount || cancelledOrders / totalOrders < config.ratio) return null;
  const reversalAmount = sum(reversalRows);
  const score = calculateRiskScore([35, cancelledOrders >= 5 ? 15 : 0, reversalRows.length >= 2 ? 20 : 0, reversalAmount >= 500 ? 10 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "CANCELLATION_ABUSE",
    ruleCode: "CANCELLATION_RATIO_30D",
    periodKey: periodKey(24),
    score,
    reasons: [`${cancelledOrders} of ${totalOrders} recent orders were cancelled.`, ...(reversalRows.length ? [`${reversalRows.length} cancelled orders had reward reversals.`] : [])],
    sourceType: "Order",
    sourceId: String(input.orderId),
    orderId: input.orderId,
    relatedAmount: reversalAmount,
    metadata: { windowDays: config.windowDays, totalOrders, cancelledOrders, cancellationRatio: cancelledOrders / totalOrders, reversalCount: reversalRows.length },
  });
}

export async function evaluateRewardDebtRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  sourceType?: string;
  sourceId?: string;
  transactionId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).rewardDebt;
  const [user, reversalRows] = await Promise.all([
    User.findById(input.userId).select("rewardDebt").lean<{ rewardDebt: number }>(),
    RewardReversal.find({ userId: input.userId, status: "APPLIED", createdAt: { $gte: sinceDays(30) } }).select("amount debtAmount").lean<Array<{ amount: number; debtAmount: number }>>(),
  ]);
  const debt = Math.max(0, user?.rewardDebt || 0);
  if (debt < config.amount && !(debt > 0 && reversalRows.length >= config.reversalCount30Days)) return null;
  const score = calculateRiskScore([45, debt >= config.amount * 2 ? 20 : 0, reversalRows.length >= config.reversalCount30Days ? 20 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "REWARD_DEBT",
    ruleCode: "REWARD_DEBT_30D",
    periodKey: periodKey(24),
    score,
    reasons: [`Outstanding reward debt is ${debt} Damru.`, `${reversalRows.length} reward reversals were recorded in 30 days.`],
    sourceType: input.sourceType || "User",
    sourceId: input.sourceId || String(input.userId),
    transactionId: input.transactionId,
    relatedAmount: debt,
    metadata: { debt, reversalCount: reversalRows.length, reversalAmount: sum(reversalRows) },
  });
}

export async function evaluateRewardReversalRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  reversalId: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).reversals;
  const start = sinceDays(config.windowDays);
  const [reversals, credits] = await Promise.all([
    RewardReversal.find({ userId: input.userId, status: "APPLIED", createdAt: { $gte: start } })
      .select("amount reason debtAmount").lean<Array<{ amount: number; reason: string; debtAmount: number }>>(),
    DamruTransaction.find({
      userId: input.userId,
      type: "credit",
      category: { $nin: ["refund_restore", "legacy_opening_balance"] },
      createdAt: { $gte: start },
    }).select("amount").lean<Array<{ amount: number }>>(),
  ]);
  const reversalAmount = sum(reversals);
  const issuedAmount = sum(credits);
  const issuedRatio = issuedAmount > 0 ? reversalAmount / issuedAmount : 0;
  if (
    reversals.length < config.minimumCount &&
    reversalAmount < config.minimumAmount &&
    !(issuedAmount >= config.minimumIssuedAmount && issuedRatio >= config.issuedRatio)
  ) return null;
  const distinctReasons = new Set(reversals.map(row => row.reason)).size;
  const debtCreated = reversals.reduce((total, row) => total + Math.max(0, Number(row.debtAmount) || 0), 0);
  const score = calculateRiskScore([
    reversals.length >= config.minimumCount ? 35 : 0,
    reversalAmount >= config.minimumAmount ? 25 : 0,
    issuedAmount >= config.minimumIssuedAmount && issuedRatio >= config.issuedRatio ? 20 : 0,
    debtCreated > 0 ? 10 : 0,
    distinctReasons > 1 ? 5 : 0,
  ]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "REWARD_REVERSAL_FREQUENCY",
    ruleCode: "REVERSAL_FREQUENCY_30D",
    periodKey: periodKey(24),
    score,
    reasons: [
      `${reversals.length} reward reversals were applied in ${config.windowDays} days.`,
      `${reversalAmount} Damru was reversed from ${issuedAmount} Damru issued in the period.`,
      ...(debtCreated > 0 ? [`${debtCreated} Damru of debt was created by these reversals.`] : []),
    ],
    sourceType: "RewardReversal",
    sourceId: String(input.reversalId),
    reversalId: input.reversalId,
    transactionId: input.transactionId,
    relatedAmount: reversalAmount,
    metadata: { windowDays: config.windowDays, reversalCount: reversals.length, reversalAmount, issuedAmount, issuedRatio, distinctReasons, debtCreated },
  });
}

export async function evaluateReferralRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  referralId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).referrals;
  const start = sinceDays(config.windowDays);
  const [created, qualified] = await Promise.all([
    Referral.countDocuments({ referrerUserId: input.userId, createdAt: { $gte: start } }),
    Referral.countDocuments({ referrerUserId: input.userId, status: { $in: ["QUALIFIED", "REWARDED"] }, qualifiedAt: { $gte: start } }),
  ]);
  if (created < config.createdCount && qualified < config.qualifiedCount) return null;
  const score = calculateRiskScore([created >= config.createdCount ? 45 : 0, qualified >= config.qualifiedCount ? 30 : 0, created >= config.createdCount * 2 ? 15 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "REFERRAL_FARMING",
    ruleCode: "REFERRAL_VELOCITY_7D",
    periodKey: periodKey(24),
    score,
    reasons: [`${created} referral relationships were created in ${config.windowDays} days.`, `${qualified} referrals qualified or were rewarded in the same window.`],
    sourceType: "Referral",
    sourceId: String(input.referralId || input.userId),
    referralId: input.referralId,
    metadata: { windowDays: config.windowDays, created, qualified },
  });
}

export async function evaluateCampaignRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  campaignId?: string | mongoose.Types.ObjectId;
  sourceId: string;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).campaigns;
  const start = sinceHours(config.windowHours);
  const [usageCount, rewards, reversalCount] = await Promise.all([
    RewardCampaignUsage.countDocuments({ userId: input.userId, status: { $in: ["RESERVED", "AWARDED"] }, createdAt: { $gte: start } }),
    DamruTransaction.find({ userId: input.userId, category: "campaign", createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    RewardReversal.countDocuments({ userId: input.userId, status: "APPLIED", createdAt: { $gte: start }, originalTransactionId: { $in: await DamruTransaction.find({ userId: input.userId, category: "campaign", createdAt: { $gte: start } }).distinct("_id") } }),
  ]);
  const rewardAmount = sum(rewards);
  if (usageCount < config.usageCount && rewardAmount < config.rewardAmount && reversalCount < config.reversalCount) return null;
  const score = calculateRiskScore([usageCount >= config.usageCount ? 35 : 0, rewardAmount >= config.rewardAmount ? 30 : 0, reversalCount >= config.reversalCount ? 25 : 0, usageCount >= config.usageCount * 2 ? 10 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "CAMPAIGN_ABUSE",
    ruleCode: "CAMPAIGN_VELOCITY_24H",
    periodKey: periodKey(config.windowHours),
    score,
    reasons: [`${usageCount} campaign awards were recorded in ${config.windowHours} hours.`, `${rewardAmount} promotional Damru was issued.`, ...(reversalCount ? [`${reversalCount} campaign rewards were reversed.`] : [])],
    sourceType: "RewardCampaign",
    sourceId: input.sourceId,
    campaignId: input.campaignId,
    relatedAmount: rewardAmount,
    metadata: { windowHours: config.windowHours, usageCount, rewardAmount, reversalCount },
  });
}

export async function evaluateMissionRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).missions;
  const rows = await DamruTransaction.find({ userId: input.userId, category: "mission", createdAt: { $gte: sinceHours(config.windowHours) } }).select("amount").lean<Array<{ amount: number }>>();
  const amount = sum(rows);
  if (rows.length < config.completionCount && amount < config.rewardAmount) return null;
  const score = calculateRiskScore([rows.length >= config.completionCount ? 40 : 0, amount >= config.rewardAmount ? 30 : 0, rows.length >= config.completionCount * 2 ? 15 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "MISSION_VELOCITY",
    ruleCode: "MISSION_COMPLETION_24H",
    periodKey: periodKey(config.windowHours),
    score,
    reasons: [`${rows.length} mission rewards were issued in ${config.windowHours} hours.`, `${amount} Damru was issued from missions.`],
    sourceType: "DamruTransaction",
    sourceId: String(input.transactionId || input.userId),
    transactionId: input.transactionId,
    relatedAmount: amount,
    metadata: { windowHours: config.windowHours, completionCount: rows.length, rewardAmount: amount },
  });
}

export async function evaluateAdminAdjustmentRisk(input: {
  userId: string | mongoose.Types.ObjectId;
  transactionId: string | mongoose.Types.ObjectId;
  adminId?: string | mongoose.Types.ObjectId;
}) {
  await connectDB();
  const config = (await getRewardRiskConfig()).adminAdjustments;
  const start = sinceHours(config.windowHours);
  const [userRows, adminCount] = await Promise.all([
    DamruTransaction.find({ userId: input.userId, category: { $in: ["admin_credit", "admin_debit"] }, createdAt: { $gte: start } }).select("amount").lean<Array<{ amount: number }>>(),
    input.adminId ? DamruTransaction.countDocuments({ adjustedBy: input.adminId, category: { $in: ["admin_credit", "admin_debit"] }, createdAt: { $gte: start } }) : Promise.resolve(0),
  ]);
  const amount = sum(userRows);
  if (userRows.length < config.perUserCount && amount < config.perUserAmount && adminCount < config.perAdminCount) return null;
  const score = calculateRiskScore([userRows.length >= config.perUserCount ? 35 : 0, amount >= config.perUserAmount ? 30 : 0, adminCount >= config.perAdminCount ? 25 : 0]);
  return createRiskEvent({
    userId: input.userId,
    eventType: "ADMIN_ADJUSTMENT",
    ruleCode: "ADMIN_ADJUSTMENT_24H",
    periodKey: periodKey(config.windowHours),
    score,
    reasons: [`${userRows.length} manual adjustments affected this user in ${config.windowHours} hours.`, `Total adjusted amount is ${amount} Damru.`, ...(adminCount ? [`The administrator made ${adminCount} adjustments in the window.`] : [])],
    sourceType: "DamruTransaction",
    sourceId: String(input.transactionId),
    transactionId: input.transactionId,
    actingAdminId: input.adminId,
    relatedAmount: amount,
    metadata: { windowHours: config.windowHours, userAdjustmentCount: userRows.length, adminAdjustmentCount: adminCount },
  });
}

export async function getUserRiskSummary(userId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const [events, openAlertCount, criticalAlertCount, user, reversals, orders, refundedOrders, referrals, campaignEvents, config] = await Promise.all([
    RewardRiskEvent.find({ userId, status: { $in: OPEN_STATUSES } }).sort({ score: -1, detectedAt: -1 }).limit(20).lean(),
    RewardRiskEvent.countDocuments({ userId, status: { $in: OPEN_STATUSES } }),
    RewardRiskEvent.countDocuments({ userId, status: { $in: OPEN_STATUSES }, severity: "CRITICAL" }),
    User.findById(userId).select("rewardDebt").lean<{ rewardDebt: number }>(),
    RewardReversal.countDocuments({ userId, status: "APPLIED", createdAt: { $gte: sinceDays(30) } }),
    Order.countDocuments({ userId, createdAt: { $gte: sinceDays(30) } }),
    Order.countDocuments({ userId, paymentStatus: { $in: ["partially_refunded", "refunded"] }, createdAt: { $gte: sinceDays(30) } }),
    RewardRiskEvent.countDocuments({ userId, eventType: "REFERRAL_FARMING", status: { $in: OPEN_STATUSES } }),
    RewardRiskEvent.countDocuments({ userId, eventType: "CAMPAIGN_ABUSE", status: { $in: OPEN_STATUSES } }),
    getRewardRiskConfig(),
  ]);
  const topScore = events[0]?.score || 0;
  const score = calculateRiskScore([topScore, Math.min(15, Math.max(0, events.length - 1) * 5)]);
  return {
    score,
    severity: classifyRiskScore(score, config.scoring),
    openAlerts: openAlertCount,
    criticalAlerts: criticalAlertCount,
    lastRiskEvent: events.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0]?.detectedAt || null,
    rewardDebt: user?.rewardDebt || 0,
    reversalCount: reversals,
    refundRatio: orders ? refundedOrders / orders : 0,
    referralRisk: referrals > 0,
    campaignRisk: campaignEvents > 0,
  };
}

export type RiskReviewAction = "UNDER_REVIEW" | "MONITOR" | "RESOLVE_LEGITIMATE" | "RESOLVE_ABUSE" | "RESOLVE_NO_ACTION" | "DISMISS";

export async function resolveRiskEvent(input: {
  eventId: string | mongoose.Types.ObjectId;
  action: RiskReviewAction;
  reviewedBy: string | mongoose.Types.ObjectId;
  note?: string;
}) {
  await connectDB();
  const existing = await RewardRiskEvent.findById(input.eventId);
  if (!existing) return null;
  const previousStatus = existing.status;
  let status: RewardRiskStatus;
  let decision: RewardRiskDecision;
  if (input.action === "UNDER_REVIEW") { status = "UNDER_REVIEW"; decision = "NONE"; }
  else if (input.action === "MONITOR") { status = "UNDER_REVIEW"; decision = "MONITOR"; }
  else if (input.action === "RESOLVE_LEGITIMATE") { status = "RESOLVED"; decision = "LEGITIMATE"; }
  else if (input.action === "RESOLVE_ABUSE") { status = "RESOLVED"; decision = "ABUSE_CONFIRMED"; }
  else if (input.action === "RESOLVE_NO_ACTION") { status = "RESOLVED"; decision = "NO_ACTION"; }
  else { status = "DISMISSED"; decision = "DISMISSED"; }
  if (previousStatus === "RESOLVED" || previousStatus === "DISMISSED") throw new Error("This risk event has already been closed.");
  const updated = await RewardRiskEvent.findOneAndUpdate(
    { _id: existing._id, status: previousStatus },
    { $set: { status, reviewDecision: decision, reviewNote: input.note?.trim() || undefined, reviewedBy: input.reviewedBy, reviewedAt: new Date() } },
    { new: true }
  );
  return updated ? { event: updated, previousStatus } : null;
}

export async function evaluateRiskSafely(label: string, evaluation: () => Promise<unknown>) {
  try {
    await evaluation();
  } catch (error) {
    console.error(`Reward risk evaluation failed (${label}):`, error);
  }
}
