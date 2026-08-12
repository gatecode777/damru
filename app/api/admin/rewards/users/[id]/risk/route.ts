import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { getUserRiskSummary } from "@/lib/rewards/riskEngine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  return NextResponse.json({ summary: await getUserRiskSummary(id) }, { headers: { "Cache-Control": "private, no-store" } });
}
