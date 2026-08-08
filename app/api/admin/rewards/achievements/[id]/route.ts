import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import Achievement, { AchievementCategory, AchievementConditionType } from "@/models/Achievement";

const CATEGORIES: AchievementCategory[] = ["SHOPPING", "SPENDING", "ENGAGEMENT", "PROFILE", "LOYALTY", "REFERRAL", "SPECIAL"];
const CONDITION_TYPES: AchievementConditionType[] = ["ORDER_COUNT", "LIFETIME_SPEND", "LOGIN_STREAK", "PROFILE_COMPLETE", "ACCOUNT_AGE_DAYS"];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { name, description, category, conditionType, conditionValue, rewardDamruAmount, badgeName, badgeIcon, priority, isActive, startsAt, endsAt } = body;

    if (name !== undefined && !name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (category !== undefined && !CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    if (conditionType !== undefined && !CONDITION_TYPES.includes(conditionType)) return NextResponse.json({ error: "Invalid condition type." }, { status: 400 });
    if (conditionValue !== undefined && conditionValue <= 0) return NextResponse.json({ error: "Target must be a positive number." }, { status: 400 });
    if (rewardDamruAmount !== undefined && (typeof rewardDamruAmount !== "number" || !Number.isInteger(rewardDamruAmount) || rewardDamruAmount < 0)) return NextResponse.json({ error: "Reward amount must be a non-negative whole number." }, { status: 400 });
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) return NextResponse.json({ error: "Start date must be before end date." }, { status: 400 });

    await connectDB();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (category !== undefined) updates.category = category;
    if (conditionType !== undefined) updates.conditionType = conditionType;
    if (conditionValue !== undefined) updates.conditionValue = conditionValue;
    if (rewardDamruAmount !== undefined) updates.rewardDamruAmount = rewardDamruAmount;
    if (badgeName !== undefined) updates.badgeName = badgeName?.trim() || undefined;
    if (badgeIcon !== undefined) updates.badgeIcon = badgeIcon?.trim() || undefined;
    if (priority !== undefined) updates.priority = priority;
    if (isActive !== undefined) updates.isActive = isActive;
    if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;

    const achievement = await Achievement.findByIdAndUpdate(id, updates, { new: true });
    if (!achievement) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });

    return NextResponse.json({ success: true, achievement });
  } catch (err) {
    console.error("PUT admin/rewards/achievements/[id] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
