import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import LoyaltyTier, { ILoyaltyTier, LoyaltyQualificationType } from "@/models/LoyaltyTier";
import User from "@/models/User";
import Order from "@/models/Order";

export type LoyaltyRewardSource = "ORDER_REWARD" | "OTHER";

export async function getActiveLoyaltyTiers() {
  await connectDB();
  return LoyaltyTier.find({ isActive: true }).sort({ rank: 1 }).lean<ILoyaltyTier[]>();
}

export function validateLoyaltyLadder(tiers: Pick<ILoyaltyTier, "qualificationType" | "minimumValue" | "maximumValue" | "rank">[]) {
  const sorted = [...tiers].sort((a, b) => a.rank - b.rank);
  if (new Set(sorted.map(t => t.rank)).size !== sorted.length) return "Tier ranks must be unique.";
  if (new Set(sorted.map(t => t.qualificationType)).size > 1) return "All active tiers must use the same qualification type.";
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (tier.minimumValue < 0 || (tier.maximumValue !== null && tier.maximumValue <= tier.minimumValue)) return "Each tier must have a valid minimum and maximum.";
    if (i < sorted.length - 1 && tier.maximumValue === null) return "Only the highest tier may omit a maximum.";
    if (i > 0) {
      const previous = sorted[i - 1];
      if (previous.maximumValue === null || tier.minimumValue < previous.maximumValue) return "Active tier ranges cannot overlap.";
    }
  }
  return null;
}

async function qualificationValue(userId: string | mongoose.Types.ObjectId, type: LoyaltyQualificationType) {
  if (type === "DAMRU_EARNED") return (await User.findById(userId).select("damruTotalEarned").lean<{ damruTotalEarned: number }>())?.damruTotalEarned || 0;
  const match = { userId: new mongoose.Types.ObjectId(String(userId)), status: "delivered" };
  if (type === "COMPLETED_ORDERS") return Order.countDocuments(match);
  const rows = await Order.aggregate([{ $match: match }, { $group: { _id: null, value: { $sum: "$total" } } }]);
  return rows[0]?.value || 0;
}

function publicTier(tier: ILoyaltyTier) {
  return { id: String(tier._id), code: tier.code, name: tier.name, rank: tier.rank, badgeName: tier.badgeName || null, badgeIcon: tier.badgeIcon || null, damruMultiplier: tier.damruMultiplier };
}

export async function getLoyaltySummary(userId: string | mongoose.Types.ObjectId) {
  const tiers = await getActiveLoyaltyTiers();
  if (!tiers.length) return { currentTier: null, qualification: null, nextTier: null, progress: { percentage: 0, remainingValue: 0 }, benefits: [], tiers: [] };
  const type = tiers[0].qualificationType;
  const currentValue = await qualificationValue(userId, type);
  const current = [...tiers].reverse().find(t => currentValue >= t.minimumValue && (t.maximumValue === null || currentValue < t.maximumValue)) || tiers[0];
  const next = tiers.find(t => t.rank > current.rank) || null;
  const span = next ? next.minimumValue - current.minimumValue : 0;
  return {
    currentTier: publicTier(current), qualification: { type, currentValue },
    nextTier: next ? { ...publicTier(next), minimumValue: next.minimumValue } : null,
    progress: { percentage: next ? Math.max(0, Math.min(100, Math.round(((currentValue - current.minimumValue) / Math.max(1, span)) * 100))) : 100, remainingValue: next ? Math.max(0, next.minimumValue - currentValue) : 0 },
    benefits: current.benefits, tiers: tiers.map(t => ({ ...publicTier(t), minimumValue: t.minimumValue, maximumValue: t.maximumValue, benefits: t.benefits })),
  };
}

export async function evaluateLoyaltyTier(userId: string | mongoose.Types.ObjectId, options: { issueBonus?: boolean } = {}) {
  const summary = await getLoyaltySummary(userId);
  if (!summary.currentTier) return { ...summary, changed: false };
  const user = await User.findById(userId).select("loyaltyTierId");
  if (!user) return { ...summary, changed: false };
  const changed = String(user.loyaltyTierId || "") !== summary.currentTier.id;
  await User.findByIdAndUpdate(userId, { loyaltyTierId: summary.currentTier.id, loyaltyTierCode: summary.currentTier.code, loyaltyTierUpdatedAt: new Date() });
  if (changed && options.issueBonus) {
    const tier = await LoyaltyTier.findById(summary.currentTier.id).select("tierBonusDamru name");
    if (tier?.tierBonusDamru) {
      const { awardDamru } = await import("@/lib/rewardEngine");
      await awardDamru({ userId, category: "loyalty_tier", amount: tier.tierBonusDamru, description: `${tier.name} tier upgrade bonus`, idempotencyKey: `loyalty-tier:${userId}:${tier._id}` });
    }
  }
  return { ...summary, changed };
}

export async function getLoyaltyRewardMultiplier(userId: string | mongoose.Types.ObjectId, source: LoyaltyRewardSource) {
  if (source !== "ORDER_REWARD") return 1;
  const summary = await getLoyaltySummary(userId);
  return summary.currentTier?.damruMultiplier || 1;
}

export function applyLoyaltyMultiplier(amount: number, multiplier: number) { return Math.round(amount * Math.max(1, multiplier)); }
