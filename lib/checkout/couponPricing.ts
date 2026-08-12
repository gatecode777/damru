import Coupon from "@/models/Coupon";
import { roundMoney } from "@/lib/checkout/money";

export interface CouponPricingResult {
  code: string;
  discount: number;
  reserved: boolean;
}

export async function priceCoupon(input: {
  code?: string;
  subtotal: number;
  userId?: string;
  reserve?: boolean;
}): Promise<CouponPricingResult> {
  const requestedCode = input.code?.trim().toUpperCase();
  if (!requestedCode) return { code: "", discount: 0, reserved: false };
  const now = new Date();
  const coupon = await Coupon.findOne({ code: requestedCode });
  if (!coupon) throw new Error("Invalid coupon code.");
  if (coupon.userId && String(coupon.userId) !== input.userId) throw new Error("This coupon is not valid for your account.");
  if (!coupon.isActive) throw new Error("This coupon is not active.");
  if (coupon.startDate && now < coupon.startDate) throw new Error("This coupon is not yet active.");
  if (coupon.expiryDate && now > coupon.expiryDate) throw new Error("This coupon has expired.");
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new Error("This coupon has reached its usage limit.");
  if (input.subtotal < coupon.minOrderValue) throw new Error(`Minimum order of ₹${coupon.minOrderValue} required for this coupon.`);

  const raw = coupon.type === "flat"
    ? Math.min(coupon.value, input.subtotal)
    : Math.min(input.subtotal * coupon.value / 100, coupon.maxDiscount ?? Number.POSITIVE_INFINITY);
  const discount = roundMoney(raw);
  if (!input.reserve) return { code: coupon.code, discount, reserved: false };

  const reserved = await Coupon.findOneAndUpdate({
    _id: coupon._id,
    isActive: true,
    $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
  }, { $inc: { usedCount: 1 } });
  if (!reserved) throw new Error("This coupon has reached its usage limit.");
  return { code: coupon.code, discount, reserved: true };
}
