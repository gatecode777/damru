import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { checkApiPerm } from "@/lib/checkApiPerm";
import AdminUser from "@/models/Admin";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { reconcileOrderPayment } from "@/lib/payments/reconciliation";
import { logAdminAction } from "@/lib/auditLog";

/**
 * POST /api/admin/orders/[id]/reconcile-payment — "Recheck Payment". Gated by
 * "orders"/"edit" (same tier as updatePaymentStatus) — lower-impact than a
 * refund since this only ever syncs internal state to what Razorpay already
 * reports, via the same finalizeRazorpayPayment()/markRazorpayPaymentFailed()
 * the verify route and webhook use. There is no way for an admin to manually
 * type "Payment = Paid" through this endpoint — only Razorpay's own trusted
 * state can move it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deny = await checkApiPerm("orders", "edit");
  if (deny) return deny;

  try {
    await connectDB();
    const session = await auth();
    const sessionEmail = (session?.user as { email?: string } | undefined)?.email;
    const admin = await AdminUser.findOne({ email: sessionEmail }).select("_id").lean<{ _id: string }>();
    if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 401 });

    const rl = await checkRateLimit(`payment-recheck:${admin._id}`, RATE_LIMITS.paymentRecheck);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const result = await reconcileOrderPayment(id);

    if (result.reconciled) {
      await logAdminAction("order_payment_reconciled", { targetType: "Order", targetId: id, details: { outcome: result.outcome } });
    }

    return NextResponse.json({ success: true, reconciled: result.reconciled, outcome: result.outcome });
  } catch (err) {
    console.error("POST admin/orders/[id]/reconcile-payment error:", err);
    return NextResponse.json({ error: "Unable to check payment status right now." }, { status: 500 });
  }
}
