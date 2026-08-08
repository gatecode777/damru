import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { releaseCouponUsage } from "../lib/payments/refunds";
import Coupon from "../models/Coupon";

async function makeCoupon(usedCount: number, usageLimit: number | null = 1) {
  return Coupon.create({
    code: `RESTORE-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "Regression test coupon",
    type: "flat", value: 10, minOrderValue: 0,
    usageLimit, usedCount, perUserLimit: 1, isActive: true,
  });
}

test("releasing a reserved usage decrements usedCount by exactly one", async () => {
  await connectDB();
  const coupon = await makeCoupon(1);
  try {
    await releaseCouponUsage(coupon.code);
    const reloaded = await Coupon.findById(coupon._id).lean();
    assert.equal(reloaded?.usedCount, 0);
  } finally {
    await Coupon.deleteOne({ _id: coupon._id });
  }
});

test("usedCount can never go negative — releasing twice is safe", async () => {
  await connectDB();
  const coupon = await makeCoupon(1);
  try {
    await releaseCouponUsage(coupon.code);
    // Simulates a duplicate cancellation/release attempt (cancelOrder's own
    // status:{$ne:"cancelled"} guard already prevents this in practice, but
    // the release primitive itself must be safe regardless).
    await releaseCouponUsage(coupon.code);
    const reloaded = await Coupon.findById(coupon._id).lean();
    assert.equal(reloaded?.usedCount, 0, "usedCount must floor at 0, never go negative");
  } finally {
    await Coupon.deleteOne({ _id: coupon._id });
  }
});

test("releasing a usage makes the coupon usable again once at its limit", async () => {
  await connectDB();
  const coupon = await makeCoupon(1, 1); // fully exhausted (usageLimit 1, usedCount 1)
  try {
    const beforeRelease = await Coupon.findById(coupon._id).lean();
    assert.equal((beforeRelease?.usedCount ?? 0) >= (beforeRelease?.usageLimit ?? 0), true, "sanity check: coupon starts exhausted");

    await releaseCouponUsage(coupon.code);

    const reloaded = await Coupon.findById(coupon._id).lean();
    assert.equal(reloaded?.usedCount, 0);
    assert.equal((reloaded?.usedCount ?? 0) < (reloaded?.usageLimit ?? 0), true, "coupon must be usable again after release");
  } finally {
    await Coupon.deleteOne({ _id: coupon._id });
  }
});
