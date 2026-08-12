import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Mission, { IMission, IMissionEligibility } from "@/models/Mission";
import UserMission from "@/models/UserMission";
import MissionEvent from "@/models/MissionEvent";
import User from "@/models/User";
import Order from "@/models/Order";
import { awardDamru } from "@/lib/rewardEngine";
import { isProfileComplete } from "@/lib/achievementEngine";
import { awardCampaignBonuses } from "@/lib/rewards/campaignEngine";
import { getPeriodKey, getPeriodEnd, MissionPeriodType } from "@/lib/missionPeriod";
import { paymentEligibleOrderFilter } from "@/lib/orders/orderPaymentPolicy";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000;
}

function activeMissionFilter(missionTypes: IMission["missionType"][], now: Date) {
  return {
    isActive: true,
    missionType: { $in: missionTypes },
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
    ],
  };
}

function meetsEligibility(
  eligibility: IMissionEligibility | undefined,
  ctx: { accountCreatedAt?: Date; completedOrderCount?: number }
): boolean {
  if (!eligibility) return true;
  if (eligibility.minAccountAgeDays && ctx.accountCreatedAt) {
    const ageDays = Math.floor((Date.now() - ctx.accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays < eligibility.minAccountAgeDays) return false;
  }
  if (eligibility.minCompletedOrders && ctx.completedOrderCount !== undefined) {
    if (ctx.completedOrderCount < eligibility.minCompletedOrders) return false;
  }
  return true;
}

type ProgressUpdate =
  | { mode: "increment"; amount: number; eventKey: string }
  | { mode: "absolute"; value: number };

/**
 * Shared progress + completion primitive for every mission type. Increment mode
 * is gated by a MissionEvent dedup row (protects against repeated business
 * events); absolute mode just takes the max of the trusted current value, which
 * is naturally idempotent since re-evaluating never regresses progress.
 * On reaching target, claims the row and issues the reward exactly once via
 * the central Reward Engine.
 */
async function applyMissionProgress(
  userId: mongoose.Types.ObjectId | string,
  mission: IMission,
  periodKey: string,
  update: ProgressUpdate
) {
  if (update.mode === "increment") {
    try {
      await MissionEvent.create({ key: update.eventKey, missionId: mission._id, userId });
    } catch (err) {
      if (isDuplicateKeyError(err)) return null;
      throw err;
    }
  }

  const target = mission.targetValue;
  const mongoUpdate = update.mode === "increment"
    ? { $setOnInsert: { target, status: "IN_PROGRESS", startedAt: new Date() }, $inc: { progress: update.amount } }
    : { $setOnInsert: { target, status: "IN_PROGRESS", startedAt: new Date() }, $max: { progress: Math.min(update.value, target) } };

  const doc = await UserMission.findOneAndUpdate(
    { userId, missionId: mission._id, periodKey },
    mongoUpdate,
    { upsert: true, new: true }
  );

  if (doc.status === "CLAIMED" || doc.status === "EXPIRED" || doc.progress < doc.target) return null;

  const claimed = await UserMission.findOneAndUpdate(
    { _id: doc._id, status: { $ne: "CLAIMED" } },
    { $set: { status: "COMPLETED", completedAt: doc.completedAt || new Date() } },
    { new: true }
  );
  if (!claimed) return null;

  let transactionId: mongoose.Types.ObjectId | undefined;
  if (mission.rewardDamruAmount > 0) {
    const result = await awardDamru({
      userId,
      category: "mission",
      amount: mission.rewardDamruAmount,
      description: `Mission Completed: ${mission.name}`,
      idempotencyKey: `mission:${userId}:${mission._id}:${periodKey}`,
    });
    if (!result.duplicate) transactionId = result.transaction?._id;
    await awardCampaignBonuses({ trigger:"MISSION_COMPLETED", userId, sourceId:String(claimed._id), baseReward:mission.rewardDamruAmount, missionId:mission._id });
  }

  return UserMission.findByIdAndUpdate(
    claimed._id,
    { $set: { status: "CLAIMED", rewardIssuedAt: new Date(), rewardTransactionId: transactionId || null } },
    { new: true }
  );
}

/** ORDER_DELIVERED — evaluate ORDER_COUNT and SPENDING_AMOUNT missions for this order. */
export async function evaluateOrderMissions(
  userId: mongoose.Types.ObjectId | string,
  orderId: mongoose.Types.ObjectId | string,
  orderAmount: number
) {
  await connectDB();
  const now = new Date();
  const missions = await Mission.find(activeMissionFilter(["ORDER_COUNT", "SPENDING_AMOUNT"], now)).lean<IMission[]>();
  if (missions.length === 0) return [];

  let accountCreatedAt: Date | undefined;
  let completedOrderCount: number | undefined;
  if (missions.some(m => m.eligibility?.minAccountAgeDays)) {
    const u = await User.findById(userId).select("createdAt").lean<{ createdAt: Date }>();
    accountCreatedAt = u?.createdAt;
  }
  if (missions.some(m => m.eligibility?.minCompletedOrders)) {
    completedOrderCount = await Order.countDocuments({ userId, status: "delivered", ...paymentEligibleOrderFilter() });
  }

  const completed = [];
  for (const mission of missions) {
    if (!meetsEligibility(mission.eligibility, { accountCreatedAt, completedOrderCount })) continue;
    const periodKey = getPeriodKey(mission.periodType, String(mission._id), now);
    const eventKey = `mission-event:${mission._id}:${userId}:order:${orderId}`;
    const amount = mission.missionType === "ORDER_COUNT" ? 1 : orderAmount;
    const result = await applyMissionProgress(userId, mission, periodKey, { mode: "increment", amount, eventKey });
    if (result) completed.push(result);
  }
  return completed;
}

/** DAILY_STREAK_UPDATED — evaluate LOGIN_STREAK missions from the trusted current streak. */
export async function evaluateStreakMissions(userId: mongoose.Types.ObjectId | string, currentStreak: number) {
  await connectDB();
  const now = new Date();
  const missions = await Mission.find(activeMissionFilter(["LOGIN_STREAK"], now)).lean<IMission[]>();
  const completed = [];
  for (const mission of missions) {
    const periodKey = getPeriodKey(mission.periodType, String(mission._id), now);
    const result = await applyMissionProgress(userId, mission, periodKey, { mode: "absolute", value: currentStreak });
    if (result) completed.push(result);
  }
  return completed;
}

/** PROFILE_UPDATED — evaluate PROFILE_COMPLETE missions, reusing PRD 3B's single profile-completeness definition. */
export async function evaluateProfileMission(userId: mongoose.Types.ObjectId | string) {
  await connectDB();
  const now = new Date();
  const missions = await Mission.find(activeMissionFilter(["PROFILE_COMPLETE"], now)).lean<IMission[]>();
  if (missions.length === 0) return [];

  const user = await User.findById(userId).select("phone avatar").lean<{ phone?: string; avatar?: string }>();
  if (!user) return [];
  const complete = isProfileComplete(user) ? 1 : 0;

  const completed = [];
  for (const mission of missions) {
    const periodKey = getPeriodKey(mission.periodType, String(mission._id), now);
    const result = await applyMissionProgress(userId, mission, periodKey, { mode: "absolute", value: complete });
    if (result) completed.push(result);
  }
  return completed;
}

/** Lazily flip stale IN_PROGRESS rows to EXPIRED for one user. Scoped and cheap — call when the user's missions are actually viewed. */
export async function expireStaleUserMissions(userId: mongoose.Types.ObjectId | string) {
  await connectDB();
  const now = new Date();
  const inProgress = await UserMission.find({ userId, status: "IN_PROGRESS" })
    .populate("missionId", "periodType endsAt")
    .lean<{ _id: mongoose.Types.ObjectId; periodKey: string; missionId: { periodType: MissionPeriodType; endsAt?: Date | null } | null }[]>();

  const toExpire: mongoose.Types.ObjectId[] = [];
  for (const um of inProgress) {
    const mission = um.missionId;
    if (!mission) continue;
    const periodEnd = getPeriodEnd(mission.periodType, um.periodKey);
    const boundary = periodEnd || mission.endsAt;
    if (boundary && now > new Date(boundary)) toExpire.push(um._id);
  }
  if (toExpire.length > 0) {
    await UserMission.updateMany({ _id: { $in: toExpire } }, { $set: { status: "EXPIRED" } });
  }
}
