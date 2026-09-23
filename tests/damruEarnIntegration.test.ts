import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import Order from "../models/Order";
import DamruTransaction from "../models/DamruTransaction";
import DamruConfig from "../models/DamruConfig";
import EarnRule from "../models/EarnRule";
import RewardReversal from "../models/RewardReversal";
import { getDamruConfig, getOrCreateDamruConfig, invalidateDamruConfigCache } from "../lib/getDamruConfig";
import { invalidateEarnRuleCache } from "../lib/rewards/earnRules";
import { awardOrderEarnings, estimateOrderDamru } from "../lib/rewards/orderEarnings";
import { redeemDamru, awardDamru, adjustDamru } from "../lib/rewardEngine";
import { applyReversal } from "../lib/rewards/reversalEngine";
import { recomputeRewardEntitlements } from "../lib/rewards/recomputeEntitlements";

const BIRYANI = new mongoose.Types.ObjectId();
const MAINS = new mongoose.Types.ObjectId();
const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(damruBalance = 0) {
  return User.create({ name: "Earn Test", email: `earn-${tag()}@example.test`, password: "x", damruBalance });
}

async function makeOrder(userId: mongoose.Types.ObjectId, opts: { eligible: number; qty?: number; status?: string; paymentMethod?: string; paymentStatus?: string; total?: number; finalAmount?: number } ) {
  return Order.create({
    orderId: `DMR-EARN-${tag()}`,
    userId,
    userName: "Earn Test",
    items: [{ menuItemId: BIRYANI, categoryId: MAINS, name: "Biryani", variantType: "none", custom: "", price: opts.eligible, qty: opts.qty ?? 1 }],
    subtotal: opts.eligible,
    discount: 0,
    total: opts.total ?? opts.eligible,
    finalAmount: opts.finalAmount ?? opts.total ?? opts.eligible,
    eligibleRewardAmount: opts.eligible,
    paymentMethod: opts.paymentMethod ?? "cod",
    paymentStatus: opts.paymentStatus ?? "pending",
    status: opts.status ?? "delivered",
  });
}

async function setConfig(patch: Record<string, unknown>) {
  await getOrCreateDamruConfig();
  await DamruConfig.updateOne({}, { $set: patch });
  invalidateDamruConfigCache();
}

async function resetConfig() {
  await DamruConfig.updateOne({}, { $set: { paisePerDamru: 10, orderEarn: { rupeesPerDamru: 10, rounding: "FLOOR", enabled: true }, dailyEarnLimit: null, minRedemption: 100, maxRedemptionPerOrder: 2000 } });
  invalidateDamruConfigCache();
}

async function cleanup(userIds: mongoose.Types.ObjectId[]) {
  await Promise.all([
    DamruTransaction.deleteMany({ userId: { $in: userIds } }),
    RewardReversal.deleteMany({ userId: { $in: userIds } }),
    Order.deleteMany({ userId: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
    EarnRule.deleteMany({ code: /^TEST-/ }),
  ]);
  invalidateEarnRuleCache();
  await resetConfig();
}

async function activeRules() {
  await EarnRule.create({ name: "Biryani", code: "TEST-BIRYANI", ruleType: "ITEM", status: "ACTIVE", menuItemIds: [BIRYANI], basis: "PER_UNIT", damruPerUnit: 20 });
  await EarnRule.create({ name: "Value", code: "TEST-VALUE", ruleType: "ORDER_VALUE_TIER", status: "ACTIVE", tiers: [{ minAmount: 500, damru: 50 }, { minAmount: 1000, damru: 120 }], tierMode: "HIGHEST_MATCH", baseRewardBehavior: "ADD" });
  invalidateEarnRuleCache();
}

test("legacy float redemptionRate migrates once into integer paisePerDamru; fresh config defaults to 10 Damru = ₹1", async () => {
  await connectDB();
  await DamruConfig.deleteMany({});
  invalidateDamruConfigCache();
  assert.equal((await getDamruConfig()).paisePerDamru, 10, "fresh default: 10 Damru = ₹1");

  await DamruConfig.deleteMany({});
  await DamruConfig.collection.insertOne({ redemptionRate: 0.2, minRedemption: 100, maxRedemptionPerOrder: 2000 });
  invalidateDamruConfigCache();
  assert.equal((await getDamruConfig()).paisePerDamru, 20, "live ₹0.20 per Damru is preserved as 20 paise");
  await DamruConfig.deleteMany({});
  invalidateDamruConfigCache();
  await getDamruConfig();
});

test("delivered ×5 and 5 concurrent deliveries produce exactly one credit per rule, with snapshots", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    await activeRules();
    const order = await makeOrder(user._id, { eligible: 1000 });
    const first = await awardOrderEarnings(order._id);
    assert.equal(first.credited, 100 + 20 + 120);
    for (let i = 0; i < 4; i++) assert.equal((await awardOrderEarnings(order._id)).credited, 0);

    const concurrentOrder = await makeOrder(user._id, { eligible: 1000 });
    const results = await Promise.all(Array.from({ length: 5 }, () => awardOrderEarnings(concurrentOrder._id)));
    assert.equal(results.reduce((s, r) => s + r.credited, 0), 240, "concurrent triggers credit once in total");

    for (const o of [order, concurrentOrder]) {
      const credits = await DamruTransaction.find({ orderId: o._id, type: "credit" }).lean();
      assert.deepEqual(credits.map(c => c.category).sort(), ["item_reward", "order_reward", "tier_reward"]);
      for (const c of credits) {
        assert.ok(c.ruleSnapshot, "every order credit carries its rule snapshot");
        assert.equal(c.paisePerDamru, 10);
        assert.equal(c.valuePaise, c.amount * 10);
      }
    }
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 480);
  } finally { await cleanup([user._id]); }
});

test("rule edits after delivery never change what an order earned or how it is reversed", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    await activeRules();
    const order = await makeOrder(user._id, { eligible: 1000 });
    await awardOrderEarnings(order._id);
    // Admin raises the dish reward to 30 and the base rate to ₹5 per Damru.
    await EarnRule.updateOne({ code: "TEST-BIRYANI" }, { $set: { damruPerUnit: 30 }, $inc: { version: 1 } });
    await setConfig({ "orderEarn.rupeesPerDamru": 5 });
    invalidateEarnRuleCache();
    assert.equal((await awardOrderEarnings(order._id)).credited, 0, "re-delivery reuses the frozen evaluation");
    const item = await DamruTransaction.findOne({ orderId: order._id, category: "item_reward" }).lean();
    assert.equal(item?.amount, 20);
    assert.equal((item?.ruleSnapshot as { version: number }).version, 1);

    await recomputeRewardEntitlements({ userId: user._id, orderId: order._id, trigger: "ORDER_CANCELLED", triggerId: `cancel:${order._id}` });
    const reversed = await DamruTransaction.aggregate([{ $match: { orderId: order._id, category: "reward_reversal" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    assert.equal(reversed[0]?.total, 240, "reversal claws back exactly the original 100 + 20 + 120");
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 0);
  } finally { await cleanup([user._id]); }
});

test("a partial refund reverses proportionally from snapshots; a later full refund never over-reverses", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    await activeRules();
    const order = await makeOrder(user._id, { eligible: 1000, paymentMethod: "razorpay", paymentStatus: "paid" });
    await Order.updateOne({ _id: order._id }, { $set: { paymentAmount: 1000 } });
    await awardOrderEarnings(order._id);
    const refundA = new mongoose.Types.ObjectId();
    await recomputeRewardEntitlements({ userId: user._id, orderId: order._id, trigger: "REFUND_PROCESSED", triggerId: String(refundA), partialRefundAmount: 500, totalRefundedAmount: 500, paymentAmount: 1000 });
    const afterPartial = await DamruTransaction.find({ orderId: order._id, category: "reward_reversal" }).lean();
    const byCategory = Object.fromEntries(afterPartial.map(r => [r.originalCategory, r.amount]));
    assert.deepEqual(byCategory, { order_reward: 50, item_reward: 10, tier_reward: 60 });

    const refundB = new mongoose.Types.ObjectId();
    await recomputeRewardEntitlements({ userId: user._id, orderId: order._id, trigger: "REFUND_PROCESSED", triggerId: String(refundB), partialRefundAmount: 500, totalRefundedAmount: 1000, paymentAmount: 1000 });
    const total = await DamruTransaction.aggregate([{ $match: { orderId: order._id, category: "reward_reversal" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    assert.equal(total[0]?.total, 240, "partial + full refund reverse exactly what was credited");
  } finally { await cleanup([user._id]); }
});

test("cancellation and refund of the same credit (different triggers) reverse it only once", async () => {
  await connectDB();
  const user = await makeUser(100);
  try {
    const order = await makeOrder(user._id, { eligible: 1000 });
    const credit = await DamruTransaction.create({ userId: user._id, type: "credit", category: "order_reward", amount: 100, balanceAfter: 100, description: "t", idempotencyKey: `t-${tag()}`, orderId: order._id, originalAmount: 100, remainingAmount: 100 });
    await Promise.all([
      applyReversal(credit._id, { orderId: order._id, reason: "ORDER_CANCELLED", triggerId: "cancel:x" }),
      applyReversal(credit._id, { orderId: order._id, reason: "FULL_REFUND", triggerId: "refund:y" }),
    ]);
    const sum = await DamruTransaction.aggregate([{ $match: { originalTransactionId: credit._id, category: "reward_reversal" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    assert.equal(sum[0]?.total, 100);
    assert.equal((await User.findById(user._id).lean())?.rewardDebt, 0, "no phantom debt from a second reversal");
  } finally { await cleanup([user._id]); }
});

test("COD with failed payment never earns; a delivered COD later marked failed is reversed", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    const failed = await makeOrder(user._id, { eligible: 500, paymentStatus: "failed" });
    assert.equal((await awardOrderEarnings(failed._id)).skipped, "NOT_ELIGIBLE");
    assert.equal(await DamruTransaction.countDocuments({ orderId: failed._id }), 0);

    const later = await makeOrder(user._id, { eligible: 500 });
    assert.equal((await awardOrderEarnings(later._id)).credited, 50);
    await Order.updateOne({ _id: later._id }, { $set: { paymentStatus: "failed" } });
    await recomputeRewardEntitlements({ userId: user._id, orderId: later._id, trigger: "PAYMENT_FAILED", triggerId: `cod-payment-failed:${later._id}` });
    const reversal = await DamruTransaction.findOne({ orderId: later._id, category: "reward_reversal" }).lean();
    assert.equal(reversal?.amount, 50);
    assert.equal(reversal?.reversalReason, "PAYMENT_REVERSED");
  } finally { await cleanup([user._id]); }
});

test("redemption: ₹150 payable with 2,000 Damru requested debits only 1,500 — no Damru is lost", async () => {
  await connectDB();
  const user = await makeUser(3000);
  try {
    const order = await makeOrder(user._id, { eligible: 150, status: "confirmed" });
    const result = await redeemDamru(user._id, 2000, order._id);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.amount, 1500);
    assert.equal(result.capped, true);
    assert.equal(result.discount, 150);
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 1500);
    const debit = await DamruTransaction.findOne({ orderId: order._id, category: "redemption" }).lean();
    assert.equal(debit?.amount, 1500);
    assert.equal(debit?.valuePaise, 15000);
  } finally { await cleanup([user._id]); }
});

test("redemption rejects fractions and orders that are no longer being placed", async () => {
  await connectDB();
  const user = await makeUser(3000);
  try {
    const open = await makeOrder(user._id, { eligible: 1000, status: "confirmed" });
    for (const bad of [150.5, 0.5, -100, NaN, Infinity]) {
      const r = await redeemDamru(user._id, bad, open._id);
      assert.equal(r.success, false, `amount ${bad} must be rejected`);
    }
    const delivered = await makeOrder(user._id, { eligible: 1000, status: "delivered" });
    assert.equal((await redeemDamru(user._id, 500, delivered._id)).success, false);
    const paid = await makeOrder(user._id, { eligible: 1000, status: "confirmed", paymentMethod: "razorpay", paymentStatus: "paid" });
    assert.equal((await redeemDamru(user._id, 500, paid._id)).success, false);
    assert.equal((await User.findById(user._id).lean())?.damruBalance, 3000, "nothing was debited");
    assert.equal((await adjustDamru({ userId: user._id, amount: 10.5, direction: "credit", reason: "t", adminId: new mongoose.Types.ObjectId() })).success, false);
    await assert.rejects(() => awardDamru({ userId: user._id, category: "order_reward", amount: 1.5, description: "t", idempotencyKey: `frac-${tag()}` }));
  } finally { await cleanup([user._id]); }
});

test("a changed Damru value applies to new redemptions while past rows keep their recorded value", async () => {
  await connectDB();
  const user = await makeUser(5000);
  try {
    const first = await makeOrder(user._id, { eligible: 1000, status: "confirmed" });
    const a = await redeemDamru(user._id, 500, first._id);
    assert.equal(a.success && a.discount, 50);            // 10 Damru = ₹1

    await setConfig({ paisePerDamru: 5 });                 // 20 Damru = ₹1
    const second = await makeOrder(user._id, { eligible: 1000, status: "confirmed" });
    const b = await redeemDamru(user._id, 500, second._id);
    assert.equal(b.success && b.discount, 25);

    const firstRow = await DamruTransaction.findOne({ orderId: first._id, category: "redemption" }).lean();
    assert.equal(firstRow?.valuePaise, 5000, "the earlier redemption still records ₹50");
    assert.equal(firstRow?.paisePerDamru, 10);
  } finally { await cleanup([user._id]); }
});

test("daily earn limit caps order-derived credits per customer per day, even concurrently", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    await setConfig({ dailyEarnLimit: 150 });
    const orders = await Promise.all([1000, 1000, 1000].map(eligible => makeOrder(user._id, { eligible })));
    const results = await Promise.all(orders.map(o => awardOrderEarnings(o._id)));
    assert.equal(results.reduce((s, r) => s + r.credited, 0), 150, "never more than the limit");
    const capped = await DamruTransaction.findOne({ userId: user._id, "ruleSnapshot.dailyLimit": { $exists: true } }).lean();
    assert.ok(capped, "the capped credit records the requested vs granted amounts");
    // One-off grants are outside the limit.
    const welcome = await awardDamru({ userId: user._id, category: "welcome_registration", amount: 100, description: "w", idempotencyKey: `welcome-${tag()}` });
    assert.equal("transaction" in welcome && welcome.transaction?.amount, 100);
  } finally { await cleanup([user._id]); }
});

test("the checkout estimate equals what delivery credits for the same order", async () => {
  await connectDB();
  const user = await makeUser();
  try {
    await activeRules();
    const estimate = await estimateOrderDamru({ userId: user._id, items: [{ menuItemId: String(BIRYANI), categoryId: String(MAINS), qty: 2 }], eligibleAmount: 1200 });
    const order = await makeOrder(user._id, { eligible: 1200, qty: 2 });
    const awarded = await awardOrderEarnings(order._id);
    assert.equal(estimate.estimatedDamru, awarded.credited);
    assert.equal(estimate.estimatedDamru, 120 + 40 + 120);
    assert.equal(estimate.estimatedValuePaise, estimate.estimatedDamru * 10);
    const guest = await estimateOrderDamru({ userId: null, items: [], eligibleAmount: 1200 });
    assert.equal(guest.eligible, false);
    assert.equal(guest.estimatedDamru, 0);
  } finally { await cleanup([user._id]); }
});

test("a 2× campaign doubles the campaign base (base + opted-in rules) and the estimate includes it", async () => {
  await connectDB();
  const { default: RewardCampaign } = await import("../models/RewardCampaign");
  const { default: RewardCampaignUsage } = await import("../models/RewardCampaignUsage");
  const { default: RewardCampaignUserUsage } = await import("../models/RewardCampaignUserUsage");
  const { awardCampaignBonuses } = await import("../lib/rewards/campaignEngine");
  const user = await makeUser();
  const campaign = await RewardCampaign.create({
    name: "Weekend Food Festival", code: `TEST-WEEKEND-${tag()}`, campaignType: "ORDER_MULTIPLIER", status: "ACTIVE",
    startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
    trigger: "ORDER_DELIVERED", rewardMode: "MULTIPLIER", rewardValue: 2, maxRewardPerEvent: null, maxRewardPerUser: null, globalBudgetDamru: null,
  });
  try {
    await EarnRule.create({ name: "Biryani", code: "TEST-BIRYANI", ruleType: "ITEM", status: "ACTIVE", menuItemIds: [BIRYANI], basis: "PER_UNIT", damruPerUnit: 20, includeInCampaignBase: true });
    invalidateEarnRuleCache();
    const estimate = await estimateOrderDamru({ userId: user._id, items: [{ menuItemId: String(BIRYANI), categoryId: String(MAINS), qty: 1 }], eligibleAmount: 1000 });
    // base 100 + dish 20 = 120 order Damru; campaign doubles the 120 campaign base → +120.
    assert.equal(estimate.orderDamru, 120);
    assert.equal(estimate.campaignDamru, 120);
    assert.equal(estimate.estimatedDamru, 240);

    const order = await makeOrder(user._id, { eligible: 1000 });
    const earned = await awardOrderEarnings(order._id);
    const bonuses = await awardCampaignBonuses({ trigger: "ORDER_DELIVERED", userId: user._id, sourceId: String(order._id), baseReward: earned.campaignBase, orderId: order._id, eligibleAmount: 1000, menuItemIds: [BIRYANI], categoryIds: [MAINS] });
    assert.equal(earned.credited + bonuses.reduce((s, b) => s + b.amount, 0), estimate.estimatedDamru);
    // Re-running the delivered pipeline never pays the campaign twice.
    const again = await awardCampaignBonuses({ trigger: "ORDER_DELIVERED", userId: user._id, sourceId: String(order._id), baseReward: earned.campaignBase, orderId: order._id, eligibleAmount: 1000 });
    assert.equal(again.length, 0);
    assert.equal(await DamruTransaction.countDocuments({ orderId: order._id, category: "campaign" }), 1);
  } finally {
    await Promise.all([
      RewardCampaign.deleteOne({ _id: campaign._id }),
      RewardCampaignUsage.deleteMany({ campaignId: campaign._id }),
      RewardCampaignUserUsage.deleteMany({ campaignId: campaign._id }),
    ]);
    await cleanup([user._id]);
  }
});
