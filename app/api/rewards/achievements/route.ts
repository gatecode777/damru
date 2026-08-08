import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import Achievement, { IAchievement } from "@/models/Achievement";
import UserAchievement from "@/models/UserAchievement";
import User from "@/models/User";
import {
  evaluateOrderAchievements,
  evaluateStreakAchievements,
  evaluateProfileAchievement,
  evaluateAccountAgeAchievements,
} from "@/lib/achievementEngine";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const user = await User.findById(sessionUser.id)
      .select("currentStreak createdAt")
      .lean<{ currentStreak: number; createdAt: Date }>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Refresh progress for every condition type so the list is always current when opened.
    await Promise.allSettled([
      evaluateOrderAchievements(sessionUser.id),
      evaluateStreakAchievements(sessionUser.id, user.currentStreak || 0),
      evaluateProfileAchievement(sessionUser.id),
      evaluateAccountAgeAchievements(sessionUser.id, user.createdAt),
    ]);

    const now = new Date();
    const [achievements, userAchievements] = await Promise.all([
      Achievement.find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        ],
      }).sort({ priority: -1, createdAt: 1 }).lean<IAchievement[]>(),
      UserAchievement.find({ userId: sessionUser.id }).lean(),
    ]);

    const progressByAchievement = new Map(userAchievements.map(ua => [String(ua.achievementId), ua]));

    const list = achievements.map(a => {
      const ua = progressByAchievement.get(String(a._id));
      const progress = ua?.progress ?? 0;
      const target = a.conditionValue;
      const status = ua?.status ?? "IN_PROGRESS";
      return {
        id: String(a._id),
        name: a.name,
        description: a.description,
        category: a.category,
        progress,
        target,
        progressPercentage: target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0,
        status,
        badgeName: a.badgeName || null,
        badgeIcon: a.badgeIcon || null,
        reward: {
          type: a.rewardDamruAmount > 0 && a.badgeName ? "damru_badge" : a.badgeName ? "badge" : "damru",
          damruAmount: a.rewardDamruAmount,
        },
        unlockedAt: ua?.unlockedAt || null,
      };
    });

    const unlocked = list.filter(a => a.status === "CLAIMED").length;
    const inProgress = list.length - unlocked;

    return NextResponse.json({
      summary: { total: list.length, unlocked, inProgress },
      achievements: list,
    });
  } catch (err) {
    console.error("GET rewards/achievements error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
