import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { getRazorpayClient, getRazorpayPublicKeyId, isRazorpayConfigured, toRazorpayAmount } from "@/lib/payments/razorpay";
import { computePayableAmount } from "@/lib/payments/finalizePayment";
import Order from "@/models/Order";

/**
 * POST /api/payments/razorpay/order — body: { orderId }
 *
 * Never accepts a client-supplied amount. The internal order (already created
 * via the existing POST /api/orders, unchanged) is the sole source of the
 * amount — this endpoint only ever charges what the backend computed.
 */
export async function POST(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Online payment is not available right now." }, { status: 503 });
  }

  const rl = await checkRateLimit(`razorpay-order:${sessionUser.id}`, RATE_LIMITS.razorpayOrder);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const { orderId } = await req.json();
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return NextResponse.json({ error: "A valid orderId is required." }, { status: 400 });
    }

    await connectDB();
    const order = await Order.findOne({ _id: orderId, userId: sessionUser.id });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.paymentMethod === "cod") {
      return NextResponse.json({ error: "This order is Cash on Delivery and doesn't need online payment." }, { status: 400 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
    }

    const payable = await computePayableAmount(order);

    // Zero-payable order (coupon/Damru covered it entirely) — finalize directly,
    // never open a Razorpay checkout for ₹0. paymentAmount is set to 0 (not
    // left unset) so refund math has a concrete captured amount to compare
    // against — nothing was ever charged via the gateway, so nothing is
    // ever refundable here, by construction rather than a null-handling special case.
    if (payable <= 0) {
      const now = new Date();
      await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: { $ne: "paid" } },
        { $set: { paymentStatus: "paid", paidAt: now, paymentVerifiedAt: now, paymentAmount: 0 } }
      );
      return NextResponse.json({ success: true, zeroPayable: true });
    }

    // Reuse an existing, still-valid Razorpay order for a retried click/refresh
    // instead of minting a new one every time (PRD: prevent duplicate orders).
    if (order.razorpayOrderId && order.paymentAmount === payable) {
      return NextResponse.json({
        success: true,
        razorpayOrderId: order.razorpayOrderId,
        amount: toRazorpayAmount(payable),
        currency: "INR",
        keyId: getRazorpayPublicKeyId(),
      });
    }

    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: toRazorpayAmount(payable),
      currency: "INR",
      receipt: order.orderId,
      notes: { internalOrderId: String(order._id) },
    });

    await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: "paid" } },
      { $set: { razorpayOrderId: razorpayOrder.id, paymentAmount: payable } }
    );

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: toRazorpayAmount(payable),
      currency: "INR",
      keyId: getRazorpayPublicKeyId(),
    });
  } catch (err) {
    console.error("POST payments/razorpay/order error:", err);
    return NextResponse.json({ error: "Unable to start payment. Please try again." }, { status: 500 });
  }
}
