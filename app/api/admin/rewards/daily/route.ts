import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { getOrCreateDailyStreakConfig } from "@/lib/getDailyStreakConfig";

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;

  try {
    const config = await getOrCreateDailyStreakConfig();
    return NextResponse.json({ config: JSON.parse(JSON.stringify(config)) });
  } catch (err) {
    console.error("GET admin/rewards/daily error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const body = await req.json();
    const { isActive, dayRewards, cycleBehavior, allowStreakRecovery, gracePeriodDays } = body;

    if (dayRewards !== undefined) {
      if (!Array.isArray(dayRewards) || dayRewards.length === 0) {
        return NextResponse.json({ error: "At least one day reward is required." }, { status: 400 });
      }
      for (const d of dayRewards) {
        if (typeof d.day !== "number" || d.day < 1 || typeof d.amount !== "number" || !Number.isInteger(d.amount) || d.amount < 0) {
          return NextResponse.json({ error: "Each day reward needs a positive day number and a non-negative whole-number amount." }, { status: 400 });
        }
      }
    }
    if (cycleBehavior !== undefined && !["restart", "continue", "weekly_cycle"].includes(cycleBehavior)) {
      return NextResponse.json({ error: "Invalid cycle behaviour." }, { status: 400 });
    }
    if (gracePeriodDays !== undefined && (gracePeriodDays < 0 || gracePeriodDays > 1)) {
      return NextResponse.json({ error: "Grace period must be 0 or 1 day." }, { status: 400 });
    }

    const config = await getOrCreateDailyStreakConfig();
    if (isActive !== undefined) config.isActive = isActive;
    if (dayRewards !== undefined) config.dayRewards = [...dayRewards].sort((a, b) => a.day - b.day);
    if (cycleBehavior !== undefined) config.cycleBehavior = cycleBehavior;
    if (allowStreakRecovery !== undefined) config.allowStreakRecovery = allowStreakRecovery;
    if (gracePeriodDays !== undefined) config.gracePeriodDays = gracePeriodDays;
    await config.save();

    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error("PUT admin/rewards/daily error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
