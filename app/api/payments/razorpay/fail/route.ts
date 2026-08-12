import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserFromCookie } from "@/lib/userSession";
import { connectDB } from "@/lib/mongodb";
import { markRazorpayPaymentFailed } from "@/lib/payments/finalizePayment";
import Order from "@/models/Order";

export async function POST(req: NextRequest) {
  const user = getUserFromCookie(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { orderId, razorpayOrderId } = await req.json();
    if (!mongoose.isValidObjectId(orderId) || !razorpayOrderId) {
      return NextResponse.json({ error: "Valid payment details are required." }, { status: 400 });
    }
    await connectDB();
    const order = await Order.findOne({ _id: orderId, userId: user.id }).select("razorpayOrderId paymentStatus");
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.paymentStatus === "paid") return NextResponse.json({ success: true, alreadyPaid: true });
    if (order.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: "Payment attempt mismatch." }, { status: 400 });
    }
    await markRazorpayPaymentFailed({ orderId: String(order._id), razorpayOrderId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST razorpay/fail error:", error);
    return NextResponse.json({ error: "Unable to update payment status." }, { status: 500 });
  }
}
