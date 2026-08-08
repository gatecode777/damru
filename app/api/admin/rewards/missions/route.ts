import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import AdminUser from "@/models/Admin";
import Mission, { MissionType, MissionPeriodType } from "@/models/Mission";

const MISSION_TYPES: MissionType[] = ["ORDER_COUNT", "SPENDING_AMOUNT", "LOGIN_STREAK", "PROFILE_COMPLETE"];
const PERIOD_TYPES: MissionPeriodType[] = ["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "CAMPAIGN"];

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const missions = await Mission.find().sort({ priority: -1, createdAt: 1 }).lean();
    return NextResponse.json({ missions: JSON.parse(JSON.stringify(missions)) });
  } catch (err) {
    console.error("GET admin/rewards/missions error:", err);
    return NextResponse.json({ missions: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const {
      name, code, description, missionType, periodType, targetValue,
      rewardDamruAmount, startsAt, endsAt, priority, eligibility,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!code?.trim()) return NextResponse.json({ error: "Code is required." }, { status: 400 });
    if (!MISSION_TYPES.includes(missionType)) return NextResponse.json({ error: "Invalid mission type." }, { status: 400 });
    if (!PERIOD_TYPES.includes(periodType)) return NextResponse.json({ error: "Invalid period type." }, { status: 400 });
    if (typeof targetValue !== "number" || targetValue <= 0) return NextResponse.json({ error: "Target must be a positive number." }, { status: 400 });
    if (rewardDamruAmount !== undefined && (typeof rewardDamruAmount !== "number" || !Number.isInteger(rewardDamruAmount) || rewardDamruAmount < 0)) return NextResponse.json({ error: "Reward amount must be a non-negative whole number." }, { status: 400 });
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return NextResponse.json({ error: "Start date must be before end date." }, { status: 400 });
    if (periodType === "CAMPAIGN" && (!startsAt || !endsAt)) return NextResponse.json({ error: "Campaign missions require both a start and end date." }, { status: 400 });

    await connectDB();
    const existing = await Mission.findOne({ code: code.trim().toUpperCase() }).lean();
    if (existing) return NextResponse.json({ error: "A mission with this code already exists." }, { status: 400 });

    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = await AdminUser.findOne({ email: (session?.user as any)?.email }).select("_id").lean<{ _id: mongoose.Types.ObjectId } | null>();

    const mission = await Mission.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || "",
      missionType,
      periodType,
      targetValue,
      rewardDamruAmount: rewardDamruAmount || 0,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      priority: priority || 0,
      eligibility: eligibility || undefined,
      createdBy: admin?._id,
      updatedBy: admin?._id,
    });

    return NextResponse.json({ success: true, mission });
  } catch (err) {
    console.error("POST admin/rewards/missions error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
