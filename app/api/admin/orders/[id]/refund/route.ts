import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import AdminUser from "@/models/Admin";
import Order from "@/models/Order";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { requestRefund } from "@/lib/payments/refunds";
import { logAdminAction } from "@/lib/auditLog";

/**
 * POST /api/admin/orders/[id]/refund — body: { amount, reason, note?, refundRequestId }
 *
 * Gated by the "orders" module's "delete" permission — the same tier already
 * used for order cancellation (both are high-impact, hard-to-undo actions on
 * an order; no new permission module was warranted for one more action at
 * the same risk level). Amount is never trusted beyond validation — the
 * actual maximum refundable is recomputed server-side in requestRefund().
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("orders", "delete");
  if (deny) return deny;

  try {
    const { amount, reason, note, refundRequestId } = await req.json();
    if (!amount || typeof amount !== "number") return NextResponse.json({ error: "Enter a valid refund amount." }, { status: 400 });
    if (!reason?.trim()) return NextResponse.json({ error: "A refund reason is required." }, { status: 400 });
    if (!refundRequestId || typeof refundRequestId !== "string") return NextResponse.json({ error: "Missing request id." }, { status: 400 });

    await connectDB();
    const session = await auth();
    const sessionEmail = session?.user?.email?.trim().toLowerCase();
    const sessionId = (session?.user as { id?: string } | undefined)?.id?.trim();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized", code: "SESSION_EXPIRED" }, { status: 401 });
    }
    const identityFilters: Array<{ _id: string } | { email: string }> = [];
    if (sessionId) identityFilters.push({ _id: sessionId });
    if (sessionEmail) identityFilters.push({ email: sessionEmail });
    const admin = identityFilters.length
      ? await AdminUser.findOne(identityFilters.length === 1 ? identityFilters[0] : { $or: identityFilters }).select("_id isActive").lean<{ _id: string; isActive?: boolean }>()
      : null;
    if (!admin || admin.isActive === false) {
      return NextResponse.json({ error: "Admin account is unavailable.", code: "ADMIN_ACCOUNT_UNAVAILABLE" }, { status: 403 });
    }

    const rl = await checkRateLimit(`admin-refund:${admin._id}`, RATE_LIMITS.adminRefund);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const result = await requestRefund({
      orderId: id,
      amount: Math.round(amount),
      reason,
      note,
      adminId: admin._id,
      refundRequestId,
    });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction("order_refund_requested", {
      targetType: "Order",
      targetId: id,
      details: { amount: Math.round(amount), reason, refundId: String(result.refund._id), status: result.refund.status, duplicate: Boolean(result.duplicate) },
    });

    const payment = await Order.findById(id)
      .select("paymentStatus paymentAmount refundedAmount pendingRefundAmount")
      .lean();

    return NextResponse.json({ success: true, refund: result.refund, payment });
  } catch (err) {
    console.error("POST admin/orders/[id]/refund error:", err);
    return NextResponse.json({ error: "Unable to process the refund right now." }, { status: 500 });
  }
}
