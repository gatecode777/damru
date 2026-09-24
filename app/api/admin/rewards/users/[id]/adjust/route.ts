import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import { adjustDamru } from "@/lib/rewardEngine";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { logAdminAction, resolveSessionAdmin } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const { amount, direction, reason, requestId, neverExpires } = await req.json();
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: "Enter a positive whole number of Damru." }, { status: 400 });
    if (direction !== "credit" && direction !== "debit") return NextResponse.json({ error: "Invalid direction." }, { status: 400 });
    if (!reason?.trim()) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    if (!requestId || typeof requestId !== "string") return NextResponse.json({ error: "Missing request id." }, { status: 400 });

    await connectDB();
    const admin = await resolveSessionAdmin();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const rl = await checkRateLimit(`admin-adjust:${admin._id}`, RATE_LIMITS.adminAdjust);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const result = await adjustDamru({
      userId: id,
      amount: Number(amount),
      direction,
      reason,
      adminId: admin._id,
      requestId,
      neverExpires: direction === "credit" ? Boolean(neverExpires) : undefined,
    });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction(direction === "credit" ? "damru_manual_credit" : "damru_manual_debit", {
      targetType: "User",
      targetId: id,
      details: {
        amount,
        reason: String(reason).trim(),
        transactionId: String(result.transaction._id),
        newBalance: result.newBalance,
        ...(direction === "credit" ? { neverExpires: Boolean(neverExpires) } : {}),
      },
    });

    return NextResponse.json({ success: true, newBalance: result.newBalance, transaction: result.transaction });
  } catch (err) {
    console.error("POST admin/rewards/users/[id]/adjust error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
