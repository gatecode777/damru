import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import Mission, { IMission } from "@/models/Mission";
import UserMission, { UserMissionStatus } from "@/models/UserMission";
import { expireStaleUserMissions } from "@/lib/missionEngine";
import { getPeriodKey, getPeriodEnd } from "@/lib/missionPeriod";

const EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

interface MissionEntry {
  id: string;
  name: string;
  description: string;
  missionType: string;
  periodType: string;
  progress: number;
  target: number;
  progressPercentage: number;
  status: UserMissionStatus;
  reward: { damruAmount: number };
  startsAt: string | null;
  endsAt: string | null;
  timeRemaining: number | null;
  priority: number;
  completedAt: string | null;
}

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    await expireStaleUserMissions(sessionUser.id);

    const now = new Date();

    const [userMissions, activeMissions] = await Promise.all([
      UserMission.find({ userId: sessionUser.id })
        .populate<{ missionId: IMission | null }>("missionId")
        .sort({ updatedAt: -1 })
        .lean(),
      Mission.find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        ],
      }).lean<IMission[]>(),
    ]);

    const byKey = new Map<string, MissionEntry>();

    for (const um of userMissions) {
      const mission = um.missionId;
      if (!mission) continue;
      const key = `${mission._id}:${um.periodKey}`;
      const periodEnd = getPeriodEnd(mission.periodType, um.periodKey);
      const boundary = periodEnd || mission.endsAt || null;
      byKey.set(key, {
        id: String(mission._id),
        name: mission.name,
        description: mission.description,
        missionType: mission.missionType,
        periodType: mission.periodType,
        progress: um.progress,
        target: um.target,
        progressPercentage: um.target > 0 ? Math.min(100, Math.round((um.progress / um.target) * 100)) : 0,
        status: um.status,
        reward: { damruAmount: mission.rewardDamruAmount },
        startsAt: mission.startsAt ? new Date(mission.startsAt).toISOString() : null,
        endsAt: boundary ? new Date(boundary).toISOString() : null,
        timeRemaining: boundary ? Math.max(0, new Date(boundary).getTime() - now.getTime()) : null,
        priority: mission.priority,
        completedAt: um.completedAt ? new Date(um.completedAt).toISOString() : null,
      });
    }

    // Missions the user hasn't touched yet in their current period — shown as 0 progress, not persisted.
    for (const mission of activeMissions) {
      const periodKey = getPeriodKey(mission.periodType, String(mission._id), now);
      const key = `${mission._id}:${periodKey}`;
      if (byKey.has(key)) continue;
      const periodEnd = getPeriodEnd(mission.periodType, periodKey);
      const boundary = periodEnd || mission.endsAt || null;
      byKey.set(key, {
        id: String(mission._id),
        name: mission.name,
        description: mission.description,
        missionType: mission.missionType,
        periodType: mission.periodType,
        progress: 0,
        target: mission.targetValue,
        progressPercentage: 0,
        status: "IN_PROGRESS",
        reward: { damruAmount: mission.rewardDamruAmount },
        startsAt: mission.startsAt ? new Date(mission.startsAt).toISOString() : null,
        endsAt: boundary ? new Date(boundary).toISOString() : null,
        timeRemaining: boundary ? Math.max(0, new Date(boundary).getTime() - now.getTime()) : null,
        priority: mission.priority,
        completedAt: null,
      });
    }

    const all = Array.from(byKey.values());
    const inProgress = all.filter(m => m.status === "IN_PROGRESS")
      .sort((a, b) => (b.priority - a.priority) || (b.progressPercentage - a.progressPercentage) || ((a.timeRemaining ?? Infinity) - (b.timeRemaining ?? Infinity)));
    const done = all.filter(m => m.status === "COMPLETED" || m.status === "CLAIMED")
      .sort((a, b) => (b.priority - a.priority) || (Date.parse(b.completedAt || "") - Date.parse(a.completedAt || "")));
    const expired = all.filter(m => m.status === "EXPIRED")
      .sort((a, b) => b.priority - a.priority);

    const missions = [...inProgress, ...done, ...expired];
    const expiringSoon = inProgress.filter(m => m.timeRemaining !== null && m.timeRemaining <= EXPIRING_SOON_MS).length;

    return NextResponse.json({
      summary: { active: inProgress.length, completed: done.length, expiringSoon },
      missions,
    });
  } catch (err) {
    console.error("GET rewards/missions error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
