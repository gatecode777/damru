import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { allocateDebit } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";

interface LotSpec { amount: number; expiresAt: Date | null; createdAt: Date; }

async function makeUserWithLots(lots: LotSpec[]) {
  const balance = lots.reduce((s, l) => s + l.amount, 0);
  const user = await User.create({
    name: "FEFO Test User",
    email: `fefo-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance: balance,
  });

  const lotIds: string[] = [];
  for (const lot of lots) {
    const doc = await DamruTransaction.create({
      userId: user._id,
      type: "credit",
      category: "welcome_registration",
      amount: lot.amount,
      balanceAfter: balance,
      description: "Test lot",
      idempotencyKey: `fefo-test-${user._id}-${lotIds.length}`,
      originalAmount: lot.amount,
      remainingAmount: lot.amount,
      expiresAt: lot.expiresAt,
    });
    // Bypass Mongoose's timestamps:true protection on createdAt (see reconciliation.test.ts).
    await DamruTransaction.collection.updateOne({ _id: doc._id }, { $set: { createdAt: lot.createdAt } });
    lotIds.push(String(doc._id));
  }
  return { user, lotIds };
}

async function cleanup(userId: mongoose.Types.ObjectId) {
  await DamruTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

const day = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

test("FEFO: the earlier-expiring lot is consumed first, even if it was created more recently", async () => {
  await connectDB();
  const { user, lotIds } = await makeUserWithLots([
    { amount: 500, expiresAt: day(20), createdAt: day(-1) }, // B: expires later, created more recently
    { amount: 500, expiresAt: day(10), createdAt: day(-5) }, // A: expires sooner, created earlier — should still win on expiry alone
  ]);
  try {
    const result = await allocateDebit(user._id, 600);
    assert.equal(result.success, true);
    assert.equal(result.untrackedAmount, 0);

    // Lot A (index 1, expires day 10) is fully consumed (500), then 100 more from Lot B (index 0).
    const lotA = await DamruTransaction.findById(lotIds[1]).select("remainingAmount").lean();
    const lotB = await DamruTransaction.findById(lotIds[0]).select("remainingAmount").lean();
    assert.equal(lotA?.remainingAmount, 0, "the earlier-expiring lot must be fully consumed first");
    assert.equal(lotB?.remainingAmount, 400, "only the remainder should come from the later-expiring lot");
  } finally {
    await cleanup(user._id);
  }
});

test("FIFO tie-break: with equal expiry dates, the older lot is consumed first", async () => {
  await connectDB();
  const sameExpiry = day(15);
  const { user, lotIds } = await makeUserWithLots([
    { amount: 300, expiresAt: sameExpiry, createdAt: day(-1) },  // newer
    { amount: 300, expiresAt: sameExpiry, createdAt: day(-10) }, // older — should win the tie
  ]);
  try {
    const result = await allocateDebit(user._id, 300);
    assert.equal(result.success, true);
    assert.equal(result.allocations.length, 1);
    assert.equal(String(result.allocations[0].creditTransactionId), lotIds[1], "the older lot must be picked on an expiry tie");

    const older = await DamruTransaction.findById(lotIds[1]).select("remainingAmount").lean();
    const newer = await DamruTransaction.findById(lotIds[0]).select("remainingAmount").lean();
    assert.equal(older?.remainingAmount, 0);
    assert.equal(newer?.remainingAmount, 300, "the newer lot must be untouched");
  } finally {
    await cleanup(user._id);
  }
});

test("non-expiring lots are consumed only after every expiring lot is exhausted", async () => {
  await connectDB();
  const { user, lotIds } = await makeUserWithLots([
    { amount: 200, expiresAt: null, createdAt: day(-30) },   // non-expiring, oldest — should still be consumed LAST
    { amount: 200, expiresAt: day(5), createdAt: day(-1) },  // expiring, newest by createdAt — should still go FIRST
  ]);
  try {
    const result = await allocateDebit(user._id, 250);
    assert.equal(result.success, true);
    assert.equal(result.untrackedAmount, 0);

    const nonExpiring = await DamruTransaction.findById(lotIds[0]).select("remainingAmount").lean();
    const expiring = await DamruTransaction.findById(lotIds[1]).select("remainingAmount").lean();
    assert.equal(expiring?.remainingAmount, 0, "the expiring lot must be fully consumed before touching the non-expiring one");
    assert.equal(nonExpiring?.remainingAmount, 150, "only the shortfall should come from the non-expiring lot");
  } finally {
    await cleanup(user._id);
  }
});

test("allocateDebit degrades gracefully to untrackedAmount when tracked lots don't cover the full debit", async () => {
  await connectDB();
  // Wallet balance exceeds tracked lot totals — simulates a pre-migration legacy user.
  const user = await User.create({
    name: "Untracked Balance User",
    email: `untracked-test-${Date.now()}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 1000,
  });
  try {
    const result = await allocateDebit(user._id, 400);
    assert.equal(result.success, true, "redemption must still work even with zero tracked lots");
    assert.equal(result.allocations.length, 0);
    assert.equal(result.untrackedAmount, 400);
    assert.equal(result.newBalance, 600);
  } finally {
    await User.deleteOne({ _id: user._id });
  }
});
