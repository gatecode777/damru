import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import Achievement, { AchievementCategory, AchievementConditionType } from "@/models/Achievement";

const CATEGORIES: AchievementCategory[] = ["SHOPPING", "SPENDING", "ENGAGEMENT", "PROFILE", "LOYALTY", "REFERRAL", "SPECIAL"];
const CONDITION_TYPES: AchievementConditionType[] = ["ORDER_COUNT", "LIFETIME_SPEND", "LOGIN_STREAK", "PROFILE_COMPLETE", "ACCOUNT_AGE_DAYS"];

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    await connectDB();
    const achievements = await Achievement.find().sort({ priority: -1, createdAt: 1 }).lean();
    return NextResponse.json({ achievements: JSON.parse(JSON.stringify(achievements)) });
  } catch (err) {
    console.error("GET admin/rewards/achievements error:", err);
    return NextResponse.json({ achievements: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { name, code, description, category, conditionType, conditionValue, rewardDamruAmount, badgeName, badgeIcon, priority, startsAt, endsAt } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!code?.trim()) return NextResponse.json({ error: "Code is required." }, { status: 400 });
    if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    if (!CONDITION_TYPES.includes(conditionType)) return NextResponse.json({ error: "Invalid condition type." }, { status: 400 });
    if (typeof conditionValue !== "number" || conditionValue <= 0) return NextResponse.json({ error: "Target must be a positive number." }, { status: 400 });
    if (rewardDamruAmount !== undefined && (typeof rewardDamruAmount !== "number" || !Number.isInteger(rewardDamruAmount) || rewardDamruAmount < 0)) return NextResponse.json({ error: "Reward amount must be a non-negative whole number." }, { status: 400 });
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return NextResponse.json({ error: "Start date must be before end date." }, { status: 400 });

    await connectDB();
    const existing = await Achievement.findOne({ code: code.trim().toUpperCase() }).lean();
    if (existing) return NextResponse.json({ error: "An achievement with this code already exists." }, { status: 400 });

    const achievement = await Achievement.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || "",
      category,
      conditionType,
      conditionValue,
      rewardDamruAmount: rewardDamruAmount || 0,
      badgeName: badgeName?.trim() || undefined,
      badgeIcon: badgeIcon?.trim() || undefined,
      priority: priority || 0,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    });

    return NextResponse.json({ success: true, achievement });
  } catch (err) {
    console.error("POST admin/rewards/achievements error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
