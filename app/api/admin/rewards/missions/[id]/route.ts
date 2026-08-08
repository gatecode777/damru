import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import AdminUser from "@/models/Admin";
import Mission, { MissionType, MissionPeriodType } from "@/models/Mission";

const MISSION_TYPES: MissionType[] = ["ORDER_COUNT", "SPENDING_AMOUNT", "LOGIN_STREAK", "PROFILE_COMPLETE"];
const PERIOD_TYPES: MissionPeriodType[] = ["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "CAMPAIGN"];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const {
      name, description, missionType, periodType, targetValue,
      rewardDamruAmount, startsAt, endsAt, priority, isActive, eligibility,
    } = body;

    if (name !== undefined && !name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (missionType !== undefined && !MISSION_TYPES.includes(missionType)) return NextResponse.json({ error: "Invalid mission type." }, { status: 400 });
    if (periodType !== undefined && !PERIOD_TYPES.includes(periodType)) return NextResponse.json({ error: "Invalid period type." }, { status: 400 });
    if (targetValue !== undefined && targetValue <= 0) return NextResponse.json({ error: "Target must be a positive number." }, { status: 400 });
    if (rewardDamruAmount !== undefined && (typeof rewardDamruAmount !== "number" || !Number.isInteger(rewardDamruAmount) || rewardDamruAmount < 0)) return NextResponse.json({ error: "Reward amount must be a non-negative whole number." }, { status: 400 });
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return NextResponse.json({ error: "Start date must be before end date." }, { status: 400 });
    if (periodType === "CAMPAIGN" && (!startsAt || !endsAt)) return NextResponse.json({ error: "Campaign missions require both a start and end date." }, { status: 400 });

    await connectDB();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (missionType !== undefined) updates.missionType = missionType;
    if (periodType !== undefined) updates.periodType = periodType;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (rewardDamruAmount !== undefined) updates.rewardDamruAmount = rewardDamruAmount;
    if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;
    if (priority !== undefined) updates.priority = priority;
    if (isActive !== undefined) updates.isActive = isActive;
    if (eligibility !== undefined) updates.eligibility = eligibility;

    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = await AdminUser.findOne({ email: (session?.user as any)?.email }).select("_id").lean<{ _id: unknown } | null>();
    if (admin) updates.updatedBy = admin._id;

    const mission = await Mission.findByIdAndUpdate(id, updates, { new: true });
    if (!mission) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

    return NextResponse.json({ success: true, mission });
  } catch (err) {
    console.error("PUT admin/rewards/missions/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
