import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import Order from "../models/Order";
import MenuItem from "../models/MenuItem";
import Category from "../models/Category";
import DamruTransaction from "../models/DamruTransaction";
import EarnRule from "../models/EarnRule";
import RewardReversal from "../models/RewardReversal";
import AdminAuditLog from "../models/AdminAuditLog";
import { invalidateEarnRuleCache, validateEarnRule } from "../lib/rewards/earnRules";
import { fillDishRuleIdentity, findActiveConflict, getRuleVersionHistory } from "../lib/rewards/earnRuleAdmin";
import { awardOrderEarnings, estimateOrderDamru } from "../lib/rewards/orderEarnings";
import { recomputeRewardEntitlements } from "../lib/rewards/recomputeEntitlements";
import { getRewardsAnalytics } from "../lib/rewards/analyticsService";
import { getOrCreateDamruConfig, invalidateDamruConfigCache } from "../lib/getDamruConfig";
import DamruConfig from "../models/DamruConfig";

const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function fixture() {
  await connectDB();
  // Dish rewards only — isolate them from the base order reward for exact totals.
  await getOrCreateDamruConfig();
  await DamruConfig.updateOne({}, { $set: { "orderEarn.enabled": false } });
  invalidateDamruConfigCache();
  const category = await Category.create({ name: `Mains ${tag()}`, slug: `mains-${tag()}` });
  const mk = (name: string) => MenuItem.create({ name, slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${tag()}`, category: category._id, basePrice: 100 });
  const [biryani, paneer, drink] = await Promise.all([mk("Chicken Biryani"), mk("Paneer Tikka"), mk("Cold Drink")]);
  const user = await User.create({ name: "Dish Test", email: `dish-${tag()}@example.test`, password: "x" });
  return { category, biryani, paneer, drink, user };
}

/** Creates a dish reward the way the admin Dish Rewards page does (auto name/code, default basis). */
async function createDishReward(menuItemId: mongoose.Types.ObjectId, damruPerUnit: number) {
  const body = await fillDishRuleIdentity({ ruleType: "ITEM", menuItemIds: [String(menuItemId)], damruPerUnit, status: "ACTIVE" });
  const { values, error } = validateEarnRule(body);
  assert.equal(error, undefined);
  assert.equal(await findActiveConflict(values!), null);
  const rule = await EarnRule.create({ ...values, version: 1 });
  invalidateEarnRuleCache();
  return rule;
}

async function makeOrder(userId: mongoose.Types.ObjectId, lines: { item: { _id: mongoose.Types.ObjectId; name: string; category: mongoose.Types.ObjectId }; qty: number }[], opts: Record<string, unknown> = {}) {
  return Order.create({
    orderId: `DMR-DISH-${tag()}`, userId, userName: "Dish Test",
    items: lines.map(l => ({ menuItemId: l.item._id, categoryId: l.item.category, name: l.item.name, variantType: "none", custom: "", price: 100, qty: l.qty })),
    subtotal: 500, discount: 0, total: 500, finalAmount: 500, eligibleRewardAmount: 500,
    paymentMethod: "cod", paymentStatus: "pending", status: "delivered", ...opts,
  });
}

async function cleanup(f: Awaited<ReturnType<typeof fixture>>) {
  const menuIds = [f.biryani._id, f.paneer._id, f.drink._id];
  const rules = await EarnRule.find({ menuItemIds: { $in: menuIds } }).select("_id").lean();
  await Promise.all([
    DamruTransaction.deleteMany({ userId: f.user._id }),
    RewardReversal.deleteMany({ userId: f.user._id }),
    Order.deleteMany({ userId: f.user._id }),
    User.deleteOne({ _id: f.user._id }),
    EarnRule.deleteMany({ menuItemIds: { $in: menuIds } }),
    AdminAuditLog.deleteMany({ targetId: { $in: rules.map(r => String(r._id)) } }),
    MenuItem.deleteMany({ _id: { $in: menuIds } }),
    Category.deleteOne({ _id: f.category._id }),
  ]);
  await DamruConfig.updateOne({}, { $set: { "orderEarn.enabled": true } });
  invalidateDamruConfigCache();
  invalidateEarnRuleCache();
}

test("dish rewards are auto-named, one active rule per dish, and the §14 order earns 145 with a per-dish snapshot", async () => {
  const f = await fixture();
  try {
    const biryaniRule = await createDishReward(f.biryani._id, 50);
    await createDishReward(f.paneer._id, 30);
    await createDishReward(f.drink._id, 5);
    assert.equal(biryaniRule.name, "Chicken Biryani");
    assert.match(biryaniRule.code, /^DISH-CHICKEN-BIRYANI/);
    assert.equal(biryaniRule.basis, "PER_UNIT");

    // A second active reward for the same dish is refused.
    const dup = validateEarnRule(await fillDishRuleIdentity({ ruleType: "ITEM", menuItemIds: [String(f.biryani._id)], damruPerUnit: 20, status: "ACTIVE" })).values!;
    assert.match((await findActiveConflict(dup)) || "", /already rewards/);

    const lines = [{ item: f.biryani, qty: 2 }, { item: f.paneer, qty: 1 }, { item: f.drink, qty: 3 }];
    const estimate = await estimateOrderDamru({ userId: f.user._id, items: lines.map(l => ({ menuItemId: String(l.item._id), categoryId: String(l.item.category), name: l.item.name, qty: l.qty })), eligibleAmount: 500 });
    assert.equal(estimate.estimatedDamru, 145);
    assert.deepEqual(estimate.dishLines.map(l => l.damru).sort((a, b) => a - b), [15, 30, 100]);

    const order = await makeOrder(f.user._id, lines);
    const first = await awardOrderEarnings(order._id);
    assert.equal(first.credited, 145, "the estimate equals what delivery credits");

    const credits = await DamruTransaction.find({ orderId: order._id, category: "item_reward" }).lean();
    assert.equal(credits.length, 3, "one ledger credit per dish rule");
    const biryaniCredit = credits.find(c => String(c.earnRuleId) === String(biryaniRule._id))!;
    assert.equal(biryaniCredit.amount, 100);
    assert.match(biryaniCredit.description, /Dish reward: Chicken Biryani × 2 \(50 × 2\)/);
    const line = (biryaniCredit.ruleSnapshot as { lines: Record<string, unknown>[] }).lines[0];
    assert.deepEqual(
      { menuItemId: line.menuItemId, name: line.name, qty: line.qty, basis: line.basis, damruPerUnit: line.damruPerUnit, ruleVersion: line.ruleVersion, amount: line.amount, calculation: line.calculation },
      { menuItemId: String(f.biryani._id), name: "Chicken Biryani", qty: 2, basis: "PER_UNIT", damruPerUnit: 50, ruleVersion: 1, amount: 100, calculation: "50 × 2" }
    );

    // Duplicate and concurrent delivery events credit nothing more.
    assert.equal((await awardOrderEarnings(order._id)).credited, 0);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => awardOrderEarnings(order._id)));
    assert.equal(concurrent.reduce((s, r) => s + r.credited, 0), 0);
    assert.equal((await User.findById(f.user._id).lean())?.damruBalance, 145);
  } finally { await cleanup(f); }
});

test("changing a dish from 20 to 50 Damru: the old order stays 20 (and reverses 20), the next order gets 50", async () => {
  const f = await fixture();
  try {
    const rule = await createDishReward(f.biryani._id, 20);
    const oldOrder = await makeOrder(f.user._id, [{ item: f.biryani, qty: 2 }]);
    assert.equal((await awardOrderEarnings(oldOrder._id)).credited, 40);

    // Admin edits the same rule: 20 → 50 (version 2), exactly what PUT /earn-rules/[id] does.
    await EarnRule.updateOne({ _id: rule._id, version: 1 }, { $set: { damruPerUnit: 50 }, $inc: { version: 1 } });
    await AdminAuditLog.create([
      { adminId: new mongoose.Types.ObjectId(), action: "earn_rule_created", targetType: "EarnRule", targetId: String(rule._id), details: { after: { damruPerUnit: 20, basis: "PER_UNIT", status: "ACTIVE", version: 1 } } },
      { adminId: new mongoose.Types.ObjectId(), action: "earn_rule_updated", targetType: "EarnRule", targetId: String(rule._id), details: { after: { damruPerUnit: 50, basis: "PER_UNIT", status: "ACTIVE", version: 2 } } },
    ]);
    invalidateEarnRuleCache();

    const newOrder = await makeOrder(f.user._id, [{ item: f.biryani, qty: 2 }]);
    assert.equal((await awardOrderEarnings(newOrder._id)).credited, 100);
    const newCredit = await DamruTransaction.findOne({ orderId: newOrder._id, category: "item_reward" }).lean();
    assert.equal((newCredit?.ruleSnapshot as { version: number }).version, 2);

    // Old order untouched; its cancellation reverses the ORIGINAL 40, not 100.
    assert.equal((await DamruTransaction.findOne({ orderId: oldOrder._id, category: "item_reward" }).lean())?.amount, 40);
    await recomputeRewardEntitlements({ userId: f.user._id, orderId: oldOrder._id, trigger: "ORDER_CANCELLED", triggerId: `cancel:${oldOrder._id}` });
    const reversal = await DamruTransaction.findOne({ orderId: oldOrder._id, category: "reward_reversal" }).lean();
    assert.equal(reversal?.amount, 40);
    assert.equal((await User.findById(f.user._id).lean())?.damruBalance, 100);

    const history = await getRuleVersionHistory(String(rule._id));
    assert.deepEqual(history.map(h => [h.version, h.damruPerUnit]), [[1, 20], [2, 50]]);
  } finally { await cleanup(f); }
});

test("a fully refunded order reverses its dish rewards; paused rewards stop earning without touching history", async () => {
  const f = await fixture();
  try {
    const rule = await createDishReward(f.biryani._id, 50);
    const order = await makeOrder(f.user._id, [{ item: f.biryani, qty: 1 }], { paymentMethod: "razorpay", paymentStatus: "paid", paymentAmount: 500 });
    assert.equal((await awardOrderEarnings(order._id)).credited, 50);
    await recomputeRewardEntitlements({ userId: f.user._id, orderId: order._id, trigger: "REFUND_PROCESSED", triggerId: String(new mongoose.Types.ObjectId()), partialRefundAmount: 500, totalRefundedAmount: 500, paymentAmount: 500 });
    assert.equal((await DamruTransaction.findOne({ orderId: order._id, category: "reward_reversal" }).lean())?.amount, 50);

    await EarnRule.updateOne({ _id: rule._id }, { $set: { status: "PAUSED" }, $inc: { version: 1 } });
    invalidateEarnRuleCache();
    const later = await makeOrder(f.user._id, [{ item: f.biryani, qty: 1 }]);
    assert.equal((await awardOrderEarnings(later._id)).credited, 0, "a paused dish reward earns nothing");
    assert.equal(await DamruTransaction.countDocuments({ orderId: order._id, category: "item_reward" }), 1, "history is intact");
  } finally { await cleanup(f); }
});

test("analytics report Damru issued per dish from the ledger, not from today's rules", async () => {
  const f = await fixture();
  try {
    const rule = await createDishReward(f.biryani._id, 50);
    await awardOrderEarnings((await makeOrder(f.user._id, [{ item: f.biryani, qty: 2 }]))._id);
    await awardOrderEarnings((await makeOrder(f.user._id, [{ item: f.biryani, qty: 1 }]))._id);
    await EarnRule.updateOne({ _id: rule._id }, { $set: { damruPerUnit: 999 }, $inc: { version: 1 } });
    const analytics = await getRewardsAnalytics({ preset: "today" });
    const row = (analytics.dishes as { menuItemId: string; name: string; issued: number; orders: number; units: number; averagePerOrder: number }[]).find(d => d.menuItemId === String(f.biryani._id));
    assert.deepEqual({ issued: row?.issued, orders: row?.orders, units: row?.units, avg: row?.averagePerOrder, name: row?.name }, { issued: 150, orders: 2, units: 3, avg: 75, name: "Chicken Biryani" });
  } finally { await cleanup(f); }
});
