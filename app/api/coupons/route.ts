import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import { getUserFromCookie } from "@/lib/userSession";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";
import Cart from "@/models/Cart";
import { resolveOrderItems } from "@/lib/checkout/resolveOrderItems";
import { priceCoupon } from "@/lib/checkout/couponPricing";

// ── GET /api/coupons — list all currently valid coupons ──────
// Used to show available coupons to the user
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const now = new Date();
    const sessionUser = getUserFromCookie(req);
    const coupons = await Coupon.find({
      isActive:   true,
      startDate:  { $lte: now },
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } },
      ],
      $and: [
        { $or: [{ userId: null }, { userId: sessionUser?.id || null }] },
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
// Body: { code }. The backend loads and prices the authenticated user's cart.
// Returns: { valid, discount, message, coupon? }
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(`coupon-validate:${getClientIp(req)}`, RATE_LIMITS.couponValidate);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { code } = await req.json();
    if (!code) return NextResponse.json({ valid: false, message: "Enter a coupon code." });
    const sessionUser = getUserFromCookie(req);
    if (!sessionUser) return NextResponse.json({ valid: false, message: "Login required to apply a coupon." }, { status: 401 });
    await connectDB();
    const cart = await Cart.findOne({ userId: sessionUser.id }).lean();
    const items = await resolveOrderItems(cart?.items || []);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const priced = await priceCoupon({ code, subtotal, userId: sessionUser.id });

    return NextResponse.json({
      valid: true,
      discount: priced.discount,
      message: `Coupon applied! You save ₹${priced.discount}.`,
      coupon: { code: priced.code },
    });
  } catch (err) {
    console.error("POST coupons error:", err);
    return NextResponse.json({ valid: false, message: err instanceof Error ? err.message : "Something went wrong." }, { status: 400 });
  }
}
