import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { connectDB } from "@/lib/mongodb";
import { logAdminAction, resolveSessionAdmin } from "@/lib/auditLog";
import { applyReversal } from "@/lib/rewards/reversalEngine";
import DamruTransaction from "@/models/DamruTransaction";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid reward transaction." }, { status: 400 });

  try {
    const body = await req.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length < 5 || note.length > 500) return NextResponse.json({ error: "Enter a correction note between 5 and 500 characters." }, { status: 400 });

    await connectDB();
    const admin = await resolveSessionAdmin();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const original = await DamruTransaction.findOne({ _id: id, type: "credit", amount: { $gt: 0 } }).select("_id").lean();
    if (!original) return NextResponse.json({ error: "Only an original credit transaction can be reversed." }, { status: 400 });

    const result = await applyReversal(id, { reason: "ADMIN_CORRECTION", triggerId: `admin:${id}`, createdBy: admin._id, note, allowManualCredit: true });
    if (result.unsupported) return NextResponse.json({ error: "This legacy transaction cannot be reversed safely." }, { status: 409 });
    if (result.alreadyReversed) return NextResponse.json({ error: "This reward has already been fully reversed." }, { status: 409 });

    await logAdminAction("reward_reversed", {
      targetType: "DamruTransaction",
      targetId: id,
      details: { reversalId: String(result.reversal?._id || ""), reversalTransactionId: String(result.reversal?.reversalTransactionId || ""), amount: result.reversal?.amount || 0, reason: "ADMIN_CORRECTION", duplicate: Boolean(result.duplicate) },
    });
    return NextResponse.json({ success: true, duplicate: Boolean(result.duplicate), reversal: result.reversal });
  } catch (error) {
    console.error("POST admin reward reversal error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reverse this reward." }, { status: 500 });
  }
}
