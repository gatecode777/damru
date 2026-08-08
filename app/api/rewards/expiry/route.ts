import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import { getDamruConfig } from "@/lib/getDamruConfig";
import { getExpiringSummary, getExpiryBreakdown } from "@/lib/rewards/damruAllocation";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const config = await getDamruConfig();
    const [summary, breakdown] = await Promise.all([
      getExpiringSummary(sessionUser.id, config),
      getExpiryBreakdown(sessionUser.id),
    ]);

    return NextResponse.json({
      enabled: summary.enabled,
      warningDays: summary.warningDays,
      expiringSoonAmount: summary.expiringSoonAmount,
      nearestExpiryDate: summary.nearestExpiryDate,
      breakdown,
    });
  } catch (err) {
    console.error("GET rewards/expiry error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
