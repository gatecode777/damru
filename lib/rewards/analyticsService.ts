/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongodb";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { calculateLiability, maskEmail, percentage, REWARD_ISSUE_CATEGORIES, REWARD_SOURCE_LABELS, resolveAnalyticsRange } from "@/lib/rewards/analytics";
import DamruTransaction from "@/models/DamruTransaction";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import UserAchievement from "@/models/UserAchievement";
import Mission from "@/models/Mission";
import UserMission from "@/models/UserMission";
import Referral from "@/models/Referral";
import LoyaltyTier from "@/models/LoyaltyTier";
import Coupon from "@/models/Coupon";
import { getRiskAnalytics } from "@/lib/rewards/riskAdminService";

type AnalyticsQuery = { preset?: string; start?: string | null; end?: string | null; page?: number; limit?: number };
const n = (value: unknown) => Number(value || 0);
const earnedMatch = { type: "credit", category: { $in: [...REWARD_ISSUE_CATEGORIES] } };

export async function getRewardsAnalytics(query: AnalyticsQuery) {
  await connectDB();
  const range = resolveAnalyticsRange(query);
  const page = Math.max(1, Math.floor(query.page || 1));
  const limit = Math.min(50, Math.max(5, Math.floor(query.limit || 10)));
  const period = { $gte: range.start, $lte: range.end };
  const duration = range.end.getTime() - range.start.getTime();
  const previous = { $gte: new Date(range.start.getTime() - duration), $lt: range.start };
  const bucket = range.groupBy === "month" ? "%Y-%m" : range.groupBy === "week" ? "%G-W%V" : "%Y-%m-%d";
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000), in30 = new Date(now.getTime() + 30 * 86400000), in90 = new Date(now.getTime() + 90 * 86400000);

  const [config, ledger, balances, usersWithBalance, activeUsers, topBalances, topEarners, achievementStats, achievementRows,
    missionStats, missionRows, referralStats, tiers, loyaltyRows, couponStats, streakStats, streakDistribution, risk] = await Promise.all([
    getDamruConfig(),
    DamruTransaction.aggregate([
      { $facet: {
        totals: [{ $match: { createdAt: period } }, { $group: { _id: null,
          issued: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "credit"] }, { $in: ["$category", [...REWARD_ISSUE_CATEGORIES]] }] }, "$amount", 0] } },
          redeemed: { $sum: { $cond: [{ $eq: ["$category", "redemption"] }, "$amount", 0] } },
          expired: { $sum: { $cond: [{ $eq: ["$category", "expiry"] }, "$amount", 0] } },
          restored: { $sum: { $cond: [{ $eq: ["$category", "refund_restore"] }, "$amount", 0] } },
          reversed: { $sum: { $cond: [{ $eq: ["$category", "reward_reversal"] }, "$amount", 0] } },
          campaignReversed: { $sum: { $cond: [{ $and: [{ $eq: ["$category", "reward_reversal"] }, { $eq: ["$originalCategory", "campaign"] }] }, "$amount", 0] } },
          orderRewardReversed: { $sum: { $cond: [{ $and: [{ $eq: ["$category", "reward_reversal"] }, { $in: ["$originalCategory", ["order_reward", "first_order"]] }] }, "$amount", 0] } },
          transactions: { $sum: 1 }, activeUsers: { $addToSet: "$userId" }, refundOrders: { $addToSet: { $cond: [{ $eq: ["$category", "refund_restore"] }, "$orderId", "$$REMOVE"] } }
        } }],
        previous: [{ $match: { createdAt: previous } }, { $group: { _id: null,
          issued: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "credit"] }, { $in: ["$category", [...REWARD_ISSUE_CATEGORIES]] }] }, "$amount", 0] } },
          redeemed: { $sum: { $cond: [{ $eq: ["$category", "redemption"] }, "$amount", 0] } }
        } }],
        trends: [{ $match: { createdAt: period, category: { $in: [...REWARD_ISSUE_CATEGORIES, "redemption", "expiry", "refund_restore", "reward_reversal"] } } },
          { $group: { _id: { bucket: { $dateToString: { format: bucket, date: "$createdAt", timezone: "Asia/Kolkata" } }, category: "$category", type: "$type" }, amount: { $sum: "$amount" } } }, { $sort: { "_id.bucket": 1 } }],
        sources: [{ $match: { ...earnedMatch, createdAt: period } }, { $group: { _id: "$category", issued: { $sum: "$amount" }, users: { $addToSet: "$userId" }, transactions: { $sum: 1 } } }, { $sort: { issued: -1 } }],
        expiry: [{ $match: { type: "credit", remainingAmount: { $gt: 0 } } }, { $group: { _id: null,
          next7: { $sum: { $cond: [{ $and: [{ $gt: ["$expiresAt", now] }, { $lte: ["$expiresAt", in7] }] }, "$remainingAmount", 0] } },
          next30: { $sum: { $cond: [{ $and: [{ $gt: ["$expiresAt", now] }, { $lte: ["$expiresAt", in30] }] }, "$remainingAmount", 0] } },
          next90: { $sum: { $cond: [{ $and: [{ $gt: ["$expiresAt", now] }, { $lte: ["$expiresAt", in90] }] }, "$remainingAmount", 0] } },
          after90: { $sum: { $cond: [{ $gt: ["$expiresAt", in90] }, "$remainingAmount", 0] } },
          nonExpiring: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$expiresAt", null] }, null] }, "$remainingAmount", 0] } }
        } }]
      } }
    ]),
    User.aggregate([{ $group: { _id: null, outstanding: { $sum: { $max: ["$damruBalance", 0] } }, rewardDebt: { $sum: { $max: ["$rewardDebt", 0] } }, users: { $sum: 1 } } }]),
    User.countDocuments({ damruBalance: { $gt: 0 } }),
    Promise.all([DamruTransaction.distinct("userId", { ...earnedMatch, createdAt: period }), DamruTransaction.distinct("userId", { category: "redemption", createdAt: period })]),
    User.find({ damruBalance: { $gt: 0 } }).sort({ damruBalance: -1 }).skip((page - 1) * limit).limit(limit).select("name email damruBalance damruTotalEarned damruTotalRedeemed").lean(),
    DamruTransaction.aggregate([{ $match: { ...earnedMatch, createdAt: period } }, { $group: { _id: "$userId", earned: { $sum: "$amount" } } }, { $sort: { earned: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $project: { earned: 1, name: "$user.name", email: "$user.email", balance: "$user.damruBalance" } }]),
    Promise.all([Achievement.countDocuments(), Achievement.countDocuments({ isActive: true }), UserAchievement.distinct("userId", { unlockedAt: period }), UserAchievement.countDocuments({ unlockedAt: period })]),
    UserAchievement.aggregate([{ $match: { unlockedAt: period } }, { $group: { _id: "$achievementId", unlocks: { $sum: 1 } } }, { $lookup: { from: "achievements", localField: "_id", foreignField: "_id", as: "item" } }, { $unwind: "$item" }, { $project: { name: "$item.name", unlocks: 1, reward: "$item.rewardDamruAmount" } }, { $sort: { unlocks: -1 } }, { $limit: 10 }]),
    Promise.all([Mission.countDocuments({ isActive: true }), UserMission.distinct("userId", { startedAt: period }), UserMission.countDocuments({ completedAt: period })]),
    UserMission.aggregate([{ $match: { startedAt: period } }, { $group: { _id: "$missionId", participants: { $addToSet: "$userId" }, completions: { $sum: { $cond: [{ $in: ["$status", ["COMPLETED", "CLAIMED"]] }, 1, 0] } } } }, { $lookup: { from: "missions", localField: "_id", foreignField: "_id", as: "item" } }, { $unwind: "$item" }, { $project: { name: "$item.name", participants: { $size: "$participants" }, completions: 1, reward: "$item.rewardDamruAmount" } }, { $sort: { completions: -1 } }, { $limit: 10 }]),
    Promise.all([Referral.countDocuments({ registeredAt: period }), Referral.countDocuments({ qualifiedAt: period }), Referral.find({ rewardedAt: period }).select("referrerRewardAmount referredRewardAmount").lean()]),
    LoyaltyTier.find({ isActive: true }).sort({ rank: 1 }).select("name code rank").lean(),
    User.aggregate([{ $group: { _id: { $ifNull: ["$loyaltyTierCode", { $ifNull: ["$loyaltyLevel", "UNASSIGNED"] }] }, users: { $sum: 1 }, avgSpend: { $avg: "$totalSpend" }, avgBalance: { $avg: "$damruBalance" } } }]),
    Promise.all([Coupon.countDocuments({ userId: { $ne: null }, createdAt: period }), Coupon.aggregate([{ $match: { userId: { $ne: null }, createdAt: period } }, { $group: { _id: null, redemptions: { $sum: "$usedCount" } } }]), Coupon.countDocuments({ userId: { $ne: null }, expiryDate: { $lt: now }, usedCount: 0 })]),
    User.aggregate([{ $group: { _id: null, users: { $sum: { $cond: [{ $gt: ["$currentStreak", 0] }, 1, 0] } }, avg: { $avg: "$currentStreak" }, longestCurrent: { $max: "$currentStreak" }, longestEver: { $max: "$longestStreak" } } }]),
    User.aggregate([{ $bucket: { groupBy: "$currentStreak", boundaries: [0, 1, 4, 8, 15, 31, 1000000], default: "other", output: { users: { $sum: 1 } } } }]),
    getRiskAnalytics()
  ]);

  const facet = ledger[0] || {}, totals = facet.totals?.[0] || {}, prior = facet.previous?.[0] || {}, balance = balances[0] || {};
  const issued = n(totals.issued), redeemed = n(totals.redeemed), expired = n(totals.expired), restored = n(totals.restored), reversed = n(totals.reversed), outstanding = n(balance.outstanding);
  const sourceRows = (facet.sources || []).map((row: any) => ({ category: row._id, label: REWARD_SOURCE_LABELS[row._id] || row._id, issued: n(row.issued), users: row.users.length, transactions: row.transactions, average: percentage(row.issued, row.transactions), share: percentage(row.issued, issued), estimatedValue: calculateLiability(row.issued, config.redemptionRate) }));
  const trendMap = new Map<string, any>();
  for (const row of facet.trends || []) { const item = trendMap.get(row._id.bucket) || { bucket: row._id.bucket, issued: 0, redeemed: 0, expired: 0, restored: 0, reversed: 0 }; const key = row._id.category === "redemption" ? "redeemed" : row._id.category === "expiry" ? "expired" : row._id.category === "refund_restore" ? "restored" : row._id.category === "reward_reversal" ? "reversed" : "issued"; item[key] += row.amount; trendMap.set(row._id.bucket, item); }
  const rewarded = referralStats[2] as any[];
  const tierNames = new Map((tiers as any[]).map(t => [t.code, t.name]));

  return {
    meta: { preset: range.preset, start: range.start, end: range.end, timezone: "Asia/Kolkata", groupBy: range.groupBy, generatedAt: new Date(), page, limit },
    kpis: { issued, grossIssued: issued, reversed, netIssued: issued - reversed, campaignReversed: n(totals.campaignReversed), orderRewardReversed: n(totals.orderRewardReversed), rewardDebt: n(balance.rewardDebt), redeemed, expired, restored, outstanding, liability: calculateLiability(outstanding, config.redemptionRate), activeRewardUsers: totals.activeUsers?.length || 0, usersWithBalance, redemptionRate: percentage(redeemed, issued), breakageRate: percentage(expired, issued), refundOrders: totals.refundOrders?.filter(Boolean).length || 0, comparison: { issued: percentage(issued - n(prior.issued), n(prior.issued)), redeemed: percentage(redeemed - n(prior.redeemed), n(prior.redeemed)) } },
    trends: [...trendMap.values()], sources: sourceRows, expiry: facet.expiry?.[0] || { next7: 0, next30: 0, next90: 0, after90: 0, nonExpiring: 0 },
    engagement: { earningUsers: activeUsers[0].length, redeemingUsers: activeUsers[1].length, noRewardActivity: Math.max(0, n(balance.users) - (totals.activeUsers?.length || 0)) },
    streaks: { ...(streakStats[0] || { users: 0, avg: 0, longestCurrent: 0, longestEver: 0 }), claims: sourceRows.find((s: any) => s.category === "daily_login")?.transactions || 0, issued: sourceRows.find((s: any) => s.category === "daily_login")?.issued || 0, distribution: streakDistribution },
    achievements: { total: achievementStats[0], active: achievementStats[1], participants: achievementStats[2].length, unlocks: achievementStats[3], issued: sourceRows.find((s: any) => s.category === "achievement")?.issued || 0, rows: achievementRows },
    missions: { active: missionStats[0], participants: missionStats[1].length, completions: missionStats[2], issued: sourceRows.find((s: any) => s.category === "mission")?.issued || 0, rows: missionRows },
    referrals: { registered: referralStats[0], qualified: referralStats[1], rewarded: rewarded.length, conversionRate: percentage(referralStats[1] as number, referralStats[0] as number), referrerDamru: rewarded.reduce((s, r) => s + n(r.referrerRewardAmount), 0), referredDamru: rewarded.reduce((s, r) => s + n(r.referredRewardAmount), 0) },
    loyalty: { rows: (loyaltyRows as any[]).map(r => ({ code: r._id, name: tierNames.get(r._id) || String(r._id).replace(/_/g, " "), users: r.users, avgSpend: n(r.avgSpend), avgBalance: n(r.avgBalance) })), upgrades: sourceRows.find((s: any) => s.category === "loyalty_tier")?.transactions || 0, issued: sourceRows.find((s: any) => s.category === "loyalty_tier")?.issued || 0 },
    coupons: { issued: couponStats[0], redeemed: n((couponStats[1] as any[])[0]?.redemptions), expiredUnused: couponStats[2] },
    occasions: sourceRows.filter((s: any) => ["birthday", "marriage_anniversary", "account_anniversary"].includes(s.category)),
    orderRelationship: { rewardIssued: sourceRows.find((s: any) => s.category === "order_reward")?.issued || 0, rewardReversed: n(totals.orderRewardReversed), campaignReversed: n(totals.campaignReversed), redeemedDamru: redeemed, estimatedDiscount: calculateLiability(redeemed, config.redemptionRate) },
    topUsers: { total: usersWithBalance, rows: (topBalances as any[]).map(u => ({ id: u._id, name: u.name || "Customer", email: maskEmail(u.email), balance: n(u.damruBalance), lifetimeEarned: n(u.damruTotalEarned), lifetimeRedeemed: n(u.damruTotalRedeemed) })) },
    highEarners: { rows: (topEarners as any[]).map(u => ({ id: u._id, name: u.name || "Customer", email: maskEmail(u.email), earned: n(u.earned), balance: n(u.balance) })) }, risk, conversionRate: config.redemptionRate
  };
}
