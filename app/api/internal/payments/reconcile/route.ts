import { NextRequest, NextResponse } from "next/server";
import { findStalePendingPayments, reconcileOrderPayment } from "@/lib/payments/reconciliation";

// Vercel Cron Jobs send a GET request with an `Authorization: Bearer <CRON_SECRET>`
// header automatically when the CRON_SECRET env var is set on the project.
// Same auth pattern as app/api/internal/rewards/run-scheduler — a separate
// route rather than folding this into that one, since payment reconciliation
// needs a much shorter cadence than the once-daily reward scheduler.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stale = await findStalePendingPayments(50);
    const results = [];
    for (const order of stale) {
      const result = await reconcileOrderPayment(String(order._id));
      if (result.reconciled) results.push({ orderId: String(order._id), outcome: result.outcome });
    }
    return NextResponse.json({ success: true, checked: stale.length, reconciled: results.length, results });
  } catch (err) {
    console.error("payments/reconcile scheduler error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
