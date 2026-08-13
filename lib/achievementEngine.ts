import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Achievement, { IAchievement } from "@/models/Achievement";
import UserAchievement from "@/models/UserAchievement";
import User from "@/models/User";
import Order from "@/models/Order";
import { awardDamru } from "@/lib/rewardEngine";
import { paymentEligibleOrderFilter } from "@/lib/orders/orderPaymentPolicy";

/** A user is considered profile-complete once the fields they can actually set are filled in. */
export function isProfileComplete(user: { phone?: string; avatar?: string }): boolean {
  return Boolean(user.phone?.trim()) && Boolean(user.avatar?.trim());
}

function activeAchievementFilter(conditionType: IAchievement["conditionType"], now: Date) {
  return {
    isActive: true,
    conditionType,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  };
}

/**
 * Record progress for one achievement and, if the target is newly reached, issue the
 * reward exactly once via the central Reward Engine. Safe to call repeatedly with the
 * same or a lower progress value (idempotent — never regresses progress or double-pays).
 */
async function applyProgress(userId: mongoose.Types.ObjectId | string, achievement: IAchievement, rawProgress: number) {
  const target = achievement.conditionValue;
  const progress = Math.max(0, Math.min(rawProgress, target));

  const doc = await UserAchievement.findOneAndUpdate(
    { userId, achievementId: achievement._id },
    { $setOnInsert: { target, status: "IN_PROGRESS" }, $max: { progress } },
    { upsert: true, new: true }
  );

  if (doc.status === "CLAIMED" || doc.progress < target) return null;

  // Reached target — claim the guard row first so only one concurrent caller proceeds.
  const claimed = await UserAchievement.findOneAndUpdate(
    { _id: doc._id, status: { $ne: "CLAIMED" } },
    { $set: { status: "COMPLETED", unlockedAt: doc.unlockedAt || new Date() } },
    { new: true }
  );
  if (!claimed) return null;

  let transactionId: mongoose.Types.ObjectId | undefined;
  if (achievement.rewardDamruAmount > 0) {
    const result = await awardDamru({
      userId,
      category: "achievement",
      amount: achievement.rewardDamruAmount,
      description: `Achievement Unlocked: ${achievement.name}`,
      idempotencyKey: `achievement:${userId}:${achievement._id}`,
    });
    if (!result.duplicate) {
      transactionId = result.transaction?._id;
    }
  }

  const finalDoc = await UserAchievement.findByIdAndUpdate(
    claimed._id,
    { $set: { status: "CLAIMED", rewardIssuedAt: new Date(), rewardTransactionId: transactionId || null } },
    { new: true }
  );

  return finalDoc;
}

/** ORDER_DELIVERED — evaluate ORDER_COUNT and LIFETIME_SPEND achievements. */
export async function evaluateOrderAchievements(userId: mongoose.Types.ObjectId | string) {
  await connectDB();
  const now = new Date();
  const [orderCountAchievements, spendAchievements] = await Promise.all([
    Achievement.find(activeAchievementFilter("ORDER_COUNT", now)).lean<IAchievement[]>(),
    Achievement.find(activeAchievementFilter("LIFETIME_SPEND", now)).lean<IAchievement[]>(),
  ]);
  if (orderCountAchievements.length === 0 && spendAchievements.length === 0) return [];

  const [agg] = await Order.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: "delivered", ...paymentEligibleOrderFilter() } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" } } },
  ]);
  const orderCount = agg?.count || 0;
  const lifetimeSpend = agg?.total || 0;

  const unlocked = [];
  for (const a of orderCountAchievements) {
    const result = await applyProgress(userId, a as IAchievement, orderCount);
    if (result) unlocked.push(result);
  }
  for (const a of spendAchievements) {
    const result = await applyProgress(userId, a as IAchievement, lifetimeSpend);
    if (result) unlocked.push(result);
  }
  return unlocked;
}

/** DAILY_STREAK_UPDATED — evaluate LOGIN_STREAK achievements. */
export async function evaluateStreakAchievements(userId: mongoose.Types.ObjectId | string, currentStreak: number) {
  await connectDB();
  const now = new Date();
  const achievements = await Achievement.find(activeAchievementFilter("LOGIN_STREAK", now)).lean<IAchievement[]>();
  const unlocked = [];
  for (const a of achievements) {
    const result = await applyProgress(userId, a as IAchievement, currentStreak);
    if (result) unlocked.push(result);
  }
  return unlocked;
}

/** PROFILE_UPDATED — evaluate PROFILE_COMPLETE achievements. */
export async function evaluateProfileAchievement(userId: mongoose.Types.ObjectId | string) {
  await connectDB();
  const now = new Date();
  const achievements = await Achievement.find(activeAchievementFilter("PROFILE_COMPLETE", now)).lean<IAchievement[]>();
  if (achievements.length === 0) return [];

  const user = await User.findById(userId).select("phone avatar").lean<{ phone?: string; avatar?: string }>();
  if (!user) return [];
  const complete = isProfileComplete(user);

  const unlocked = [];
  for (const a of achievements) {
    const result = await applyProgress(userId, a as IAchievement, complete ? 1 : 0);
    if (result) unlocked.push(result);
  }
  return unlocked;
}

/** Authenticated activity — evaluate ACCOUNT_AGE_DAYS achievements from User.createdAt. */
export async function evaluateAccountAgeAchievements(userId: mongoose.Types.ObjectId | string, createdAt: Date) {
  await connectDB();
  const now = new Date();
  const achievements = await Achievement.find(activeAchievementFilter("ACCOUNT_AGE_DAYS", now)).lean<IAchievement[]>();
  if (achievements.length === 0) return [];

  const ageDays = Math.floor((now.getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));

  const unlocked = [];
  for (const a of achievements) {
    const result = await applyProgress(userId, a as IAchievement, ageDays);
    if (result) unlocked.push(result);
  }
  return unlocked;
}

/**
 * Clawback path — called when a full order invalidation (cancellation or full
 * refund) removes one order from a user's delivered order history.
 *
 * For each CLAIMED, reversible, non-revoked ORDER_COUNT/LIFETIME_SPEND
 * UserAchievement:
 * 1. Recompute the true metric excluding the invalidated order.
 * 2. If metric < conditionValue, reverse the achievement reward and mark
 *    the UserAchievement as revoked.
 *
 * Idempotent via `applyReversal`'s compound unique index on
 * (originalTransactionId, triggerId).
 *
 * Returns the count of Damru reversed across all affected achievements.
 */
export async function recomputeAchievementProgress(
  userId: string | mongoose.Types.ObjectId,
  triggerId: string
): Promise<{ reversed: number }> {
  await connectDB();

  const claimedUserAchievements = await UserAchievement.find({
    userId,
    status: "CLAIMED",
    isRevoked: { $ne: true },
  }).populate<{ achievementId: IAchievement }>("achievementId", "conditionType conditionValue isReversible rewardDamruAmount").lean();

  if (claimedUserAchievements.length === 0) return { reversed: 0 };

  // Compute current aggregate counts from valid delivered orders.
  const [agg] = await Order.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        status: "delivered",
        ...paymentEligibleOrderFilter(),
      },
    },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" } } },
  ]);
  const orderCount = agg?.count ?? 0;
  const lifetimeSpend = agg?.total ?? 0;

  const { applyReversal: _applyReversal } = await import("@/lib/rewards/reversalEngine");
  let totalReversed = 0;

  for (const ua of claimedUserAchievements) {
    const achievement = ua.achievementId as IAchievement;
    if (!achievement) continue;
    if (!achievement.isReversible) continue;
    if (achievement.conditionType !== "ORDER_COUNT" && achievement.conditionType !== "LIFETIME_SPEND") continue;

    const currentMetric = achievement.conditionType === "ORDER_COUNT" ? orderCount : lifetimeSpend;
    if (currentMetric >= achievement.conditionValue) continue;

    // Metric has regressed below the unlock threshold — reverse the reward.
    const rewardTxId = (ua as { rewardTransactionId?: mongoose.Types.ObjectId | null }).rewardTransactionId;
    if (!rewardTxId) continue;

    const reversalResult = await _applyReversal(rewardTxId, {
      reason: "ORDER_CANCELLED",
      triggerId,
      allowManualCredit: true,
      note: `Achievement "${achievement.name}" metric regressed below threshold after order invalidation.`,
    });

    if (reversalResult.applied) {
      totalReversed += (reversalResult.transaction?.amount ?? 0);
      await UserAchievement.findByIdAndUpdate(ua._id, {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedTransactionId: reversalResult.transaction?._id || null,
        },
      });
    }
  }

  return { reversed: totalReversed };
}

