import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import User from "@/models/User";
import DamruTransaction from "@/models/DamruTransaction";
import Coupon from "@/models/Coupon";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { getDailyStreakConfig } from "@/lib/getDailyStreakConfig";
import { projectNextStreak, rewardDayForStreak, amountForDay } from "@/lib/dailyStreak";
import Achievement from "@/models/Achievement";
import UserAchievement from "@/models/UserAchievement";
import UserMission from "@/models/UserMission";
import Referral from "@/models/Referral";
import { getOrCreateReferralCode } from "@/lib/referralEngine";
import { getLoyaltySummary } from "@/lib/loyaltyEngine";
import { getExpiringSummary } from "@/lib/rewards/damruAllocation";

const LEVEL_ORDER = ["bronze", "silver", "gold", "platinum"] as const;

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type PopulatedUserAchievement = {
    unlockedAt?: Date;
    achievementId: { _id: unknown; name: string; badgeName?: string; badgeIcon?: string } | null;
  };
  type PopulatedUserMission = {
    progress: number;
    target: number;
    missionId: { _id: unknown; name: string; rewardDamruAmount: number } | null;
  };

  try {
    await connectDB();
    const now = new Date();
    const ACTIVE_REFERRAL_STATUSES = ["REGISTERED", "PENDING_QUALIFICATION", "QUALIFIED"];

    // The website renders detailed missions, achievements, referrals, coupons and
    // history from their dedicated endpoints. Avoid blocking its wallet card on
    // those unrelated queries.
    if (req.nextUrl.searchParams.get("view") === "wallet") {
      const [compactUser, config, streakConfig] = await Promise.all([
        User.findById(sessionUser.id)
          .select("damruBalance damruTotalEarned damruTotalRedeemed rewardDebt loyaltyLevel currentStreak longestStreak lastEligibleActivityDate")
          .lean(),
        getDamruConfig(),
        getDailyStreakConfig(),
      ]);

      if (!compactUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const u = compactUser as any;
      const [loyalty, expirySummary] = await Promise.all([
        getLoyaltySummary(sessionUser.id, u.damruTotalEarned || 0),
        getExpiringSummary(sessionUser.id, config),
      ]);
      const currentIdx = LEVEL_ORDER.indexOf(u.loyaltyLevel);
      const nextLevel = currentIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIdx + 1] : null;
      const nextThreshold = nextLevel ? (config.loyaltyThresholds as any)[nextLevel] : null;
      const damruToNextLevel = nextThreshold !== null ? Math.max(0, nextThreshold - u.damruTotalEarned) : 0;
      const projection = projectNextStreak(
        u.currentStreak || 0,
        u.lastEligibleActivityDate || null,
        now,
        { allowStreakRecovery: streakConfig.allowStreakRecovery, gracePeriodDays: streakConfig.gracePeriodDays }
      );
      const nextStreak = projection.alreadyClaimedToday ? projection.newStreak + 1 : projection.newStreak;
      const { rewardDay: nextRewardDay } = rewardDayForStreak(nextStreak, streakConfig.dayRewards, streakConfig.cycleBehavior);

      return NextResponse.json({
        damruBalance: u.damruBalance ?? 0,
        damruTotalEarned: u.damruTotalEarned ?? 0,
        damruTotalRedeemed: u.damruTotalRedeemed ?? 0,
        rewardDebt: u.rewardDebt || 0,
        loyaltyLevel: u.loyaltyLevel,
        nextLevel,
        damruToNextLevel,
        activeCoupons: [],
        recentTransactions: [],
        streak: {
          isActive: streakConfig.isActive,
          currentStreak: u.currentStreak || 0,
          longestStreak: u.longestStreak || 0,
          claimedToday: projection.alreadyClaimedToday,
          nextRewardDay,
          nextRewardAmount: amountForDay(streakConfig.dayRewards, nextRewardDay),
          cycleLength: streakConfig.dayRewards.length,
          days: streakConfig.dayRewards,
        },
        achievementSummary: { unlocked: 0, total: 0, recentlyUnlocked: [] },
        missionSummary: { active: 0, completed: 0, featured: [] },
        referralSummary: { successful: 0, pending: 0, totalDamruEarned: 0, referralCode: "" },
        loyalty: {
          currentTier: loyalty.currentTier,
          nextTier: loyalty.nextTier,
          progressPercentage: loyalty.progress.percentage,
          remainingValue: loyalty.progress.remainingValue,
        },
        expiry: expirySummary,
      });
    }

    // Every value below is independently readable — none depends on another's result — so
    // they're fetched as one batch instead of ~15 sequential round trips. (Trade-off: on the
    // rare stale-cookie-for-a-deleted-user edge case, this now runs every query before the
    // 404 check instead of short-circuiting after the first; worthwhile for the common case.)
    const [
      user,
      config,
      activeCoupons,
      recentTransactions,
      streakConfig,
      achievementTotal,
      unlockedUserAchievements,
      unlockedCount,
      activeMissionCount,
      completedMissionCount,
      featuredMissions,
      referralPending,
      referralSuccessful,
      referralEarnedAgg,
      loyalty,
    ] = await Promise.all([
      User.findById(sessionUser.id)
        .select("damruBalance damruTotalEarned damruTotalRedeemed rewardDebt loyaltyLevel currentStreak longestStreak lastEligibleActivityDate referralCode")
        .lean(),
      getDamruConfig(),
      Coupon.find({
        isActive: true,
        startDate: { $lte: now },
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
        $and: [{ $or: [{ userId: null }, { userId: sessionUser.id }] }],
      })
        .select("code description type value maxDiscount minOrderValue expiryDate")
        .sort({ createdAt: -1 })
        .lean(),
      DamruTransaction.find({ userId: sessionUser.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("type category amount description createdAt expiresAt")
        .lean(),
      getDailyStreakConfig(),
      Achievement.countDocuments({ isActive: true }),
      UserAchievement.find({ userId: sessionUser.id, status: "CLAIMED" })
        .sort({ unlockedAt: -1 })
        .limit(3)
        .populate("achievementId", "name badgeName badgeIcon")
        .lean<PopulatedUserAchievement[]>(),
      UserAchievement.countDocuments({ userId: sessionUser.id, status: "CLAIMED" }),
      UserMission.countDocuments({ userId: sessionUser.id, status: "IN_PROGRESS" }),
      UserMission.countDocuments({ userId: sessionUser.id, status: { $in: ["COMPLETED", "CLAIMED"] } }),
      UserMission.find({ userId: sessionUser.id, status: "IN_PROGRESS" })
        .sort({ updatedAt: -1 })
        .limit(3)
        .populate("missionId", "name rewardDamruAmount")
        .lean<PopulatedUserMission[]>(),
      Referral.countDocuments({ referrerUserId: sessionUser.id, status: { $in: ACTIVE_REFERRAL_STATUSES } }),
      Referral.countDocuments({ referrerUserId: sessionUser.id, status: "REWARDED" }),
      Referral.aggregate([
        { $match: { referrerUserId: new mongoose.Types.ObjectId(sessionUser.id), status: "REWARDED" } },
        { $group: { _id: null, total: { $sum: "$referrerRewardAmount" } } },
      ]),
      getLoyaltySummary(sessionUser.id),
    ]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const u = user as any;
    
    let finalReferralCode = u.referralCode;
    if (!finalReferralCode) {
      finalReferralCode = await getOrCreateReferralCode(sessionUser.id);
    }
    
    const expirySummary = await getExpiringSummary(sessionUser.id, config);

    const currentIdx = LEVEL_ORDER.indexOf(u.loyaltyLevel);
    const nextLevel = currentIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIdx + 1] : null;
    const nextThreshold = nextLevel ? (config.loyaltyThresholds as any)[nextLevel] : null;
    const damruToNextLevel = nextThreshold !== null ? Math.max(0, nextThreshold - u.damruTotalEarned) : 0;

    const proj = projectNextStreak(
      u.currentStreak || 0,
      u.lastEligibleActivityDate || null,
      now,
      { allowStreakRecovery: streakConfig.allowStreakRecovery, gracePeriodDays: streakConfig.gracePeriodDays }
    );
    const nextStreakNum = proj.alreadyClaimedToday ? proj.newStreak + 1 : proj.newStreak;
    const { rewardDay: nextRewardDay } = rewardDayForStreak(nextStreakNum, streakConfig.dayRewards, streakConfig.cycleBehavior);
    const nextRewardAmount = amountForDay(streakConfig.dayRewards, nextRewardDay);

    const recentlyUnlocked = unlockedUserAchievements
      .filter(ua => ua.achievementId)
      .map(ua => ({
        id: String(ua.achievementId!._id),
        name: ua.achievementId!.name,
        badgeName: ua.achievementId!.badgeName || null,
        badgeIcon: ua.achievementId!.badgeIcon || null,
        unlockedAt: ua.unlockedAt,
      }));

    const featured = featuredMissions
      .filter(um => um.missionId)
      .map(um => ({
        id: String(um.missionId!._id),
        name: um.missionId!.name,
        progress: um.progress,
        target: um.target,
        progressPercentage: um.target > 0 ? Math.min(100, Math.round((um.progress / um.target) * 100)) : 0,
        damruAmount: um.missionId!.rewardDamruAmount,
      }));

    return NextResponse.json({
      damruBalance: u.damruBalance ?? 0,
      damruTotalEarned: u.damruTotalEarned ?? 0,
      damruTotalRedeemed: u.damruTotalRedeemed ?? 0,
      rewardDebt: u.rewardDebt || 0,
      loyaltyLevel: u.loyaltyLevel,
      nextLevel,
      damruToNextLevel,
      activeCoupons: JSON.parse(JSON.stringify(activeCoupons)),
      recentTransactions: JSON.parse(JSON.stringify(recentTransactions)),
      streak: {
        isActive: streakConfig.isActive,
        currentStreak: u.currentStreak || 0,
        longestStreak: u.longestStreak || 0,
        claimedToday: proj.alreadyClaimedToday,
        nextRewardDay,
        nextRewardAmount,
        cycleLength: streakConfig.dayRewards.length,
        days: streakConfig.dayRewards,
      },
      achievementSummary: {
        unlocked: unlockedCount,
        total: achievementTotal,
        recentlyUnlocked,
      },
      missionSummary: {
        active: activeMissionCount,
        completed: completedMissionCount,
        featured,
      },
      referralSummary: {
        successful: referralSuccessful,
        pending: referralPending,
        totalDamruEarned: referralEarnedAgg[0]?.total || 0,
        referralCode: finalReferralCode,
      },
      loyalty: { currentTier: loyalty.currentTier, nextTier: loyalty.nextTier, progressPercentage: loyalty.progress.percentage, remainingValue: loyalty.progress.remainingValue },
      expiry: expirySummary,
    });
  } catch (err) {
    console.error("GET rewards/dashboard error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
