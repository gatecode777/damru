import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import User from "@/models/User";
import { getDamruConfig } from "@/lib/getDamruConfig";

const LEVEL_ORDER = ["bronze", "silver", "gold", "platinum"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntilNextOccurrence(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next.setFullYear(now.getFullYear() + 1);
  }
  return Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / MS_PER_DAY);
}

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const user = await User.findById(sessionUser.id)
      .select("dateOfBirth marriageAnniversary damruTotalEarned loyaltyLevel")
      .lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const config = await getDamruConfig();
    const currentIdx = LEVEL_ORDER.indexOf(user.loyaltyLevel);
    const nextLevel = currentIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentIdx + 1] : null;
    const nextThreshold = nextLevel ? (config.loyaltyThresholds as any)[nextLevel] : null;

    return NextResponse.json({
      birthdayDaysLeft: daysUntilNextOccurrence(user.dateOfBirth),
      anniversaryDaysLeft: daysUntilNextOccurrence(user.marriageAnniversary),
      // Already fetched above for the days-left calculation — returning the
      // locked value too so the UI can show the saved date, not just "Set".
      dateOfBirth: user.dateOfBirth ?? null,
      marriageAnniversary: user.marriageAnniversary ?? null,
      nextLoyaltyLevel: nextLevel,
      damruToNextLevel: nextThreshold !== null ? Math.max(0, nextThreshold - user.damruTotalEarned) : 0,
    });
  } catch (err) {
    console.error("GET rewards/upcoming error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
