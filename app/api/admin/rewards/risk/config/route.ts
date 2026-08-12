import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { logAdminAction } from "@/lib/auditLog";
import { connectDB } from "@/lib/mongodb";
import { getRewardRiskConfig, saveRewardRiskConfig } from "@/lib/rewards/riskConfig";
import Admin from "@/models/Admin";

async function getCurrentAdminId() {
  const session = await auth();
  const identity = session?.user as { id?: string; email?: string } | undefined;
  await connectDB();
  const admin = await Admin.findOne({ $or: [
    ...(identity?.id && mongoose.isValidObjectId(identity.id) ? [{ _id: identity.id }] : []),
    ...(identity?.email ? [{ email: identity.email.toLowerCase() }] : []),
  ] }).select("_id").lean<{ _id: mongoose.Types.ObjectId }>();
  return admin?._id || null;
}

export async function GET() {
  const deny = await checkApiPerm("rewards", "view");
  if (deny) return deny;
  try {
    return NextResponse.json({ config: await getRewardRiskConfig() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET reward risk config error:", error);
    return NextResponse.json({ error: "Unable to load risk thresholds." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;
  try {
    const adminId = await getCurrentAdminId();
    if (!adminId) return NextResponse.json({ error: "Admin not found." }, { status: 401 });
    const body = await request.json();
    const previous = await getRewardRiskConfig();
    const document = await saveRewardRiskConfig(body?.config, adminId);
    const config = document.values;
    await logAdminAction("reward_risk_config_updated", {
      targetType: "RewardRiskConfig",
      targetId: String(document._id),
      details: { previous, next: config },
    });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update risk thresholds.";
    const status = /must be|threshold/i.test(message) ? 400 : 500;
    if (status === 500) console.error("PUT reward risk config error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
