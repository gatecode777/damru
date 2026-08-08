import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/userSession";
import { getLoyaltySummary } from "@/lib/loyaltyEngine";

export async function GET(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await getLoyaltySummary(user.id)); }
  catch (err) { console.error("GET rewards/loyalty error:", err); return NextResponse.json({ error: "Server error." }, { status: 500 }); }
}
