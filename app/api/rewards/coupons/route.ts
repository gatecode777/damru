import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getUserFromCookie } from "@/lib/userSession";
import Coupon from "@/models/Coupon";

export async function GET(req: NextRequest) {
  const sessionUser = getUserFromCookie(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      $and: [{ $or: [{ userId: null }, { userId: sessionUser.id }] }],
    })
      .select("code description type value maxDiscount minOrderValue usageLimit usedCount expiryDate userId")
      .sort({ createdAt: -1 })
      .lean();

    const valid = coupons.filter(c => c.usageLimit === null || c.usedCount < c.usageLimit);

    return NextResponse.json({ coupons: JSON.parse(JSON.stringify(valid)) });
  } catch (err) {
    console.error("GET rewards/coupons error:", err);
    return NextResponse.json({ coupons: [] }, { status: 500 });
  }
}
