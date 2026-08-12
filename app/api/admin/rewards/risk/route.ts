import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { listRiskEvents } from "@/lib/rewards/riskAdminService";
import { REWARD_RISK_EVENT_TYPES, REWARD_RISK_SEVERITIES, REWARD_RISK_STATUSES } from "@/models/RewardRiskEvent";

const numberParam = (value: string | null) => value === null || value.trim() === "" ? undefined : Number(value);

export async function GET(req: NextRequest) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;
  try {
    const query = req.nextUrl.searchParams;
    const minScore = numberParam(query.get("minScore"));
    const maxScore = numberParam(query.get("maxScore"));
    const start = query.get("start");
    const end = query.get("end");
    const page = numberParam(query.get("page"));
    const limit = numberParam(query.get("limit"));
    const severity = query.get("severity");
    const status = query.get("status");
    const eventType = query.get("eventType");
    const search = query.get("search");
    if ((page !== undefined && (!Number.isInteger(page) || page < 1)) || (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50))) {
      return NextResponse.json({ error: "Pagination values are invalid." }, { status: 400 });
    }
    if ((severity && !REWARD_RISK_SEVERITIES.includes(severity as never)) || (status && !REWARD_RISK_STATUSES.includes(status as never)) || (eventType && !REWARD_RISK_EVENT_TYPES.includes(eventType as never))) {
      return NextResponse.json({ error: "Unsupported risk filter." }, { status: 400 });
    }
    if (search && search.trim().length > 120) return NextResponse.json({ error: "Search is too long." }, { status: 400 });
    if ((minScore !== undefined && (!Number.isFinite(minScore) || minScore < 0 || minScore > 100)) || (maxScore !== undefined && (!Number.isFinite(maxScore) || maxScore < 0 || maxScore > 100)) || (minScore !== undefined && maxScore !== undefined && minScore > maxScore)) {
      return NextResponse.json({ error: "Risk score filters must be between 0 and 100." }, { status: 400 });
    }
    if ((start && Number.isNaN(Date.parse(start))) || (end && Number.isNaN(Date.parse(end)))) {
      return NextResponse.json({ error: "Invalid date filter." }, { status: 400 });
    }
    if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
      return NextResponse.json({ error: "Start date must not be after end date." }, { status: 400 });
    }
    const data = await listRiskEvents({
      page,
      limit,
      severity,
      status,
      eventType,
      minScore,
      maxScore,
      start,
      end,
      search,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET admin reward risk error:", error);
    return NextResponse.json({ error: "Unable to load the risk review queue." }, { status: 500 });
  }
}
