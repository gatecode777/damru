import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { getOrderStatusPaymentError, isOrderPaymentEligible } from "../lib/orders/orderPaymentPolicy";
import { checkAndAwardOrderReward } from "../lib/rewardEngine";
import DamruTransaction from "../models/DamruTransaction";
import Order from "../models/Order";
import User from "../models/User";

test("online fulfilment is blocked until server-confirmed payment while COD remains eligible", () => {
  assert.equal(isOrderPaymentEligible({ paymentMethod: "razorpay", paymentStatus: "pending" }), false);
  assert.match(getOrderStatusPaymentError({ paymentMethod: "razorpay", paymentStatus: "pending" }, "delivered") || "", /Razorpay/);
  assert.equal(getOrderStatusPaymentError({ paymentMethod: "razorpay", paymentStatus: "pending" }, "cancelled"), null);
  assert.equal(isOrderPaymentEligible({ paymentMethod: "razorpay", paymentStatus: "paid" }), true);
  assert.equal(isOrderPaymentEligible({ paymentMethod: "cod", paymentStatus: "pending" }), true);
});

test("a delivered but unpaid online order cannot issue a base order reward", async () => {
  await connectDB();
  const user = await User.create({
    name: "Payment eligibility test",
    email: `payment-eligibility-${Date.now()}-${Math.random()}@example.test`,
    password: "test",
  });
  const order = await Order.create({
    orderId: `DMR-ELIG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: user._id,
    userName: user.name,
    items: [{ name: "Test dish", variantType: "none", custom: "", price: 500, qty: 1 }],
    subtotal: 500,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 500,
    eligibleRewardAmount: 500,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    status: "delivered",
  });

  try {
    const unpaid = await checkAndAwardOrderReward(user._id, order._id);
    assert.equal("skipped" in unpaid && unpaid.skipped, true);
    assert.equal(await DamruTransaction.countDocuments({ orderId: order._id, category: "order_reward" }), 0);

    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "paid" } });
    const paid = await checkAndAwardOrderReward(user._id, order._id);
    assert.equal("duplicate" in paid && paid.duplicate, false);
    assert.equal(await DamruTransaction.countDocuments({ orderId: order._id, category: "order_reward" }), 1);
  } finally {
    await Promise.all([
      DamruTransaction.deleteMany({ userId: user._id }),
      Order.deleteOne({ _id: order._id }),
      User.deleteOne({ _id: user._id }),
    ]);
  }
});
