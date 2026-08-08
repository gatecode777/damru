import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { processExpiredDamru } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";

async function makeUserWithLot(opts: { amount: number; remainingAmount: number; expiresAt: Date | null }) {
  const user = await User.create({
    name: "Expiry Test User",
    email: `expiry-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance: opts.remainingAmount,
  });
  const lot = await DamruTransaction.create({
    userId: user._id,
    type: "credit",
    category: "birthday",
    amount: opts.amount,
    balanceAfter: opts.remainingAmount,
    description: "Test lot",
    idempotencyKey: `expiry-test-lot-${user._id}`,
    originalAmount: opts.amount,
    remainingAmount: opts.remainingAmount,
    expiresAt: opts.expiresAt,
  });
  return { user, lot };
}

async function cleanup(userId: mongoose.Types.ObjectId) {
  await DamruTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// Every processExpiredDamru() call below is scoped to `user._id` — the real
// cron sweeps globally, but scoping here keeps this test's assertions exact
// (processedLots===N, not just >=N) even though tests/damruExpiry* files run
// concurrently with other test files against the same shared database.

test("an unused (never-touched) credit fully expires and the wallet is decremented", async () => {
  await connectDB();
  const { user, lot } = await makeUserWithLot({ amount: 500, remainingAmount: 500, expiresAt: daysAgo(1) });
  try {
    const result = await processExpiredDamru(5000, user._id);
    assert.equal(result.processedLots, 1);
    assert.equal(result.totalExpired, 500);

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.equal(reloadedLot?.remainingAmount, 0);
    assert.equal(reloadedLot?.expiredAmount, 500);
    assert.ok(reloadedLot?.expiryProcessedAt);

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 0);

    const expiryTx = await DamruTransaction.findOne({ userId: user._id, category: "expiry" }).lean();
    assert.ok(expiryTx, "an expiry debit ledger transaction must be created");
    assert.equal(expiryTx?.amount, 500);
    assert.equal(expiryTx?.type, "debit");
  } finally {
    await cleanup(user._id);
  }
});

test("a partially-consumed credit expires only its remaining amount", async () => {
  await connectDB();
  // Originally 500, 300 already redeemed elsewhere — only 200 remains and is due.
  const { user, lot } = await makeUserWithLot({ amount: 500, remainingAmount: 200, expiresAt: daysAgo(1) });
  try {
    const result = await processExpiredDamru(5000, user._id);
    assert.equal(result.totalExpired, 200);

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.equal(reloadedLot?.remainingAmount, 0);
    assert.equal(reloadedLot?.expiredAmount, 200, "only the still-remaining 200 should be recorded as expired, not the original 500");

    const expiryTx = await DamruTransaction.findOne({ userId: user._id, category: "expiry" }).lean();
    assert.equal(expiryTx?.amount, 200);
  } finally {
    await cleanup(user._id);
  }
});

test("a fully-consumed (remainingAmount 0) credit does not generate an expiry transaction", async () => {
  await connectDB();
  const { user, lot } = await makeUserWithLot({ amount: 500, remainingAmount: 0, expiresAt: daysAgo(1) });
  try {
    const result = await processExpiredDamru(5000, user._id);
    assert.equal(result.processedLots, 0, "a lot with nothing left should not even be claimed");

    const expiryTx = await DamruTransaction.findOne({ userId: user._id, category: "expiry" }).lean();
    assert.equal(expiryTx, null, "already-spent Damru must never expire");

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.equal(reloadedLot?.expiryProcessedAt ?? null, null);
  } finally {
    await cleanup(user._id);
  }
});

test("a non-expiring credit (expiresAt: null) is never touched by expiry processing", async () => {
  await connectDB();
  const { user, lot } = await makeUserWithLot({ amount: 500, remainingAmount: 500, expiresAt: null });
  try {
    const result = await processExpiredDamru(5000, user._id);
    assert.equal(result.processedLots, 0);

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.equal(reloadedLot?.remainingAmount, 500);
    const expiryTx = await DamruTransaction.findOne({ userId: user._id, category: "expiry" }).lean();
    assert.equal(expiryTx, null);
  } finally {
    await cleanup(user._id);
  }
});

test("a credit whose expiry is still in the future does not expire yet", async () => {
  await connectDB();
  const { user, lot } = await makeUserWithLot({ amount: 500, remainingAmount: 500, expiresAt: daysFromNow(5) });
  try {
    const result = await processExpiredDamru(5000, user._id);
    assert.equal(result.processedLots, 0);

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.equal(reloadedLot?.remainingAmount, 500);
  } finally {
    await cleanup(user._id);
  }
});

test("running expiry processing twice on the same due lot only expires it once", async () => {
  await connectDB();
  const { user } = await makeUserWithLot({ amount: 500, remainingAmount: 500, expiresAt: daysAgo(1) });
  try {
    const first = await processExpiredDamru(5000, user._id);
    const second = await processExpiredDamru(5000, user._id);

    assert.equal(first.processedLots, 1);
    assert.equal(second.processedLots, 0, "a second run must find nothing left to process for this lot");
    assert.equal(second.totalExpired, 0);

    const expiryTxCount = await DamruTransaction.countDocuments({ userId: user._id, category: "expiry" });
    assert.equal(expiryTxCount, 1, "exactly one expiry transaction must exist, never a duplicate");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 0, "the wallet must not be decremented twice");
  } finally {
    await cleanup(user._id);
  }
});
