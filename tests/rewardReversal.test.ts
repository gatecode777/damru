import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { awardDamru } from "../lib/rewardEngine";
import { applyReversal, calculateReversibleAmount, reverseOrderRewards } from "../lib/rewards/reversalEngine";
import { markRefundFailed } from "../lib/payments/refunds";
import DamruTransaction from "../models/DamruTransaction";
import Notification from "../models/Notification";
import Order from "../models/Order";
import PaymentRefund from "../models/PaymentRefund";
import RewardReversal from "../models/RewardReversal";
import User from "../models/User";

async function fixture(balance: number) {
  await connectDB();
  const user = await User.create({ name: "Reward Reversal Test", email: `reward-reversal-${Date.now()}-${Math.random()}@example.test`, password: "test", damruBalance: balance });
  const order = await Order.create({ orderId: `DMR-REV-${Date.now()}-${Math.random()}`, userId: user._id, userName: user.name, items: [{ name: "Test", variantType: "none", custom: "", price: 100, qty: 1 }], subtotal: 1000, total: 1000, eligibleRewardAmount: 1000, paymentMethod: "cod", status: "delivered" });
  return { user, order };
}

async function credit(userId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId, category: "order_reward" | "first_order" | "campaign", amount: number, remainingAmount = amount) {
  return DamruTransaction.create({ userId, type: "credit", category, amount, balanceAfter: amount, description: `${category} test`, idempotencyKey: `reversal-credit:${category}:${orderId}:${Math.random()}`, orderId, originalAmount: amount, remainingAmount, expiresAt: null, ...(category === "campaign" ? { campaignId: new mongoose.Types.ObjectId(), campaignCode: "TEST" } : {}) });
}

async function cleanup(userId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId) {
  const txIds = await DamruTransaction.find({ userId }).distinct("_id");
  await Promise.all([
    RewardReversal.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    DamruTransaction.deleteMany({ _id: { $in: txIds } }),
    Order.deleteOne({ _id: orderId }),
    User.deleteOne({ _id: userId }),
  ]);
}

test("full order reversal preserves original order and campaign credits and creates separate debits", async () => {
  const { user, order } = await fixture(300);
  const orderReward = await credit(user._id, order._id, "order_reward", 100);
  const campaignReward = await credit(user._id, order._id, "campaign", 200);
  try {
    const result = await reverseOrderRewards({ orderId: order._id, reason: "FULL_REFUND", triggerId: "refund:test" });
    assert.equal(result.filter(row => row.applied).length, 2);
    assert.equal(await DamruTransaction.countDocuments({ _id: { $in: [orderReward._id, campaignReward._id] }, type: "credit" }), 2, "original rewards must remain immutable");
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id, category: "reward_reversal" }), 2);
    assert.equal(await RewardReversal.countDocuments({ userId: user._id, status: "APPLIED" }), 2);
    const [grossRow] = await DamruTransaction.aggregate([
      { $match: { userId: user._id, type: "credit", category: { $in: ["order_reward", "campaign"] } } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]);
    const [reversedRow] = await DamruTransaction.aggregate([
      { $match: { userId: user._id, category: "reward_reversal" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]);
    assert.equal(grossRow.amount, 300, "gross issuance must remain unchanged");
    assert.equal(reversedRow.amount, 300);
    assert.equal(grossRow.amount - reversedRow.amount, 0, "net issuance must be gross minus reversed");
    const reloaded = await User.findById(user._id).select("damruBalance rewardDebt").lean();
    assert.equal(reloaded?.damruBalance, 0);
    assert.equal(reloaded?.rewardDebt, 0);
  } finally { await cleanup(user._id, order._id); }
});

test("duplicate and concurrent triggers reverse one original reward exactly once", async () => {
  const { user, order } = await fixture(100);
  const original = await credit(user._id, order._id, "order_reward", 100);
  try {
    await Promise.all([
      applyReversal(original._id, { orderId: order._id, reason: "ORDER_CANCELLED", triggerId: "cancel:a" }),
      applyReversal(original._id, { orderId: order._id, reason: "FULL_REFUND", triggerId: "refund:b" }),
      applyReversal(original._id, { orderId: order._id, reason: "FULL_REFUND", triggerId: "refund:b" }),
    ]);
    assert.equal(await RewardReversal.countDocuments({ originalTransactionId: original._id }), 1);
    assert.equal(await DamruTransaction.countDocuments({ originalTransactionId: original._id, category: "reward_reversal" }), 1);
    assert.equal(await calculateReversibleAmount(original._id), 0, "over-reversal must be impossible");
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 0);
  } finally { await cleanup(user._id, order._id); }
});

test("insufficient wallet balance creates explicit debt and a future award recovers it", async () => {
  const { user, order } = await fixture(30);
  const original = await credit(user._id, order._id, "order_reward", 100, 30);
  try {
    await applyReversal(original._id, { orderId: order._id, reason: "FULL_REFUND", triggerId: "refund:debt" });
    let reloaded = await User.findById(user._id).select("damruBalance rewardDebt").lean();
    assert.equal(reloaded?.damruBalance, 0);
    assert.equal(reloaded?.rewardDebt, 70);
    const reversal = await RewardReversal.findOne({ originalTransactionId: original._id }).lean();
    assert.equal(reversal?.walletAmount, 30);
    assert.equal(reversal?.debtAmount, 70);

    const award = await awardDamru({ userId: user._id, category: "daily_login", amount: 100, description: "Future reward", idempotencyKey: `future-reward:${user._id}` });
    assert.equal(award.newBalance, 30);
    reloaded = await User.findById(user._id).select("damruBalance rewardDebt").lean();
    assert.equal(reloaded?.damruBalance, 30);
    assert.equal(reloaded?.rewardDebt, 0);
    assert.equal(await DamruTransaction.countDocuments({ userId: user._id, category: "reward_debt_recovery", amount: 70 }), 1);
  } finally { await cleanup(user._id, order._id); }
});

test("cancel before award is a no-op and an unlinked legacy credit is not guessed", async () => {
  const { user, order } = await fixture(25);
  try {
    assert.deepEqual(await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: "cancel:none" }), []);
    const legacy = await DamruTransaction.create({ userId: user._id, type: "credit", category: "legacy_opening_balance", amount: 25, balanceAfter: 25, description: "Legacy", idempotencyKey: `legacy-reversal:${user._id}` });
    const result = await applyReversal(legacy._id, { reason: "OTHER", note: "Manual legacy review", triggerId: "legacy:test" });
    assert.equal(result.unsupported, true);
    assert.equal(await RewardReversal.countDocuments({ originalTransactionId: legacy._id }), 0);
  } finally { await cleanup(user._id, order._id); }
});

test("cancel after award reverses the reward exactly once", async () => {
  const { user, order } = await fixture(100);
  const original = await credit(user._id, order._id, "order_reward", 100);
  try {
    await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
    await reverseOrderRewards({ orderId: order._id, reason: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
    assert.equal(await RewardReversal.countDocuments({ originalTransactionId: original._id, status: "APPLIED" }), 1);
    assert.equal(await DamruTransaction.countDocuments({ originalTransactionId: original._id, category: "reward_reversal" }), 1);
  } finally { await cleanup(user._id, order._id); }
});

test("failed refund does not trigger reward reversal", async () => {
  const { user, order } = await fixture(100);
  const original = await credit(user._id, order._id, "order_reward", 100);
  await Order.updateOne(
    { _id: order._id },
    { $set: { paymentMethod: "card", paymentStatus: "refund_pending", paymentAmount: 1000, pendingRefundAmount: 100 } }
  );
  const refund = await PaymentRefund.create({
    orderId: order._id,
    userId: user._id,
    gateway: "razorpay",
    gatewayPaymentId: "pay_failed_reversal_test",
    amount: 100,
    currency: "INR",
    status: "pending",
    reason: "Failed refund reversal test",
    requestedBy: new mongoose.Types.ObjectId(),
    requestedAt: new Date(),
    refundRequestId: `failed-reversal-${Date.now()}-${Math.random()}`,
  });
  try {
    await markRefundFailed(refund._id);
    assert.equal(await RewardReversal.countDocuments({ originalTransactionId: original._id }), 0);
    assert.equal(await DamruTransaction.countDocuments({ originalTransactionId: original._id, category: "reward_reversal" }), 0);
  } finally {
    await PaymentRefund.deleteOne({ _id: refund._id });
    await cleanup(user._id, order._id);
  }
});
