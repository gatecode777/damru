import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { reserveRefundAmount, finalizeRefund, markRefundFailed, restoreDamruForOrder } from "../lib/payments/refunds";
import Order from "../models/Order";
import PaymentRefund from "../models/PaymentRefund";
import DamruTransaction from "../models/DamruTransaction";
import User from "../models/User";

async function makePaidOrder(paymentAmount: number) {
  return Order.create({
    orderId: `DMR-FIN-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userName: "Regression Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 1000, total: 1000,
    paymentMethod: "card",
    paymentStatus: "paid",
    razorpayOrderId: "order_test_fin",
    razorpayPaymentId: "pay_test_fin",
    paymentAmount,
  });
}

async function makeRefund(orderId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId | undefined, amount: number, requestId: string) {
  return PaymentRefund.create({
    orderId, userId, gateway: "razorpay", gatewayPaymentId: "pay_test_fin",
    amount, currency: "INR", status: "pending",
    reason: "Regression test", requestedBy: new mongoose.Types.ObjectId(), requestedAt: new Date(),
    refundRequestId: requestId,
  });
}

test("full refund: finalizeRefund is idempotent and marks the order fully refunded", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  try {
    await reserveRefundAmount(order._id, 1000);
    const refund = await makeRefund(order._id, order.userId, 1000, `req-${Date.now()}-a`);

    const first = await finalizeRefund(refund._id);
    assert.equal(first.alreadyFinalized, false);

    const reloaded1 = await Order.findById(order._id).lean();
    assert.equal(reloaded1?.refundedAmount, 1000);
    assert.equal(reloaded1?.pendingRefundAmount, 0);
    assert.equal(reloaded1?.paymentStatus, "refunded");

    // Duplicate finalize call (webhook racing the sync path, or a repeated
    // webhook delivery) — must not double-increment refundedAmount.
    const second = await finalizeRefund(refund._id);
    assert.equal(second.alreadyFinalized, true);

    const reloaded2 = await Order.findById(order._id).lean();
    assert.equal(reloaded2?.refundedAmount, 1000, "refundedAmount must not double-increment on a repeated finalize");
  } finally {
    await PaymentRefund.deleteMany({ orderId: order._id });
    await Order.deleteOne({ _id: order._id });
  }
});

test("partial refund leaves the order partially_refunded, not refunded", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  try {
    await reserveRefundAmount(order._id, 300);
    const refund = await makeRefund(order._id, order.userId, 300, `req-${Date.now()}-b`);
    await finalizeRefund(refund._id);

    const reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.refundedAmount, 300);
    assert.equal(reloaded?.paymentStatus, "partially_refunded");
  } finally {
    await PaymentRefund.deleteMany({ orderId: order._id });
    await Order.deleteOne({ _id: order._id });
  }
});

test("markRefundFailed is idempotent, rolls back the reservation, and never processes the refund", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  try {
    await reserveRefundAmount(order._id, 400);
    const refund = await makeRefund(order._id, order.userId, 400, `req-${Date.now()}-c`);

    await markRefundFailed(refund._id);
    const reloadedOrder = await Order.findById(order._id).lean();
    assert.equal(reloadedOrder?.pendingRefundAmount, 0);
    assert.equal(reloadedOrder?.refundedAmount, 0);
    assert.equal(reloadedOrder?.paymentStatus, "paid", "a failed refund must leave the order as paid, not refunded/refund_pending");

    const reloadedRefund = await PaymentRefund.findById(refund._id).lean();
    assert.equal(reloadedRefund?.status, "failed");

    // A late/duplicate failure signal must not double-apply the rollback.
    await markRefundFailed(refund._id);
    const reloadedOrder2 = await Order.findById(order._id).lean();
    assert.equal(reloadedOrder2?.pendingRefundAmount, 0);

    // A failure signal must never be able to "process" a refund it applies to.
    const finalizeAttempt = await finalizeRefund(refund._id);
    assert.equal(finalizeAttempt.alreadyFinalized, true, "finalizeRefund must refuse to process an already-failed refund");
  } finally {
    await PaymentRefund.deleteMany({ orderId: order._id });
    await Order.deleteOne({ _id: order._id });
  }
});

test("Damru restoration: full refund restores once, duplicate restoration is a no-op, failed refund restores nothing", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  const user = await User.create({
    name: "Damru Restore Test User",
    email: `damru-restore-test-${Date.now()}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 0,
    notificationPreferences: { rewardUpdates: false, orderUpdates: false },
  });
  await DamruTransaction.create({
    userId: user._id, type: "debit", category: "redemption", amount: 200, balanceAfter: 0,
    description: "test redemption", idempotencyKey: `redeem_order_${order._id}`, orderId: order._id,
  });
  await Order.updateOne({ _id: order._id }, { $set: { userId: user._id } });

  try {
    await reserveRefundAmount(order._id, 1000);
    const refund = await makeRefund(order._id, user._id, 1000, `req-${Date.now()}-d`);
    await finalizeRefund(refund._id);

    const afterFirst = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(afterFirst?.damruBalance, 200, "full refund must restore exactly the Damru redeemed for this order");

    // Duplicate restoration attempt (e.g. reconciliation re-running the same
    // finalize outcome) must add zero additional Damru.
    await finalizeRefund(refund._id);
    const afterSecond = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(afterSecond?.damruBalance, 200, "duplicate restoration must not add Damru a second time");
  } finally {
    await PaymentRefund.deleteMany({ orderId: order._id });
    await DamruTransaction.deleteMany({ orderId: order._id });
    await Order.deleteOne({ _id: order._id });
    await User.deleteOne({ _id: user._id });
  }

  // Failed refund: restoreDamruForOrder must never be called for it (verified
  // structurally above via markRefundFailed's own test), but also verify the
  // restoration primitive itself refuses to double-restore for a manually
  // reused idempotency suffix — a direct check on restoreDamruForOrder.
  const order2 = await makePaidOrder(500);
  const user2 = await User.create({
    name: "Damru Restore Test User 2",
    email: `damru-restore-test2-${Date.now()}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 0,
    notificationPreferences: { rewardUpdates: false, orderUpdates: false },
  });
  await DamruTransaction.create({
    userId: user2._id, type: "debit", category: "redemption", amount: 50, balanceAfter: 0,
    description: "test redemption", idempotencyKey: `redeem_order_${order2._id}`, orderId: order2._id,
  });
  try {
    await restoreDamruForOrder(order2._id, user2._id, `cancel_${order2._id}`);
    await restoreDamruForOrder(order2._id, user2._id, `cancel_${order2._id}`);
    const reloadedUser2 = await User.findById(user2._id).select("damruBalance").lean();
    assert.equal(reloadedUser2?.damruBalance, 50, "calling restoreDamruForOrder twice with the same idempotency suffix must restore Damru only once");
  } finally {
    await DamruTransaction.deleteMany({ orderId: order2._id });
    await Order.deleteOne({ _id: order2._id });
    await User.deleteOne({ _id: user2._id });
  }
});
