import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Coupon from "@/models/Coupon";

// ── GET /api/coupons — list all currently valid coupons ──────
// Used to show available coupons to the user
export async function GET() {
  try {
    await connectDB();
    const now = new Date();
    const coupons = await Coupon.find({
      isActive:   true,
      startDate:  { $lte: now },
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } },
      ],
    })
      .select("code description type value maxDiscount minOrderValue usageLimit usedCount")
      .sort({ createdAt: -1 })
      .lean();

    // Filter out exhausted coupons
    const valid = coupons.filter(
      c => c.usageLimit === null || c.usedCount < c.usageLimit
    );

    return NextResponse.json({ coupons: JSON.parse(JSON.stringify(valid)) });
  } catch (err) {
    console.error("GET coupons error:", err);
    return NextResponse.json({ coupons: [] }, { status: 500 });
  }
}

// ── POST /api/coupons — validate a coupon code against cart total ──
// Body: { code, cartTotal }
// Returns: { valid, discount, message, coupon? }
export async function POST(req: NextRequest) {
  try {
    const { code, cartTotal } = await req.json();
    if (!code) return NextResponse.json({ valid: false, message: "Enter a coupon code." });

    await connectDB();
    const now    = new Date();
    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

    if (!coupon) return NextResponse.json({ valid: false, message: "Invalid coupon code." });
    if (!coupon.isActive) return NextResponse.json({ valid: false, message: "This coupon is not active." });
    if (coupon.startDate && now < coupon.startDate) return NextResponse.json({ valid: false, message: "This coupon is not yet active." });
    if (coupon.expiryDate && now > coupon.expiryDate) return NextResponse.json({ valid: false, message: "This coupon has expired." });
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return NextResponse.json({ valid: false, message: "This coupon has reached its usage limit." });
    if (coupon.minOrderValue > 0 && cartTotal < coupon.minOrderValue) {
      return NextResponse.json({ valid: false, message: `Minimum order of ₹${coupon.minOrderValue} required for this coupon.` });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === "flat") {
      discount = Math.min(coupon.value, cartTotal);
    } else {
      discount = (cartTotal * coupon.value) / 100;
      if (coupon.maxDiscount !== null) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    }
    discount = Math.round(discount);

    return NextResponse.json({
      valid: true,
      discount,
      message: `Coupon applied! You save ₹${discount}.`,
      coupon: {
        code:          coupon.code,
        description:   coupon.description,
        type:          coupon.type,
        value:         coupon.value,
        maxDiscount:   coupon.maxDiscount,
        minOrderValue: coupon.minOrderValue,
      },
    });
  } catch (err) {
    console.error("POST coupons error:", err);
    return NextResponse.json({ valid: false, message: "Something went wrong." }, { status: 500 });
  }
}