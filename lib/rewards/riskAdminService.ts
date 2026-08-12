import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import DamruTransaction from "@/models/DamruTransaction";
import Order from "@/models/Order";
import PaymentRefund from "@/models/PaymentRefund";
import Referral from "@/models/Referral";
import RewardCampaignUsage from "@/models/RewardCampaignUsage";
import RewardReversal from "@/models/RewardReversal";
import RewardRiskEvent, { REWARD_RISK_EVENT_TYPES, REWARD_RISK_SEVERITIES, REWARD_RISK_STATUSES } from "@/models/RewardRiskEvent";
import User from "@/models/User";
import { getUserRiskSummary } from "@/lib/rewards/riskEngine";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface RiskListInput {
  page?: number;
  limit?: number;
  severity?: string | null;
  status?: string | null;
  eventType?: string | null;
  minScore?: number;
  maxScore?: number;
  start?: string | null;
  end?: string | null;
  search?: string | null;
}

export async function getRiskAnalytics() {
  await connectDB();
  const openStatuses = ["OPEN", "UNDER_REVIEW"];
  const activeFilter = { status: { $in: openStatuses } };
  const [openEvents, criticalAlerts, highCriticalEvents, highRiskUserRows, active] = await Promise.all([
    RewardRiskEvent.countDocuments(activeFilter),
    RewardRiskEvent.countDocuments({ ...activeFilter, severity: "CRITICAL" }),
    RewardRiskEvent.countDocuments({ ...activeFilter, severity: { $in: ["HIGH", "CRITICAL"] } }),
    RewardRiskEvent.aggregate([{ $match: { ...activeFilter, severity: { $in: ["HIGH", "CRITICAL"] } } }, { $group: { _id: "$userId" } }, { $count: "count" }]),
    RewardRiskEvent.find(activeFilter).select("userId severity relatedAmount eventType").sort({ detectedAt: -1 }).limit(5000).lean(),
  ]);
  const userIds = [...new Set(active.map(event => String(event.userId)))].map(id => new mongoose.Types.ObjectId(id));
  const [debtRows, reversalRows] = userIds.length ? await Promise.all([
    User.find({ _id: { $in: userIds }, rewardDebt: { $gt: 0 } }).select("rewardDebt").lean<Array<{ rewardDebt: number }>>(),
    RewardReversal.find({ userId: { $in: userIds }, status: "APPLIED", createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }).select("amount").lean<Array<{ amount: number }>>(),
  ]) : [[], []];
  const count = (eventType: string) => active.filter(event => event.eventType === eventType).length;
  return {
    openEvents,
    criticalAlerts,
    highCriticalEvents,
    highRiskUsers: Number(highRiskUserRows[0]?.count || 0),
    damruAssociatedWithRisk: active.reduce((total, event) => total + Math.max(0, event.relatedAmount || 0), 0),
    reversedDamruAssociatedWithRisk: reversalRows.reduce((total, row) => total + Math.max(0, row.amount || 0), 0),
    rewardDebtAtRisk: debtRows.reduce((total, row) => total + Math.max(0, row.rewardDebt || 0), 0),
    refundAbuseAlerts: count("REFUND_ABUSE"),
    referralAlerts: count("REFERRAL_FARMING"),
    campaignAlerts: count("CAMPAIGN_ABUSE"),
    analyticsTruncated: openEvents > active.length,
  };
}

export async function listRiskEvents(input: RiskListInput) {
  await connectDB();
  const page = Math.max(1, Math.floor(input.page || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(input.limit || 20)));
  const filter: Record<string, unknown> = {};
  if (input.severity && REWARD_RISK_SEVERITIES.includes(input.severity as never)) filter.severity = input.severity;
  if (input.status && REWARD_RISK_STATUSES.includes(input.status as never)) filter.status = input.status;
  if (input.eventType && REWARD_RISK_EVENT_TYPES.includes(input.eventType as never)) filter.eventType = input.eventType;
  if (Number.isFinite(input.minScore) || Number.isFinite(input.maxScore)) {
    const scoreFilter: { $gte?: number; $lte?: number } = {};
    if (Number.isFinite(input.minScore)) scoreFilter.$gte = Math.max(0, Number(input.minScore));
    if (Number.isFinite(input.maxScore)) scoreFilter.$lte = Math.min(100, Number(input.maxScore));
    filter.score = scoreFilter;
  }
  if (input.start || input.end) {
    const detectedAt: { $gte?: Date; $lte?: Date } = {};
    if (input.start) detectedAt.$gte = new Date(input.start);
    if (input.end) {
      const end = new Date(input.end);
      end.setHours(23, 59, 59, 999);
      detectedAt.$lte = end;
    }
    filter.detectedAt = detectedAt;
  }

  const search = input.search?.trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const [users, orders] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id").limit(50).lean<Array<{ _id: mongoose.Types.ObjectId }>>(),
      Order.find({ orderId: regex }).select("_id userId").limit(50).lean<Array<{ _id: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId }>>(),
    ]);
    filter.$or = [
      { userId: { $in: [...users.map(user => user._id), ...orders.map(order => order.userId).filter(Boolean)] } },
      { orderId: { $in: orders.map(order => order._id) } },
    ];
  }

  const [events, total, analytics] = await Promise.all([
    RewardRiskEvent.find(filter)
      .populate("userId", "name email rewardDebt")
      .populate("orderId", "orderId total status paymentStatus")
      .sort({ score: -1, detectedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RewardRiskEvent.countDocuments(filter),
    getRiskAnalytics(),
  ]);
  return { events, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), analytics };
}

export async function getRiskEventDetail(eventId: string | mongoose.Types.ObjectId) {
  await connectDB();
  if (!mongoose.isValidObjectId(eventId)) return null;
  const event = await RewardRiskEvent.findById(eventId)
    .populate("userId", "name email phone rewardDebt damruBalance")
    .populate("orderId", "orderId total status paymentStatus createdAt")
    .populate("actingAdminId", "name email")
    .populate("reviewedBy", "name email")
    .lean();
  if (!event) return null;
  const userObject = event.userId as unknown as { _id: mongoose.Types.ObjectId };
  const userId = userObject._id;
  const [summary, transactions, orders, reversals, referrals, campaignUsage] = await Promise.all([
    getUserRiskSummary(userId),
    DamruTransaction.find({ userId }).select("type category amount description orderId campaignId createdAt").sort({ createdAt: -1 }).limit(40).lean(),
    Order.find({ userId }).select("orderId total status paymentStatus refundedAmount cancelledAt createdAt").sort({ createdAt: -1 }).limit(20).lean(),
    RewardReversal.find({ userId }).select("amount debtAmount reason orderId refundId status createdAt").sort({ createdAt: -1 }).limit(20).lean(),
    Referral.find({ $or: [{ referrerUserId: userId }, { referredUserId: userId }] }).select("status referrerUserId referredUserId qualificationOrderId createdAt qualifiedAt rewardedAt").sort({ createdAt: -1 }).limit(20).lean(),
    RewardCampaignUsage.find({ userId }).select("campaignId rewardAmount status sourceId createdAt").sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const orderIds = orders.map(order => order._id);
  const refunds = orderIds.length
    ? await PaymentRefund.find({ orderId: { $in: orderIds } }).select("orderId amount status reason processedAt createdAt").sort({ createdAt: -1 }).limit(20).lean()
    : [];
  const timeline = [
    ...transactions.map(row => ({ kind: "Reward", at: row.createdAt, title: `${row.type === "credit" ? "+" : "-"}${row.amount} Damru`, detail: row.description })),
    ...orders.map(row => ({ kind: "Order", at: row.createdAt, title: row.orderId, detail: `${row.status} / ${row.paymentStatus}` })),
    ...refunds.map(row => ({ kind: "Refund", at: row.processedAt || row.createdAt, title: `Refund Rs ${row.amount}`, detail: row.status })),
    ...reversals.map(row => ({ kind: "Reversal", at: row.createdAt, title: `-${row.amount} Damru`, detail: row.reason })),
    ...referrals.map(row => ({ kind: "Referral", at: row.qualifiedAt || row.createdAt, title: `Referral ${row.status.toLowerCase().replaceAll("_", " ")}`, detail: "Referral relationship activity" })),
    ...campaignUsage.map(row => ({ kind: "Campaign", at: row.createdAt, title: `+${row.rewardAmount} campaign Damru`, detail: row.status })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 80);
  return { event, summary, transactions, orders, refunds, reversals, referrals, campaignUsage, timeline };
}
