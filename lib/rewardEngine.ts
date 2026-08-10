import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User, { LoyaltyLevel } from "@/models/User";
import DamruTransaction, { DamruTransactionCategory } from "@/models/DamruTransaction";
import RewardRule, { RewardRuleCategory } from "@/models/RewardRule";
import Coupon from "@/models/Coupon";
import Order from "@/models/Order";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { getDailyStreakConfig } from "@/lib/getDailyStreakConfig";
import { projectNextStreak, rewardDayForStreak, amountForDay, toDateStr } from "@/lib/dailyStreak";
import { assignLotFields, allocateDebit, releaseAllocation } from "@/lib/rewards/damruAllocation";
import { notifyRewardEvent, mapCreditCategoryToType } from "@/lib/notifications/rewardNotificationService";

interface CouponTemplate {
  type: "flat" | "percentage";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
}

interface AwardDamruInput {
  userId: string | mongoose.Types.ObjectId;
  category: DamruTransactionCategory;
  amount: number;
  description: string;
  idempotencyKey: string;
  ruleId?: mongoose.Types.ObjectId;
  orderId?: string | mongoose.Types.ObjectId;
  couponTemplate?: CouponTemplate;
  validForDays?: number | null;
  /** Opt this specific credit out of the standard expiry policy (e.g. an admin's "Never Expires" choice). */
  neverExpires?: boolean;
}

function loyaltyLevelFor(totalEarned: number, thresholds: { silver: number; gold: number; platinum: number }): LoyaltyLevel {
  if (totalEarned >= thresholds.platinum) return "platinum";
  if (totalEarned >= thresholds.gold) return "gold";
  if (totalEarned >= thresholds.silver) return "silver";
  return "bronze";
}

async function recalcLoyaltyLevel(userId: mongoose.Types.ObjectId | string, totalEarned: number) {
  const config = await getDamruConfig();
  const level = loyaltyLevelFor(totalEarned, config.loyaltyThresholds);
  await User.findByIdAndUpdate(userId, { loyaltyLevel: level });
}

async function grantPrivateCoupon(userId: mongoose.Types.ObjectId | string, template: CouponTemplate, validForDays: number | null) {
  const code = `RWD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const expiryDate = validForDays ? new Date(Date.now() + validForDays * 24 * 60 * 60 * 1000) : null;
  return Coupon.create({
    code,
    description: "Reward coupon",
    type: template.type,
    value: template.value,
    maxDiscount: template.maxDiscount,
    minOrderValue: template.minOrderValue,
    usageLimit: 1,
    perUserLimit: 1,
    expiryDate,
    isActive: true,
    userId,
  });
}

/** Core reward-issuing primitive. Every Damru credit must go through this. */
export async function awardDamru(input: AwardDamruInput) {
  await connectDB();
  if (input.amount <= 0) return { duplicate: false, skipped: true as const };

  const config = await getDamruConfig();
  let transaction;
  try {
    transaction = await DamruTransaction.create({
      userId: input.userId,
      type: "credit",
      category: input.category,
      amount: input.amount,
      balanceAfter: 0, // patched below
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      ruleId: input.ruleId,
      orderId: input.orderId,
      ...assignLotFields(input.amount, input.category, config, { neverExpires: input.neverExpires }),
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return { duplicate: true as const };
    }
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    input.userId,
    { $inc: { damruBalance: input.amount, damruTotalEarned: input.amount } },
    { new: true }
  );
  if (!user) return { duplicate: false, transaction };

  transaction.balanceAfter = user.damruBalance;
  await transaction.save();

  await recalcLoyaltyLevel(user._id, user.damruTotalEarned);

  let coupon = null;
  if (input.couponTemplate) {
    coupon = await grantPrivateCoupon(user._id, input.couponTemplate, input.validForDays ?? null);
    transaction.couponId = coupon._id;
    await transaction.save();
  }

  // Notification delivery is intentionally decoupled from the reward above —
  // notifyRewardEvent() never throws, so a failure here can never roll back
  // or block the Damru that was already credited (PRD 4B v2 section 2).
  const notificationType = mapCreditCategoryToType(input.category);
  if (notificationType) {
    await notifyRewardEvent({
      userId: user._id,
      type: notificationType,
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount: input.amount,
      description: input.description,
      route: "/my-profile?tab=rewards",
    });
  }
  if (coupon) {
    await notifyRewardEvent({
      userId: user._id,
      type: "COUPON_ISSUED",
      sourceId: coupon._id,
      sourceType: "Coupon",
      couponCode: coupon.code,
      couponDescription: coupon.description,
      couponExpiryDate: coupon.expiryDate,
      route: "/my-profile?tab=rewards",
    });
  }

  return { duplicate: false as const, transaction, newBalance: user.damruBalance, coupon };
}

/** Redeem Damru at a fixed conversion rate. Concurrency-safe via conditional atomic decrement. */
export async function redeemDamru(userId: string | mongoose.Types.ObjectId, amount: number, orderId: string | mongoose.Types.ObjectId) {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return { success: false as const, error: "Invalid order." };
  const order = await Order.findOne({ _id: orderId, userId }).select("_id orderId").lean<{ _id: mongoose.Types.ObjectId; orderId: string }>();
  if (!order) return { success: false as const, error: "Order not found." };

  const config = await getDamruConfig();

  if (amount < config.minRedemption) return { success: false as const, error: `Minimum redemption is ${config.minRedemption} Damru.` };
  if (amount > config.maxRedemptionPerOrder) return { success: false as const, error: `Maximum redemption per order is ${config.maxRedemptionPerOrder} Damru.` };

  const idempotencyKey = `redeem_order_${orderId}`;
  const existing = await DamruTransaction.findOne({ idempotencyKey }).lean();
  if (existing) return { success: false as const, error: "Damru has already been redeemed for this order." };

  const allocation = await allocateDebit(userId, amount, { damruTotalRedeemed: amount });
  if (!allocation.success) return { success: false as const, error: allocation.error || "Insufficient Damru balance." };

  let transaction;
  try {
    transaction = await DamruTransaction.create({
      userId,
      type: "debit",
      category: "redemption",
      amount,
      balanceAfter: allocation.newBalance,
      description: "Redeemed at checkout",
      idempotencyKey,
      orderId,
      allocations: allocation.allocations.length > 0 ? allocation.allocations : undefined,
    });
  } catch (err: unknown) {
    // Duplicate redemption raced in — roll back the decrement and any lot claims.
    await releaseAllocation(userId, allocation.allocations, amount, { damruTotalRedeemed: -amount });
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return { success: false as const, error: "Damru has already been redeemed for this order." };
    }
    throw err;
  }

  const discount = Math.round(amount * config.redemptionRate);

  await notifyRewardEvent({
    userId,
    type: "DAMRU_REDEEMED",
    sourceId: transaction._id,
    sourceType: "DamruTransaction",
    amount,
    orderNumber: order.orderId,
    route: "/my-profile?tab=rewards",
  });

  return { success: true as const, discount, newBalance: allocation.newBalance, transaction };
}

/**
 * Admin manual add/deduct — always requires a reason and records the acting admin.
 *
 * `requestId` is a client-generated id for ONE admin click (see AdjustDamruForm /
 * app/api/admin/rewards/users/[id]/adjust). Retrying the same click (network retry,
 * accidental double-submit) reuses the same requestId and is a safe no-op — it does
 * NOT touch the balance twice. A genuinely new adjustment (even with the identical
 * userId/amount/reason) gets a new requestId from the client and is allowed, by
 * design: two legitimate identical adjustments are a real, intended use case here,
 * unlike every other reward flow where the same business event should never repeat.
 * Omitting requestId falls back to the old always-unique behaviour (no dedup).
 */
export async function adjustDamru(input: {
  userId: string | mongoose.Types.ObjectId;
  amount: number;
  direction: "credit" | "debit";
  reason: string;
  adminId: string | mongoose.Types.ObjectId;
  requestId?: string;
  /** Credit-only: opts this specific admin credit out of the standard expiry policy. Ignored for debits. */
  neverExpires?: boolean;
}) {
  await connectDB();
  if (!input.reason?.trim()) return { success: false as const, error: "A reason is required." };
  if (input.amount <= 0) return { success: false as const, error: "Amount must be positive." };

  const idempotencyKey = input.requestId
    ? `admin_adjust_${input.requestId}`
    : `admin_${input.adminId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  if (input.direction === "credit") {
    const config = await getDamruConfig();
    let transaction;
    try {
      transaction = await DamruTransaction.create({
        userId: input.userId,
        type: "credit",
        category: "admin_credit",
        amount: input.amount,
        balanceAfter: 0, // patched below
        description: "Manual credit by admin",
        idempotencyKey,
        adjustedBy: input.adminId,
        adjustmentReason: input.reason.trim(),
        ...assignLotFields(input.amount, "admin_credit", config, { neverExpires: input.neverExpires }),
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
        return { success: false as const, error: "This adjustment was already applied.", duplicate: true as const };
      }
      throw err;
    }

    const user = await User.findByIdAndUpdate(
      input.userId,
      { $inc: { damruBalance: input.amount, damruTotalEarned: input.amount } },
      { new: true }
    );
    if (!user) return { success: false as const, error: "User not found." };

    transaction.balanceAfter = user.damruBalance;
    await transaction.save();
    await recalcLoyaltyLevel(user._id, user.damruTotalEarned);

    await notifyRewardEvent({
      userId: user._id,
      type: "DAMRU_CREDITED",
      sourceId: transaction._id,
      sourceType: "DamruTransaction",
      amount: input.amount,
      description: input.reason.trim(),
      route: "/my-profile?tab=rewards",
    });

    return { success: true as const, newBalance: user.damruBalance, transaction };
  }

  const allocation = await allocateDebit(input.userId, input.amount);
  if (!allocation.success) return { success: false as const, error: allocation.error || "Insufficient balance to deduct." };

  let transaction;
  try {
    transaction = await DamruTransaction.create({
      userId: input.userId,
      type: "debit",
      category: "admin_debit",
      amount: input.amount,
      balanceAfter: allocation.newBalance,
      description: "Manual deduction by admin",
      idempotencyKey,
      adjustedBy: input.adminId,
      adjustmentReason: input.reason.trim(),
      allocations: allocation.allocations.length > 0 ? allocation.allocations : undefined,
    });
  } catch (err: unknown) {
    // Duplicate submission raced in after the decrement above — roll it back.
    await releaseAllocation(input.userId, allocation.allocations, input.amount);
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return { success: false as const, error: "This adjustment was already applied.", duplicate: true as const };
    }
    throw err;
  }

  return { success: true as const, newBalance: allocation.newBalance, transaction };
}

export async function checkAndAwardWelcomeReward(userId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const rule = await RewardRule.findOne({ category: "welcome_registration", isActive: true });
  if (!rule || rule.amount <= 0) return { skipped: true as const };

  return awardDamru({
    userId,
    category: "welcome_registration",
    amount: rule.amount,
    description: rule.label || "Welcome Reward",
    idempotencyKey: `welcome_registration_${userId}`,
    ruleId: rule._id,
  });
}

export async function checkAndAwardFirstOrderReward(userId: string | mongoose.Types.ObjectId, orderId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const rule = await RewardRule.findOne({ category: "first_order", isActive: true });
  if (!rule || rule.amount <= 0) return { skipped: true as const };

  const deliveredCount = await Order.countDocuments({ userId, status: "delivered" });
  if (deliveredCount !== 1) return { skipped: true as const };

  return awardDamru({
    userId,
    category: "first_order",
    amount: rule.amount,
    description: rule.label || "First Order Reward",
    idempotencyKey: `first_order_${userId}`,
    ruleId: rule._id,
    orderId,
  });
}

// Occasion rewards (birthday/anniversary) are calendar-date concepts tied to a real-world
// Indian date, so they're matched against this fixed business timezone rather than the
// server process's local time (which varies by host/deployment) or plain UTC (which would
// shift the "today" boundary by 5:30 relative to India near midnight). Daily Streak and
// Missions intentionally stay on UTC — see docs/PRODUCTION_READINESS.md's Reward Timezone
// Policy section for why unifying those onto IST was judged higher-risk than worthwhile.
const REWARD_TIMEZONE = "Asia/Kolkata";

/** Calendar-date parts of `date` as observed in REWARD_TIMEZONE, independent of server locale. */
export function istDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REWARD_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const OCCASION_RULES: { category: RewardRuleCategory; match: (date: Date) => Record<string, unknown> }[] = [
  {
    category: "birthday",
    match: (date) => {
      const { month, day } = istDateParts(date);
      return {
        dateOfBirth: { $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: { date: "$dateOfBirth", timezone: REWARD_TIMEZONE } }, month] },
            { $eq: [{ $dayOfMonth: { date: "$dateOfBirth", timezone: REWARD_TIMEZONE } }, day] },
          ],
        },
      };
    },
  },
  {
    category: "marriage_anniversary",
    match: (date) => {
      const { month, day } = istDateParts(date);
      return {
        marriageAnniversary: { $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: { date: "$marriageAnniversary", timezone: REWARD_TIMEZONE } }, month] },
            { $eq: [{ $dayOfMonth: { date: "$marriageAnniversary", timezone: REWARD_TIMEZONE } }, day] },
          ],
        },
      };
    },
  },
  {
    category: "account_anniversary",
    match: (date) => {
      const { year, month, day } = istDateParts(date);
      return {
        $expr: {
          $and: [
            { $eq: [{ $month: { date: "$createdAt", timezone: REWARD_TIMEZONE } }, month] },
            { $eq: [{ $dayOfMonth: { date: "$createdAt", timezone: REWARD_TIMEZONE } }, day] },
            { $gt: [{ $subtract: [year, { $year: { date: "$createdAt", timezone: REWARD_TIMEZONE } }] }, 0] },
          ],
        },
      };
    },
  },
];

/** Run by the daily internal scheduler route to issue birthday / anniversary rewards. */
export async function runOccasionRewards(today: Date) {
  await connectDB();
  const year = istDateParts(today).year;
  const results: { category: string; userId: string; result: unknown }[] = [];

  for (const occasion of OCCASION_RULES) {
    const rule = await RewardRule.findOne({ category: occasion.category, isActive: true });
    if (!rule || rule.amount <= 0) continue;

    const users = await User.find(occasion.match(today)).select("_id").lean();
    for (const u of users) {
      const idempotencyKey = `${occasion.category}_${u._id}_${year}`;
      const result = await awardDamru({
        userId: u._id,
        category: occasion.category,
        amount: rule.amount,
        description: rule.label || occasion.category,
        idempotencyKey,
        ruleId: rule._id,
        couponTemplate: rule.couponTemplate,
        validForDays: rule.validForDays,
      });
      results.push({ category: occasion.category, userId: String(u._id), result });
    }
  }

  return results;
}

/**
 * Daily login streak check-in. Safe to call from any authenticated request (login,
 * session check) — it is a no-op unless the user has not yet been credited today.
 * Server-side date boundaries + a per-day idempotency key are the source of truth;
 * frontend state is never trusted for streak count or reward amount.
 */
interface DailyLoginSkipped { skipped: true }
interface DailyLoginDuplicate { duplicate: true; currentStreak: number }
interface DailyLoginAwarded {
  duplicate: false;
  currentStreak: number;
  longestStreak: number;
  rewardDay: number;
  amount: number;
  newBalance: number | undefined;
}
export type DailyLoginResult = DailyLoginSkipped | DailyLoginDuplicate | DailyLoginAwarded;

export async function checkAndAwardDailyLogin(userId: string | mongoose.Types.ObjectId): Promise<DailyLoginResult> {
  await connectDB();
  const config = await getDailyStreakConfig();
  if (!config.isActive || config.dayRewards.length === 0) return { skipped: true };

  const existing = await User.findById(userId)
    .select("currentStreak longestStreak lastEligibleActivityDate")
    .lean<{ currentStreak: number; longestStreak: number; lastEligibleActivityDate: string | null }>();
  if (!existing) return { skipped: true };

  const today = new Date();
  const todayStr = toDateStr(today);

  const { newStreak, alreadyClaimedToday } = projectNextStreak(
    existing.currentStreak || 0,
    existing.lastEligibleActivityDate,
    today,
    { allowStreakRecovery: config.allowStreakRecovery, gracePeriodDays: config.gracePeriodDays }
  );
  if (alreadyClaimedToday) return { duplicate: true, currentStreak: existing.currentStreak || 0 };

  const { rewardDay, storedStreak } = rewardDayForStreak(newStreak, config.dayRewards, config.cycleBehavior);
  const amount = amountForDay(config.dayRewards, rewardDay);

  // Atomic conditional update — only the first check-in for `todayStr` wins the race.
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, lastEligibleActivityDate: { $ne: todayStr } },
    { $set: { currentStreak: storedStreak, lastEligibleActivityDate: todayStr }, $max: { longestStreak: storedStreak } },
    { new: true }
  ).select("currentStreak longestStreak");
  if (!updatedUser) return { duplicate: true, currentStreak: existing.currentStreak || 0 };

  let awardResult: Awaited<ReturnType<typeof awardDamru>> | null = null;
  if (amount > 0) {
    awardResult = await awardDamru({
      userId,
      category: "daily_login",
      amount,
      description: `Day ${rewardDay} Login Streak Reward`,
      idempotencyKey: `daily-login:${userId}:${todayStr}`,
    });
    if (!("duplicate" in awardResult) || !awardResult.duplicate) {
      await User.findByIdAndUpdate(userId, { lastStreakRewardDate: todayStr });
    }
  }

  return {
    duplicate: false,
    currentStreak: updatedUser.currentStreak,
    longestStreak: updatedUser.longestStreak,
    rewardDay,
    amount,
    newBalance: awardResult && "newBalance" in awardResult ? awardResult.newBalance : undefined,
  };
}
