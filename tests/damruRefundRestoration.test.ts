import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { redeemDamru } from "../lib/rewardEngine";
import { restoreDamruForOrder } from "../lib/payments/refunds";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";
import Order from "../models/Order";

async function makeUser(damruBalance: number) {
  return User.create({
    name: "Refund Restoration Test User",
    email: `refund-restore-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance,
  });
}

async function makeOrder(userId: mongoose.Types.ObjectId) {
  return Order.create({
    orderId: `DMR-RESTORE-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    userName: "Refund Restoration Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 1000, total: 900,
    paymentMethod: "card",
  });
}

async function cleanup(userId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId) {
  await DamruTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
  await Order.deleteOne({ _id: orderId });
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

test("restoring Damru after a redemption puts it back into its ORIGINAL lot, preserving that lot's original expiry date", async () => {
  await connectDB();
  const user = await makeUser(500);
  const order = await makeOrder(user._id);
  const originalExpiry = daysFromNow(45);
  const lot = await DamruTransaction.create({
    userId: user._id, type: "credit", category: "birthday", amount: 500, balanceAfter: 500,
    description: "Test lot", idempotencyKey: `restore-test-lot-${user._id}`,
    originalAmount: 500, remainingAmount: 500, expiresAt: originalExpiry,
  });

  try {
    const redeemResult = await redeemDamru(user._id, 500, order._id);
    assert.equal(redeemResult.success, true);

    const lotAfterRedeem = await DamruTransaction.findById(lot._id).lean();
    assert.equal(lotAfterRedeem?.remainingAmount, 0, "sanity check: the lot must be fully consumed by the redemption");

    await restoreDamruForOrder(order._id, user._id, "test-restore-1");

    const lotAfterRestore = await DamruTransaction.findById(lot._id).lean();
    assert.equal(lotAfterRestore?.remainingAmount, 500, "the Damru must be restored into its ORIGINAL lot");
    assert.equal(
      new Date(lotAfterRestore!.expiresAt as unknown as string).getTime(),
      originalExpiry.getTime(),
      "the restored Damru must keep its original expiry date, not gain a fresh one"
    );

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 500);

    // The refund_restore ledger entry itself must NOT also hold an independent
    // spendable lot — the value already lives back in the original lot, so
    // double-counting it here would break the wallet invariant.
    const restoreTx = await DamruTransaction.findOne({ userId: user._id, category: "refund_restore" }).lean();
    assert.equal(restoreTx?.remainingAmount ?? 0, 0);
  } finally {
    await cleanup(user._id, order._id);
  }
});

test("restoring the same order twice (e.g. a repeated webhook) does not double-restore", async () => {
  await connectDB();
  const user = await makeUser(500);
  const order = await makeOrder(user._id);
  await DamruTransaction.create({
    userId: user._id, type: "credit", category: "birthday", amount: 500, balanceAfter: 500,
    description: "Test lot", idempotencyKey: `restore-test-lot-dup-${user._id}`,
    originalAmount: 500, remainingAmount: 500, expiresAt: null,
  });

  try {
    await redeemDamru(user._id, 500, order._id);

    await restoreDamruForOrder(order._id, user._id, "test-restore-dup");
    await restoreDamruForOrder(order._id, user._id, "test-restore-dup"); // repeated webhook delivery

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 500, "the wallet must only be credited once, not twice");

    const restoreTxCount = await DamruTransaction.countDocuments({ userId: user._id, category: "refund_restore" });
    assert.equal(restoreTxCount, 1);
  } finally {
    await cleanup(user._id, order._id);
  }
});

test("restoring Damru from a legacy redemption with no allocation info falls back to a fresh lot for the full amount", async () => {
  await connectDB();
  const user = await makeUser(0);
  const order = await makeOrder(user._id);
  // Simulates a redemption transaction created before the lot-allocation
  // architecture shipped — no `allocations` field at all.
  await DamruTransaction.create({
    userId: user._id, type: "debit", category: "redemption", amount: 300, balanceAfter: 0,
    description: "Redeemed at checkout", idempotencyKey: `redeem_order_${order._id}`, orderId: order._id,
  });

  try {
    await restoreDamruForOrder(order._id, user._id, "test-restore-fallback");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 300);

    const restoreTx = await DamruTransaction.findOne({ userId: user._id, category: "refund_restore" }).lean();
    assert.ok(restoreTx);
    assert.equal(restoreTx?.amount, 300);
    assert.equal(restoreTx?.remainingAmount, 300, "with no traceable original lot, the full amount becomes its own fresh lot");
  } finally {
    await cleanup(user._id, order._id);
  }
});
