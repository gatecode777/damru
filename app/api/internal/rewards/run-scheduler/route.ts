import { NextRequest, NextResponse } from "next/server";
import { runOccasionRewards } from "@/lib/rewardEngine";
import { processDueReferralRewards } from "@/lib/referralEngine";
import { processExpiredDamru } from "@/lib/rewards/damruAllocation";

// Vercel Cron Jobs send a GET request with an `Authorization: Bearer <CRON_SECRET>`
// header automatically when the CRON_SECRET env var is set on the project.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runOccasionRewards(new Date());
    const referralResults = await processDueReferralRewards();
    // Reuses this existing daily cron rather than a new one (PRD 4A section 25)
    // — day-granularity expiry doesn't need a tighter cadence than once a day.
    const expiry = await processExpiredDamru();
    return NextResponse.json({ success: true, count: results.length, results, referrals: referralResults, expiry });
  } catch (err) {
    console.error("run-scheduler error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
