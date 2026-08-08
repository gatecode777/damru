import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { computePayableAmount, finalizeRazorpayPayment, markRazorpayPaymentFailed } from "../lib/payments/finalizePayment";
import Order from "../models/Order";
import DamruTransaction from "../models/DamruTransaction";
import DamruConfig from "../models/DamruConfig";

async function makeOrder(overrides: Partial<{ total: number; paymentMethod: string; razorpayOrderId: string }> = {}) {
  return Order.create({
    orderId: `DMR-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userName: "Regression Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 1200,
    discount: 100,
    tax: 50,
    shipping: 0,
    total: overrides.total ?? 950,
    paymentMethod: overrides.paymentMethod ?? "card",
    paymentStatus: "pending",
    razorpayOrderId: overrides.razorpayOrderId,
  });
}

test("computePayableAmount returns order.total when no Damru was redeemed", async () => {
  await connectDB();
  const order = await makeOrder({ total: 950 });
  try {
    const payable = await computePayableAmount(order);
    assert.equal(payable, 950);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("computePayableAmount nets out a Damru redemption recorded for the order", async () => {
  await connectDB();
  const order = await makeOrder({ total: 950 });
  // Match the default redemptionRate (0.1) used when no DamruConfig doc exists.
  const config = await DamruConfig.findOne();
  const redemptionRate = config?.redemptionRate ?? 0.1;
  const damruAmount = 200; // -> 200 * 0.1 = ₹20 discount by default config

  const txn = await DamruTransaction.create({
    userId: new mongoose.Types.ObjectId(),
    type: "debit",
    category: "redemption",
    amount: damruAmount,
    balanceAfter: 0,
    description: "test redemption",
    idempotencyKey: `redeem_order_${order._id}`,
    orderId: order._id,
  });

  try {
    const payable = await computePayableAmount(order);
    assert.equal(payable, 950 - Math.round(damruAmount * redemptionRate));
  } finally {
    await Order.deleteOne({ _id: order._id });
    await DamruTransaction.deleteOne({ _id: txn._id });
  }
});

test("finalizeRazorpayPayment marks an order paid exactly once, idempotent on retry", async () => {
  await connectDB();
  const order = await makeOrder({ total: 950, razorpayOrderId: "order_test_abc" });
  try {
    const first = await finalizeRazorpayPayment({
      orderId: String(order._id),
      razorpayOrderId: "order_test_abc",
      razorpayPaymentId: "pay_test_1",
    });
    assert.equal(first.success, true);
    assert.equal(first.success && first.alreadyFinalized, false);

    const reloaded1 = await Order.findById(order._id).lean();
    assert.equal(reloaded1?.paymentStatus, "paid");
    assert.equal(reloaded1?.razorpayPaymentId, "pay_test_1");
    assert.ok(reloaded1?.paidAt);

    // Simulates the webhook and the client verify call landing for the same
    // payment — must not re-run any effect or overwrite paidAt/paymentId.
    const second = await finalizeRazorpayPayment({
      orderId: String(order._id),
      razorpayOrderId: "order_test_abc",
      razorpayPaymentId: "pay_test_1",
    });
    assert.equal(second.success, true);
    assert.equal(second.success && second.alreadyFinalized, true);

    const reloaded2 = await Order.findById(order._id).lean();
    assert.equal(reloaded2?.paymentStatus, "paid");
    assert.equal(reloaded2?.paidAt?.getTime(), reloaded1?.paidAt?.getTime());
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("finalizeRazorpayPayment rejects a razorpayOrderId that doesn't match the stored one", async () => {
  await connectDB();
  const order = await makeOrder({ total: 950, razorpayOrderId: "order_real" });
  try {
    const result = await finalizeRazorpayPayment({
      orderId: String(order._id),
      razorpayOrderId: "order_spoofed",
      razorpayPaymentId: "pay_x",
    });
    assert.equal(result.success, false);

    const reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.paymentStatus, "pending");
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("markRazorpayPaymentFailed never overwrites an already-paid order", async () => {
  await connectDB();
  const order = await makeOrder({ total: 950, razorpayOrderId: "order_paid_already" });
  try {
    await finalizeRazorpayPayment({
      orderId: String(order._id),
      razorpayOrderId: "order_paid_already",
      razorpayPaymentId: "pay_ok",
    });

    // A late/duplicate payment.failed webhook for a payment that ultimately
    // succeeded must not flip a paid order back to failed.
    await markRazorpayPaymentFailed({ orderId: String(order._id), razorpayOrderId: "order_paid_already" });

    const reloaded = await Order.findById(order._id).lean();
    assert.equal(reloaded?.paymentStatus, "paid");
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});
