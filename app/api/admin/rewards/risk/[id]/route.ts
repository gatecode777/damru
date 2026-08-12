import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import { logAdminAction } from "@/lib/auditLog";
import { getRiskEventDetail } from "@/lib/rewards/riskAdminService";
import { resolveRiskEvent, RiskReviewAction } from "@/lib/rewards/riskEngine";
import Admin from "@/models/Admin";

const ACTIONS: RiskReviewAction[] = ["UNDER_REVIEW", "MONITOR", "RESOLVE_LEGITIMATE", "RESOLVE_ABUSE", "RESOLVE_NO_ACTION", "DISMISS"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;
  const { id } = await params;
  const detail = await getRiskEventDetail(id);
  return detail
    ? NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Risk event not found." }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid risk event." }, { status: 400 });
  try {
    const body = await req.json();
    const action = body.action as RiskReviewAction;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    if (!["UNDER_REVIEW", "MONITOR"].includes(action) && (note.length < 5 || note.length > 1000)) {
      return NextResponse.json({ error: "Enter a review note between 5 and 1000 characters." }, { status: 400 });
    }

    const session = await auth();
    await connectDB();
    const identity = (session?.user as { id?: string; email?: string } | undefined);
    const admin = await Admin.findOne({ $or: [
      ...(identity?.id && mongoose.isValidObjectId(identity.id) ? [{ _id: identity.id }] : []),
      ...(identity?.email ? [{ email: identity.email.toLowerCase() }] : []),
    ] }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const result = await resolveRiskEvent({ eventId: id, action, reviewedBy: admin._id, note });
    if (!result) return NextResponse.json({ error: "Risk event changed or no longer exists." }, { status: 409 });
    await logAdminAction("reward_risk_reviewed", {
      targetType: "RewardRiskEvent",
      targetId: id,
      details: { previousStatus: result.previousStatus, newStatus: result.event.status, decision: result.event.reviewDecision, note },
    });
    return NextResponse.json({ success: true, event: result.event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the risk event.";
    const status = /already been closed/i.test(message) ? 409 : 500;
    if (status === 500) console.error("PATCH admin reward risk error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
