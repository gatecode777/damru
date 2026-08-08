import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import Coupon from "../models/Coupon";

/**
 * Regression coverage for the coupon usage-limit concurrency fix in
 * app/api/orders/route.ts (atomic `findOneAndUpdate` reservation). This does
 * NOT re-implement or modify that fix — it exercises the identical query
 * shape against a real, disposable test coupon to prove two simultaneous
 * checkout attempts on a usageLimit=1 coupon cannot both win.
 */
test("usageLimit=1 coupon: only one of two concurrent reservations succeeds", async () => {
  await connectDB();

  const code = `TEST_CONCURRENCY_${Date.now()}`;
  const coupon = await Coupon.create({
    code,
    description: "Regression test coupon — safe to delete",
    type: "flat",
    value: 10,
    maxDiscount: null,
    minOrderValue: 0,
    usageLimit: 1,
    usedCount: 0,
    perUserLimit: 1,
    isActive: true,
  });

  try {
    // Mirrors the exact atomic reservation query from app/api/orders/route.ts —
    // two "simultaneous checkout attempts" racing to reserve the same slot.
    const reserve = () =>
      Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          $or: [
            { usageLimit: null },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } }
      );

    const [first, second] = await Promise.all([reserve(), reserve()]);
    const winners = [first, second].filter((r) => r !== null);

    assert.equal(winners.length, 1, "exactly one concurrent reservation should win");

    const final = await Coupon.findById(coupon._id).lean();
    assert.equal(final?.usedCount, 1, "usedCount must not exceed usageLimit under concurrency");
  } finally {
    await Coupon.deleteOne({ _id: coupon._id });
  }
});
