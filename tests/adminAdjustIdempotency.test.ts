import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { adjustDamru } from "../lib/rewardEngine";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";

/**
 * Regression coverage for the Phase 4 admin-adjustment idempotency fix.
 * One retried click (same requestId) must not double-apply; a genuinely new
 * admin action (a different requestId) must still be allowed to repeat.
 */
test("retrying the same requestId does not double-apply; a new requestId still works", async () => {
  await connectDB();

  const adminId = new mongoose.Types.ObjectId();
  const user = await User.create({
    name: "Regression Test User",
    email: `idempotency-test-${Date.now()}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 0,
  });

  try {
    const credit1 = await adjustDamru({
      userId: user._id, amount: 100, direction: "credit",
      reason: "regression test credit", adminId, requestId: "req-1",
    });
    assert.equal(credit1.success, true);
    assert.equal(credit1.success && credit1.newBalance, 100);

    // Same requestId retried (e.g. a double-click or network retry) — must be rejected,
    // and the balance must be unchanged, not credited a second time.
    const retry = await adjustDamru({
      userId: user._id, amount: 100, direction: "credit",
      reason: "regression test credit", adminId, requestId: "req-1",
    });
    assert.equal(retry.success, false);
    assert.equal(!retry.success && retry.duplicate, true);

    const afterRetry = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(afterRetry?.damruBalance, 100, "balance must not double-credit on retry");

    // A genuinely new admin action (different requestId) must still be allowed —
    // intentional repeated adjustments are a required, not accidental, use case.
    const credit2 = await adjustDamru({
      userId: user._id, amount: 50, direction: "credit",
      reason: "regression test second credit", adminId, requestId: "req-2",
    });
    assert.equal(credit2.success, true);
    assert.equal(credit2.success && credit2.newBalance, 150);

    // Debit path: same retry protection, with its rollback-on-duplicate branch exercised.
    const debit1 = await adjustDamru({
      userId: user._id, amount: 40, direction: "debit",
      reason: "regression test debit", adminId, requestId: "req-3",
    });
    assert.equal(debit1.success, true);
    assert.equal(debit1.success && debit1.newBalance, 110);

    const debitRetry = await adjustDamru({
      userId: user._id, amount: 40, direction: "debit",
      reason: "regression test debit", adminId, requestId: "req-3",
    });
    assert.equal(debitRetry.success, false);
    assert.equal(!debitRetry.success && debitRetry.duplicate, true);

    const afterDebitRetry = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(afterDebitRetry?.damruBalance, 110, "balance must not double-debit on retry");
  } finally {
    await DamruTransaction.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  }
});
