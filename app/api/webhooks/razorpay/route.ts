import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { finalizeRazorpayPayment, markRazorpayPaymentFailed } from "@/lib/payments/finalizePayment";
import { finalizeRefund, markRefundFailed } from "@/lib/payments/refunds";
import Order from "@/models/Order";
import PaymentRefund from "@/models/PaymentRefund";

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string; amount?: number };
    };
    refund?: {
      entity?: { id?: string; payment_id?: string; amount?: number; status?: string };
    };
  };
}

/**
 * POST /api/webhooks/razorpay — server-to-server, no customer auth. Security
 * comes entirely from the webhook signature (RAZORPAY_WEBHOOK_SECRET), so this
 * route is deliberately NOT rate-limited by IP — that could drop legitimate
 * Razorpay retries. The raw body (before any JSON parsing) is what the
 * signature is computed over, so it's read via req.text() first.
 *
 * Reliable async reconciliation path: if a customer pays but the browser/app
 * never calls /verify (closed tab, lost connection), this webhook is what
 * still marks the order paid. It calls the identical finalizeRazorpayPayment()
 * the verify route uses, so both paths converge on the same outcome.
 *
 * Idempotency: finalizeRazorpayPayment()'s atomic conditional update already
 * makes repeat/duplicate deliveries of the same event a safe no-op — no
 * separate event-id dedup table is needed.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await connectDB();

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id || !payment?.id) return NextResponse.json({ received: true });

      const order = await Order.findOne({ razorpayOrderId: payment.order_id }).select("_id paymentAmount total");
      if (!order) {
        console.error("Razorpay webhook: no order found for razorpayOrderId", payment.order_id);
        return NextResponse.json({ received: true });
      }

      // Defense in depth: the order amount is already fixed and bound to
      // razorpayOrderId at creation time, but this check is essentially free
      // here (no extra API call needed) so we take it.
      const expectedPaise = Math.round((order.paymentAmount ?? order.total) * 100);
      if (payment.amount !== expectedPaise) {
        console.error("Razorpay webhook: amount mismatch", { orderId: order._id, expectedPaise, got: payment.amount });
        return NextResponse.json({ received: true });
      }

      await finalizeRazorpayPayment({
        orderId: String(order._id),
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
      });
      console.log("Razorpay webhook: payment reconciled for order", order._id);
    } else if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id) {
        const order = await Order.findOne({ razorpayOrderId: payment.order_id }).select("_id");
        if (order) {
          await markRazorpayPaymentFailed({ orderId: String(order._id), razorpayOrderId: payment.order_id });
          console.log("Razorpay webhook: payment failed for order", order._id);
        }
      }
    } else if (event.event === "refund.processed") {
      const refundEntity = event.payload?.refund?.entity;
      if (refundEntity?.id) {
        const refund = await PaymentRefund.findOne({ gatewayRefundId: refundEntity.id }).select("_id");
        if (refund) {
          await finalizeRefund(refund._id);
          console.log("Razorpay webhook: refund reconciled", refund._id);
        } else {
          console.error("Razorpay webhook: no PaymentRefund found for gatewayRefundId", refundEntity.id);
        }
      }
    } else if (event.event === "refund.failed") {
      const refundEntity = event.payload?.refund?.entity;
      if (refundEntity?.id) {
        const refund = await PaymentRefund.findOne({ gatewayRefundId: refundEntity.id }).select("_id");
        if (refund) {
          await markRefundFailed(refund._id);
          console.log("Razorpay webhook: refund failed", refund._id);
        }
      }
    }
    // Other events (e.g. order.paid) are intentionally ignored — payment.captured
    // and refund.processed are the single canonical success transitions, per
    // the integration design.

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("POST webhooks/razorpay error:", err);
    // Still 200 would suppress retries on a real transient failure — surface
    // it so Razorpay retries delivery instead of silently losing the event.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
