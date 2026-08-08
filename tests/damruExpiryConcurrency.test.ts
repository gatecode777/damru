import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { redeemDamru, adjustDamru } from "../lib/rewardEngine";
import { processExpiredDamru } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";
import Order from "../models/Order";
import mongoose from "mongoose";

async function makeUser(damruBalance: number) {
  return User.create({
    name: "Concurrency Test User",
    email: `concurrency-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance,
  });
}

async function makeOrder(userId: mongoose.Types.ObjectId) {
  return Order.create({
    orderId: `DMR-CONCUR-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    userName: "Concurrency Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 1000, total: 1000,
    paymentMethod: "cod",
  });
}

async function cleanup(userId: mongoose.Types.ObjectId, orderIds: mongoose.Types.ObjectId[] = []) {
  await DamruTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
  if (orderIds.length > 0) await Order.deleteMany({ _id: { $in: orderIds } });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

test("concurrent redemption: only one of two competing redemptions succeeds when funds cover just one", async () => {
  await connectDB();
  const user = await makeUser(700); // enough for exactly one of two 700-Damru redemptions, not both
  const orderA = await makeOrder(user._id);
  const orderB = await makeOrder(user._id);
  try {
    const [a, b] = await Promise.all([
      redeemDamru(user._id, 700, orderA._id),
      redeemDamru(user._id, 700, orderB._id),
    ]);
    const successes = [a, b].filter(r => r.success);
    assert.equal(successes.length, 1, "exactly one concurrent redemption must win");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 0, "the wallet must never go negative or be double-spent");
  } finally {
    await cleanup(user._id, [orderA._id, orderB._id]);
  }
});

test("redemption vs expiry: the same lot can never be both redeemed and expired", async () => {
  await connectDB();
  const user = await makeUser(500);
  const order = await makeOrder(user._id);
  const lot = await DamruTransaction.create({
    userId: user._id,
    type: "credit",
    category: "birthday",
    amount: 500,
    balanceAfter: 500,
    description: "Test lot",
    idempotencyKey: `concurrency-test-lot-${user._id}`,
    originalAmount: 500,
    remainingAmount: 500,
    expiresAt: daysAgo(1), // already due
  });
  try {
    const [redeemResult, expiryResult] = await Promise.all([
      redeemDamru(user._id, 500, order._id),
      processExpiredDamru(5000, user._id),
    ]);

    const bothWon = redeemResult.success && expiryResult.processedLots > 0;
    assert.equal(bothWon, false, "redemption and expiry must never both claim the same Damru");

    const reloadedLot = await DamruTransaction.findById(lot._id).lean();
    assert.ok((reloadedLot?.remainingAmount ?? -1) >= 0, "a lot's remainingAmount must never go negative");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.ok((reloadedUser?.damruBalance ?? -1) >= 0, "the wallet must never go negative");

    // Exactly one side must have actually won (not neither — the Damru was
    // real and due/redeemable, so someone must have claimed it).
    const exactlyOneWon = redeemResult.success !== expiryResult.processedLots > 0;
    assert.equal(exactlyOneWon, true, "exactly one of redemption or expiry must have won this lot");
  } finally {
    await cleanup(user._id, [order._id]);
  }
});

test("admin debit vs redemption: only one of two competing debits succeeds when funds cover just one", async () => {
  await connectDB();
  const user = await makeUser(700);
  const order = await makeOrder(user._id);
  const adminId = new mongoose.Types.ObjectId();
  try {
    const [redeemResult, adjustResult] = await Promise.all([
      redeemDamru(user._id, 700, order._id),
      adjustDamru({ userId: user._id, amount: 700, direction: "debit", reason: "concurrency test debit", adminId, requestId: "concur-req-1" }),
    ]);
    const successes = [redeemResult.success, adjustResult.success].filter(Boolean);
    assert.equal(successes.length, 1, "exactly one of the two concurrent debits must win");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 0);
  } finally {
    await cleanup(user._id, [order._id]);
  }
});

test("two concurrent expiry workers processing the same due lot: exactly one expiry transaction is created", async () => {
  await connectDB();
  const user = await makeUser(500);
  await DamruTransaction.create({
    userId: user._id,
    type: "credit",
    category: "birthday",
    amount: 500,
    balanceAfter: 500,
    description: "Test lot",
    idempotencyKey: `concurrency-test-two-workers-${user._id}`,
    originalAmount: 500,
    remainingAmount: 500,
    expiresAt: daysAgo(1),
  });
  try {
    const [workerA, workerB] = await Promise.all([
      processExpiredDamru(5000, user._id),
      processExpiredDamru(5000, user._id),
    ]);
    assert.equal(workerA.processedLots + workerB.processedLots, 1, "exactly one worker must claim the lot");

    const expiryTxCount = await DamruTransaction.countDocuments({ userId: user._id, category: "expiry" });
    assert.equal(expiryTxCount, 1, "exactly one expiry ledger transaction must exist");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 0, "the wallet must be decremented exactly once, not twice");
  } finally {
    await cleanup(user._id);
  }
});
