import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import AdminUser from "@/models/Admin";
import { adjustDamru } from "@/lib/rewardEngine";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("rewards", "edit");
  if (deny) return deny;

  try {
    const { amount, direction, reason, requestId, neverExpires } = await req.json();
    if (!amount || amount <= 0) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
    if (direction !== "credit" && direction !== "debit") return NextResponse.json({ error: "Invalid direction." }, { status: 400 });
    if (!reason?.trim()) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    if (!requestId || typeof requestId !== "string") return NextResponse.json({ error: "Missing request id." }, { status: 400 });

    await connectDB();
    const session = await auth();
    const admin = await AdminUser.findOne({ email: (session?.user as any)?.email }).select("_id").lean() as any;
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

    return NextResponse.json({ success: true, newBalance: result.newBalance, transaction: result.transaction });
  } catch (err) {
    console.error("POST admin/rewards/users/[id]/adjust error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
