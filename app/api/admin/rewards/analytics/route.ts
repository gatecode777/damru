import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { getRewardsAnalytics } from "@/lib/rewards/analyticsService";

export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;
  try {
    const params = req.nextUrl.searchParams;
    const data = await getRewardsAnalytics({ preset: params.get("preset") || undefined, start: params.get("start"), end: params.get("end"), page: Number(params.get("page") || 1), limit: Number(params.get("limit") || 10) });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load rewards analytics.";
    const status = /date|before/i.test(message) ? 400 : 500;
    if (status === 500) console.error("GET admin rewards analytics error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
