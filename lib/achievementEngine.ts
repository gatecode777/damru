import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Achievement, { IAchievement } from "@/models/Achievement";
import UserAchievement from "@/models/UserAchievement";
import User from "@/models/User";
import Order from "@/models/Order";
import { awardDamru } from "@/lib/rewardEngine";

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
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: "delivered" } },
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
