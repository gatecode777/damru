import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { reconcileOrderPayment, findStalePendingPayments } from "../lib/payments/reconciliation";
import Order from "../models/Order";

async function makeOrder(overrides: Partial<{ paymentMethod: string; paymentStatus: string; razorpayOrderId?: string; createdAt: Date }> = {}) {
  const order = await Order.create({
    orderId: `DMR-RECON-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userName: "Regression Test User",
    items: [{ name: "Test Item", variantType: "none", custom: "", price: 100, qty: 1 }],
    subtotal: 500, total: 500,
    paymentMethod: overrides.paymentMethod ?? "card",
    paymentStatus: overrides.paymentStatus ?? "pending",
    razorpayOrderId: overrides.razorpayOrderId,
  });
  if (overrides.createdAt) {
    // Mongoose's `timestamps: true` protects createdAt from being changed via
    // Model.updateOne() — bypass via the raw driver to backdate it for this test.
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: overrides.createdAt } });
  }
  return order;
}

test("reconcileOrderPayment no-ops for COD orders — no Razorpay call is possible or needed", async () => {
  await connectDB();
  const order = await makeOrder({ paymentMethod: "cod" });
  try {
    const result = await reconcileOrderPayment(String(order._id));
    assert.equal(result.reconciled, false);
    assert.match(result.outcome, /Cash on Delivery/);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("reconcileOrderPayment no-ops for an order with no Razorpay order ever created", async () => {
  await connectDB();
  const order = await makeOrder({ paymentMethod: "card", paymentStatus: "pending" });
  try {
    const result = await reconcileOrderPayment(String(order._id));
    assert.equal(result.reconciled, false);
    assert.match(result.outcome, /No Razorpay order/);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("reconcileOrderPayment no-ops for an order that's already resolved", async () => {
  await connectDB();
  const order = await makeOrder({ paymentMethod: "card", paymentStatus: "paid", razorpayOrderId: "order_already_paid" });
  try {
    const result = await reconcileOrderPayment(String(order._id));
    assert.equal(result.reconciled, false);
    assert.match(result.outcome, /Already "paid"/);
  } finally {
    await Order.deleteOne({ _id: order._id });
  }
});

test("findStalePendingPayments only returns pending, non-COD, Razorpay-linked orders older than the threshold", async () => {
  await connectDB();
  const old = new Date(Date.now() - 30 * 60_000); // 30 minutes ago — past the 15-minute threshold
  const recent = new Date(Date.now() - 2 * 60_000); // 2 minutes ago — still fresh

  const staleEligible = await makeOrder({ paymentMethod: "card", paymentStatus: "pending", razorpayOrderId: "order_stale", createdAt: old });
  const tooRecent = await makeOrder({ paymentMethod: "card", paymentStatus: "pending", razorpayOrderId: "order_recent", createdAt: recent });
  const staleButCod = await makeOrder({ paymentMethod: "cod", paymentStatus: "pending", createdAt: old });
  const staleButPaid = await makeOrder({ paymentMethod: "card", paymentStatus: "paid", razorpayOrderId: "order_stale_paid", createdAt: old });

  try {
    const results = await findStalePendingPayments(50);
    const ids = results.map((r) => String(r._id));
    assert.ok(ids.includes(String(staleEligible._id)), "a stale pending Razorpay order must be included");
    assert.ok(!ids.includes(String(tooRecent._id)), "an order younger than the threshold must be excluded");
    assert.ok(!ids.includes(String(staleButCod._id)), "a COD order must be excluded");
    assert.ok(!ids.includes(String(staleButPaid._id)), "an already-paid order must be excluded");
  } finally {
    await Order.deleteMany({ _id: { $in: [staleEligible._id, tooRecent._id, staleButCod._id, staleButPaid._id] } });
  }
});
