import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { reserveRefundAmount, releaseRefundReservation } from "../lib/payments/refunds";
import Order from "../models/Order";

async function makePaidOrder(paymentAmount: number) {
  return Order.create({
    orderId: `DMR-REFUND-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userName: "Regression Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 1000, total: 1000,
    paymentMethod: "card",
    paymentStatus: "paid",
    razorpayOrderId: "order_test_x",
    razorpayPaymentId: "pay_test_x",
    paymentAmount,
  });
}

test("reservation succeeds up to the remaining refundable balance, then rejects the next request", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  try {
    const first = await reserveRefundAmount(order._id, 700);
    assert.equal(first, true);

    // Only ₹300 remains — a ₹500 request must be rejected outright, never
    // silently capped or partially reserved.
    const second = await reserveRefundAmount(order._id, 500);
    assert.equal(second, false);

    const reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.pendingRefundAmount, 700, "the rejected reservation must not have touched the counter");
    assert.equal(reloaded?.paymentStatus, "refund_pending");
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("two concurrent reservations for the last remaining balance: exactly one succeeds", async () => {
  await connectDB();
  // ₹1000 captured, ₹500 already refunded earlier — exactly ₹500 remains.
  const order = await makePaidOrder(1000);
  await Order.updateOne({ _id: order._id }, { $set: { refundedAmount: 500, paymentStatus: "partially_refunded" } });
  try {
    // Simulates "Admin A clicks Refund ₹500, Admin B clicks Refund ₹500,
    // remaining refundable = ₹500" — only one may win.
    const [a, b] = await Promise.all([
      reserveRefundAmount(order._id, 500),
      reserveRefundAmount(order._id, 500),
    ]);
    const winners = [a, b].filter(Boolean);
    assert.equal(winners.length, 1, "exactly one concurrent reservation should win");

    const reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.pendingRefundAmount, 500, "only one ₹500 reservation should have been counted");
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("releasing a reservation restores the correct paymentStatus and allows re-reserving", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  try {
    await reserveRefundAmount(order._id, 1000);
    let reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.paymentStatus, "refund_pending");

    await releaseRefundReservation(order._id, 1000);
    reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.pendingRefundAmount, 0);
    assert.equal(reloaded?.paymentStatus, "paid", "releasing the only reservation must revert to paid, not stay refund_pending");

    // Now that it's released, a fresh reservation for the same amount must work again.
    const reReserved = await reserveRefundAmount(order._id, 1000);
    assert.equal(reReserved, true);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("reservation is rejected for an order that isn't paid", async () => {
  await connectDB();
  const order = await makePaidOrder(1000);
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "pending" } });
  try {
    const reserved = await reserveRefundAmount(order._id, 100);
    assert.equal(reserved, false);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});
