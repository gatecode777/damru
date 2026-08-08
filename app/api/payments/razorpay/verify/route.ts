import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { finalizeRazorpayPayment } from "@/lib/payments/finalizePayment";
import Order from "@/models/Order";

/**
 * POST /api/payments/razorpay/verify — the client-side half of payment
 * confirmation (the webhook, app/api/webhooks/razorpay, is the reliable
 * async half; both call the identical finalizeRazorpayPayment()).
 *
 * Body: { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *
 * CRITICAL: signature verification uses the Razorpay order id already stored
 * on the server-side order document — the `razorpay_order_id` in the request
 * body is only used to sanity-check it against that stored value, never as
 * the value fed into the signature check itself.
 */
export async function POST(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`razorpay-verify:${sessionUser.id}`, RATE_LIMITS.razorpayVerify);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json();

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return NextResponse.json({ error: "A valid orderId is required." }, { status: 400 });
    }
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    await connectDB();
    const order = await Order.findOne({ _id: orderId, userId: sessionUser.id }).select("razorpayOrderId paymentStatus");
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (!order.razorpayOrderId) {
      return NextResponse.json({ error: "No payment was started for this order." }, { status: 400 });
    }
    // The client's razorpay_order_id must match what we generated the order
    // for — it is never trusted as the signature input itself (see above).
    if (order.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const valid = verifyPaymentSignature(order.razorpayOrderId, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const result = await finalizeRazorpayPayment({
      orderId: String(order._id),
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: razorpay_payment_id,
    });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, alreadyFinalized: result.alreadyFinalized });
  } catch (err) {
    console.error("POST payments/razorpay/verify error:", err);
    return NextResponse.json({ error: "Unable to verify payment. Please contact support if you were charged." }, { status: 500 });
  }
}
