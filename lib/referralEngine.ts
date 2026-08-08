import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Order from "@/models/Order";
import Referral, { IReferral } from "@/models/Referral";
import DamruTransaction from "@/models/DamruTransaction";
import { awardDamru } from "@/lib/rewardEngine";
import { getReferralConfig } from "@/lib/getReferralConfig";
import { generateUniqueReferralCode } from "@/lib/referralCode";

/** Lazily issues a referral code — during registration or the first time it's actually needed. Never regenerated once set. */
export async function getOrCreateReferralCode(userId: string | mongoose.Types.ObjectId): Promise<string> {
  await connectDB();
  const user = await User.findById(userId).select("referralCode").lean<{ referralCode?: string }>();
  if (user?.referralCode) return user.referralCode;

  const config = await getReferralConfig();
  const code = await generateUniqueReferralCode(config.codePrefix, config.codeLength);
  await User.findOneAndUpdate({ _id: userId, referralCode: { $exists: false } }, { $set: { referralCode: code } });
  const updated = await User.findById(userId).select("referralCode").lean<{ referralCode?: string }>();
  return updated?.referralCode || code;
}

/** Pre-registration validation only — no writes. Lets the register route reject an invalid code before creating the account. */
export async function validateReferralCodeForRegistration(rawCode: string): Promise<
  { valid: true; referrerUserId: mongoose.Types.ObjectId } | { valid: false; error: string }
> {
  await connectDB();
  const config = await getReferralConfig();
  if (!config.isActive) return { valid: false, error: "Referral program is currently unavailable." };

  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, error: "Please enter a referral code." };

  const owner = await User.findOne({ referralCode: code }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
  if (!owner) return { valid: false, error: "That referral code isn't valid." };

  return { valid: true, referrerUserId: owner._id };
}

/** Creates the referral relationship after the new user account already exists. */
export async function createReferralRelationship(
  referrerUserId: mongoose.Types.ObjectId | string,
  referredUserId: mongoose.Types.ObjectId | string,
  code: string
) {
  await connectDB();
  if (String(referrerUserId) === String(referredUserId)) return { success: false as const, error: "Self-referral is not allowed." };

  try {
    await Referral.create({
      referrerUserId,
      referredUserId,
      referralCode: code.trim().toUpperCase(),
      status: "PENDING_QUALIFICATION",
      registeredAt: new Date(),
    });
    return { success: true as const };
  } catch (err: unknown) {
    // Unique index on referredUserId — this user already has a referral relationship.
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return { success: false as const, error: "This account already has a referral relationship." };
    }
    throw err;
  }
}

async function ensureTransactionId(idempotencyKey: string, existing: mongoose.Types.ObjectId | null | undefined) {
  if (existing) return existing;
  const tx = await DamruTransaction.findOne({ idempotencyKey }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
  return tx?._id || null;
}

/**
 * Issues both referral rewards independently and idempotently. Safe to call repeatedly —
 * a side that already succeeded (this call or a previous one) is never re-awarded, and a
 * side that previously failed is retried without touching the completed one.
 */
export async function issueReferralRewards(referral: IReferral) {
  await connectDB();

  let referrerTxId = referral.referrerTransactionId || null;
  if (!referrerTxId && referral.referrerRewardAmount > 0) {
    const idempotencyKey = `referral:${referral._id}:referrer`;
    const result = await awardDamru({
      userId: referral.referrerUserId,
      category: "referral",
      amount: referral.referrerRewardAmount,
      description: "Referral Reward — your referral completed their first eligible order.",
      idempotencyKey,
    });
    referrerTxId = result.duplicate
      ? await ensureTransactionId(idempotencyKey, null)
      : (result.transaction?._id || null);
  }

  let referredTxId = referral.referredTransactionId || null;
  if (!referredTxId && referral.referredRewardAmount > 0) {
    const idempotencyKey = `referral:${referral._id}:referred`;
    const result = await awardDamru({
      userId: referral.referredUserId,
      category: "referral",
      amount: referral.referredRewardAmount,
      description: "Referral Bonus — you joined using a referral code.",
      idempotencyKey,
    });
    referredTxId = result.duplicate
      ? await ensureTransactionId(idempotencyKey, null)
      : (result.transaction?._id || null);
  }

  const bothDone =
    (referral.referrerRewardAmount <= 0 || !!referrerTxId) &&
    (referral.referredRewardAmount <= 0 || !!referredTxId);

  await Referral.findByIdAndUpdate(referral._id, {
    $set: {
      referrerTransactionId: referrerTxId,
      referredTransactionId: referredTxId,
      ...(bothDone ? { status: "REWARDED", rewardedAt: new Date() } : {}),
    },
  });

  return { bothDone };
}

/**
 * ORDER_DELIVERED — evaluate whether this order qualifies a pending referral for the
 * ordering user. Hooks into the same trusted delivery event as achievements/missions;
 * does not duplicate any order-status logic.
 */
export async function evaluateReferralQualification(
  referredUserId: mongoose.Types.ObjectId | string,
  orderId: mongoose.Types.ObjectId | string,
  orderAmount: number
) {
  await connectDB();
  const referral = await Referral.findOne({ referredUserId, status: "PENDING_QUALIFICATION" });
  if (!referral) return { skipped: true as const };

  const config = await getReferralConfig();
  if (!config.isActive) return { skipped: true as const };

  const meetsMinimum = orderAmount >= config.minimumOrderAmount;

  if (!meetsMinimum) {
    if (config.qualificationEvent === "FIRST_DELIVERED_ORDER") {
      const deliveredCount = await Order.countDocuments({ userId: referredUserId, status: "delivered" });
      if (deliveredCount === 1) {
        // This was their one and only shot under this rule — it didn't meet the minimum.
        await Referral.findOneAndUpdate(
          { _id: referral._id, status: "PENDING_QUALIFICATION" },
          { $set: { status: "REJECTED", rejectionReason: `First delivered order (₹${orderAmount}) was below the ₹${config.minimumOrderAmount} minimum.` } }
        );
      }
    }
    return { skipped: true as const };
  }

  // Optional verification proxy — this codebase has no dedicated email/phone verification
  // flow yet, so "verified" is approximated from data actually captured at registration.
  if (config.requireMobileVerified) {
    const user = await User.findById(referredUserId).select("phone").lean<{ phone?: string }>();
    if (!user?.phone) return { skipped: true as const };
  }

  if (config.maximumSuccessfulReferralsPerUser !== null) {
    const rewardedCount = await Referral.countDocuments({ referrerUserId: referral.referrerUserId, status: "REWARDED" });
    if (rewardedCount >= config.maximumSuccessfulReferralsPerUser) return { skipped: true as const };
  }

  // Atomic guard — only the first delivery event to reach here can qualify this referral.
  const qualified = await Referral.findOneAndUpdate(
    { _id: referral._id, status: "PENDING_QUALIFICATION" },
    {
      $set: {
        status: "QUALIFIED",
        qualifiedAt: new Date(),
        qualificationOrderId: orderId,
        referrerRewardAmount: config.referrerRewardDamru,
        referredRewardAmount: config.referredUserRewardDamru,
        rewardEligibleAt: config.rewardDelayDays > 0 ? new Date(Date.now() + config.rewardDelayDays * 24 * 60 * 60 * 1000) : new Date(),
      },
    },
    { new: true }
  );
  if (!qualified) return { skipped: true as const };

  if (config.rewardDelayDays > 0) return { qualified: true as const, delayed: true as const };

  const result = await issueReferralRewards(qualified);
  return { qualified: true as const, delayed: false as const, rewarded: result.bothDone };
}

/** Scheduler entry point — issues rewards for referrals whose configured delay has elapsed. Reuses the existing daily cron. */
export async function processDueReferralRewards() {
  await connectDB();
  const due = await Referral.find({ status: "QUALIFIED", rewardEligibleAt: { $lte: new Date() } });
  const results = [];
  for (const referral of due) {
    const result = await issueReferralRewards(referral);
    results.push({ referralId: String(referral._id), ...result });
  }
  return results;
}
