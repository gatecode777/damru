import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTierDamru, evaluateOrderDamru, type EarnRuleInput } from "../lib/rewards/orderEarn";
import { buildRewardBadges, findEarnRuleConflict, toConflictShape, validateEarnRule } from "../lib/rewards/earnRules";
import { calculatePartialReversalAmount } from "../lib/rewards/reversalEngine";

const BASE = { rupeesPerDamru: 10, rounding: "FLOOR" as const, enabled: true };
const BIRYANI = "64b000000000000000000001";
const PANEER = "64b000000000000000000002";
const MAINS = "64c000000000000000000001";
const STARTERS = "64c000000000000000000002";
const BRANCH_A = "64d000000000000000000001";

function rule(partial: Partial<EarnRuleInput> & Pick<EarnRuleInput, "id" | "ruleType">): EarnRuleInput {
  return {
    code: partial.id.toUpperCase(), name: partial.id, version: 1, status: "ACTIVE",
    menuItemIds: [], categoryIds: [], branchIds: [], basis: "PER_UNIT", damruPerUnit: 0,
    tiers: [], tierMode: null, baseRewardBehavior: null, maxDamruPerOrder: null,
    includeInCampaignBase: false, startsAt: null, endsAt: null,
    ...partial,
  };
}
const dish = (basis: EarnRuleInput["basis"], damruPerUnit = 20) => rule({ id: "biryani", ruleType: "ITEM", menuItemIds: [BIRYANI], basis, damruPerUnit });
const tierRule = (tierMode: EarnRuleInput["tierMode"], baseRewardBehavior: EarnRuleInput["baseRewardBehavior"] = "ADD") => rule({
  id: "value", ruleType: "ORDER_VALUE_TIER", tierMode, baseRewardBehavior,
  tiers: [{ minAmount: 500, damru: 50 }, { minAmount: 1000, damru: 120 }, { minAmount: 2000, damru: 300 }],
});

test("base reward only: ₹100 → 10, ₹500 → 50, ₹1000 → 100", () => {
  for (const [value, damru] of [[100, 10], [500, 50], [1000, 100], [999.99, 99]] as const) {
    const e = evaluateOrderDamru({ items: [], eligibleAmount: value }, [], BASE);
    assert.equal(e.baseReward.amount, damru);
    assert.equal(e.totalDamru, damru);
  }
  assert.equal(evaluateOrderDamru({ items: [], eligibleAmount: 1000 }, [], { ...BASE, enabled: false }).totalDamru, 0);
});

test("dish reward basis: quantity 2 of a 20-Damru dish", () => {
  const line = [{ menuItemId: BIRYANI, categoryId: MAINS, qty: 2 }];
  assert.equal(evaluateOrderDamru({ items: line, eligibleAmount: 0 }, [dish("PER_UNIT")], BASE).totalDamru, 40);
  assert.equal(evaluateOrderDamru({ items: line, eligibleAmount: 0 }, [dish("PER_LINE")], BASE).totalDamru, 20);
  assert.equal(evaluateOrderDamru({ items: line, eligibleAmount: 0 }, [dish("PER_ORDER")], BASE).totalDamru, 20);
  // Two lines of the same dish (different variants/add-ons) — add-ons never add Damru on their own.
  const twoLines = [{ menuItemId: BIRYANI, qty: 1 }, { menuItemId: BIRYANI, qty: 3 }];
  assert.equal(evaluateOrderDamru({ items: twoLines, eligibleAmount: 0 }, [dish("PER_UNIT")], BASE).totalDamru, 80);
  assert.equal(evaluateOrderDamru({ items: twoLines, eligibleAmount: 0 }, [dish("PER_LINE")], BASE).totalDamru, 40);
  assert.equal(evaluateOrderDamru({ items: twoLines, eligibleAmount: 0 }, [dish("PER_ORDER")], BASE).totalDamru, 20);
  // Cap per order.
  assert.equal(evaluateOrderDamru({ items: line, eligibleAmount: 0 }, [{ ...dish("PER_UNIT"), maxDamruPerOrder: 30 }], BASE).totalDamru, 30);
});

test("a dish rule beats a category rule for the same line; other lines fall back to the category", () => {
  const categoryRule = rule({ id: "mains", ruleType: "CATEGORY", categoryIds: [MAINS], basis: "PER_UNIT", damruPerUnit: 5 });
  const e = evaluateOrderDamru({
    items: [{ menuItemId: BIRYANI, categoryId: MAINS, qty: 1 }, { menuItemId: PANEER, categoryId: MAINS, qty: 2 }, { menuItemId: "64b000000000000000000009", categoryId: STARTERS, qty: 1 }],
    eligibleAmount: 0,
  }, [dish("PER_UNIT"), categoryRule], BASE);
  assert.equal(e.itemRewards[0].amount, 20);
  assert.equal(e.categoryRewards[0].amount, 10);
  assert.equal(e.totalDamru, 30);
});

const TIER_CASES: [number, number, number, number][] = [
  // value,  HIGHEST_MATCH, CUMULATIVE, SLAB (damru per ₹100 inside each band)
  [499, 0, 0, 0],
  [500, 50, 50, 0],
  [999, 50, 50, 249],              // 499 × 50/100 = 249.5 → 249
  [1000, 120, 170, 250],           // band 500–1000 fully: 500 × 50/100
  [1200, 120, 170, 250 + 240],     // + 200 × 120/100
  [2000, 300, 470, 250 + 1200],    // + 1000 × 120/100
  [2500, 300, 470, 250 + 1200 + 1500], // + 500 × 300/100
];

test("order-value tiers for every supported mode at the documented thresholds", () => {
  const tiers = [{ minAmount: 500, damru: 50 }, { minAmount: 1000, damru: 120 }, { minAmount: 2000, damru: 300 }];
  for (const [value, highest, cumulative, slab] of TIER_CASES) {
    assert.equal(calculateTierDamru(tiers, "HIGHEST_MATCH", value * 100).amount, highest, `HIGHEST_MATCH ₹${value}`);
    assert.equal(calculateTierDamru(tiers, "CUMULATIVE", value * 100).amount, cumulative, `CUMULATIVE ₹${value}`);
    assert.equal(calculateTierDamru(tiers, "SLAB", value * 100).amount, slab, `SLAB ₹${value}`);
  }
});

test("order-value tier ADDs to or REPLACEs the base reward exactly as configured", () => {
  const add = evaluateOrderDamru({ items: [], eligibleAmount: 1000 }, [tierRule("HIGHEST_MATCH", "ADD")], BASE);
  assert.equal(add.baseReward.amount, 100);
  assert.equal(add.totalDamru, 220);
  const replace = evaluateOrderDamru({ items: [], eligibleAmount: 1000 }, [tierRule("HIGHEST_MATCH", "REPLACE")], BASE);
  assert.equal(replace.baseReward.amount, 0);
  assert.equal(replace.baseReward.computedAmount, 100);
  assert.equal(replace.totalDamru, 120);
  // Below every tier the REPLACE rule doesn't apply, so the base stays.
  assert.equal(evaluateOrderDamru({ items: [], eligibleAmount: 400 }, [tierRule("HIGHEST_MATCH", "REPLACE")], BASE).totalDamru, 40);
});

test("base + dish + order tier combine deterministically (₹1,000 order with a 20-Damru dish)", () => {
  const items = [{ menuItemId: BIRYANI, categoryId: MAINS, qty: 1 }];
  const add = evaluateOrderDamru({ items, eligibleAmount: 1000 }, [dish("PER_UNIT"), tierRule("HIGHEST_MATCH", "ADD")], BASE);
  assert.deepEqual([add.baseReward.amount, add.itemRewards[0].amount, add.orderValueRewards[0].amount, add.totalDamru], [100, 20, 120, 240]);
  const replace = evaluateOrderDamru({ items, eligibleAmount: 1000 }, [dish("PER_UNIT"), tierRule("HIGHEST_MATCH", "REPLACE")], BASE);
  assert.equal(replace.totalDamru, 140);
  // The admin-preview example: ₹1,200, base + tier + dish = 120 + 120 + 20.
  const preview = evaluateOrderDamru({ items, eligibleAmount: 1200 }, [dish("PER_UNIT"), tierRule("HIGHEST_MATCH", "ADD")], BASE);
  assert.equal(preview.totalDamru, 260);
  // Campaign base: base only unless a rule opts in.
  assert.equal(add.campaignBase, 100);
  const optIn = evaluateOrderDamru({ items, eligibleAmount: 1000 }, [{ ...dish("PER_UNIT"), includeInCampaignBase: true }], BASE);
  assert.equal(optIn.campaignBase, 120);
});

test("rules outside their window, paused, or for another branch never apply", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  const items = [{ menuItemId: BIRYANI, qty: 1 }];
  const future = { ...dish("PER_UNIT"), startsAt: "2026-10-01T00:00:00.000Z" };
  const expired = { ...dish("PER_UNIT"), endsAt: "2026-09-01T00:00:00.000Z" };
  const paused = { ...dish("PER_UNIT"), status: "PAUSED" as const };
  for (const r of [future, expired, paused]) assert.equal(evaluateOrderDamru({ items, eligibleAmount: 0 }, [r], BASE, now).totalDamru, 0);
  const branchOnly = { ...dish("PER_UNIT"), branchIds: [BRANCH_A] };
  assert.equal(evaluateOrderDamru({ items, eligibleAmount: 0, branchId: null }, [branchOnly], BASE, now).totalDamru, 0);
  assert.equal(evaluateOrderDamru({ items, eligibleAmount: 0, branchId: BRANCH_A }, [branchOnly], BASE, now).totalDamru, 20);
});

test("menu badges come only from live, all-branch rules and a dish rule wins over its category", () => {
  const categoryRule = rule({ id: "mains", ruleType: "CATEGORY", categoryIds: [MAINS], basis: "PER_ORDER", damruPerUnit: 5 });
  const badges = buildRewardBadges(
    [dish("PER_UNIT"), categoryRule, { ...dish("PER_UNIT", 99), id: "branch", code: "BRANCH", menuItemIds: [PANEER], branchIds: [BRANCH_A] }],
    [{ _id: BIRYANI, category: MAINS }, { _id: PANEER, category: MAINS }, { _id: "64b000000000000000000009", category: STARTERS }]
  );
  assert.deepEqual(badges.get(BIRYANI), { damru: 20, basis: "PER_UNIT", label: "Earn 20 Damru" });
  assert.deepEqual(badges.get(PANEER), { damru: 5, basis: "PER_ORDER", label: "Earn 5 Damru per order" });
  assert.equal(badges.has("64b000000000000000000009"), false);
});

test("earn-rule validation rejects decimals, negatives, duplicate or unsorted tiers and missing basis", () => {
  const baseDish = { name: "Biryani", code: "biryani-20", ruleType: "ITEM", menuItemIds: [BIRYANI], basis: "PER_UNIT", damruPerUnit: 20 };
  assert.equal(validateEarnRule(baseDish).values?.code, "BIRYANI-20");
  assert.ok(validateEarnRule({ ...baseDish, damruPerUnit: 20.5 }).error);
  assert.ok(validateEarnRule({ ...baseDish, damruPerUnit: -1 }).error);
  assert.ok(validateEarnRule({ ...baseDish, basis: undefined }).error);
  assert.ok(validateEarnRule({ ...baseDish, menuItemIds: [] }).error);
  assert.ok(validateEarnRule({ ...baseDish, menuItemIds: ["not-an-id"] }).error);
  assert.ok(validateEarnRule({ ...baseDish, startsAt: "2026-10-02", endsAt: "2026-10-01" }).error);
  const tier = { name: "Value", code: "VALUE", ruleType: "ORDER_VALUE_TIER", tierMode: "HIGHEST_MATCH", baseRewardBehavior: "ADD" };
  assert.ok(validateEarnRule({ ...tier, tiers: [{ minAmount: 500, damru: 50 }, { minAmount: 1000, damru: 120 }] }).values);
  assert.match(validateEarnRule({ ...tier, tiers: [{ minAmount: 500, damru: 50 }, { minAmount: 500, damru: 60 }] }).error || "", /same minimum/);
  assert.match(validateEarnRule({ ...tier, tiers: [{ minAmount: 1000, damru: 120 }, { minAmount: 500, damru: 50 }] }).error || "", /sorted/);
  assert.ok(validateEarnRule({ ...tier, tiers: [{ minAmount: 500.5, damru: 50 }] }).error, "rupee thresholds are whole numbers");
  assert.ok(validateEarnRule({ ...tier, tiers: [{ minAmount: 500, damru: -5 }] }).error);
  assert.ok(validateEarnRule({ ...tier, tiers: [{ minAmount: 500, damru: 0 }] }).error, "a tier rule must award something");
  assert.ok(validateEarnRule({ ...tier, tierMode: "BEST", tiers: [{ minAmount: 500, damru: 5 }] }).error);
});

test("conflicting active rules are detected (same dish or overlapping order-value rules)", () => {
  const a = toConflictShape(validateEarnRule({ name: "A", code: "RULE-A", ruleType: "ITEM", menuItemIds: [BIRYANI, PANEER], basis: "PER_UNIT", damruPerUnit: 20 }).values!);
  const b = toConflictShape(validateEarnRule({ name: "B", code: "RULE-B", ruleType: "ITEM", menuItemIds: [PANEER], basis: "PER_UNIT", damruPerUnit: 10 }).values!);
  assert.match(findEarnRuleConflict(a, [b]) || "", /RULE-B already rewards/);
  const later = { ...b, startsAt: new Date("2030-01-01"), endsAt: new Date("2030-02-01") };
  const earlier = { ...a, startsAt: new Date("2029-01-01"), endsAt: new Date("2029-02-01") };
  assert.equal(findEarnRuleConflict(earlier, [later]), null, "non-overlapping schedules don't conflict");
  const t1 = { code: "T1", ruleType: "ORDER_VALUE_TIER" as const, menuItemIds: [], categoryIds: [], branchIds: [], startsAt: null, endsAt: null };
  const t2 = { ...t1, code: "T2", branchIds: [BRANCH_A] };
  assert.match(findEarnRuleConflict(t1, [t2]) || "", /T2/);
});

test("partial-refund reversal uses the credit's own snapshot, never today's rule", () => {
  // Base reward snapshotted at ₹10 per Damru: ₹1000 order → 100 Damru; 30% of the payment refunded.
  const base = calculatePartialReversalAmount({ originalEligibleAmount: 1000, originalReward: 100, refundedAmount: 300, paymentAmount: 1000, alreadyReversed: 0, ruleSnapshot: { kind: "BASE", rupeesPerDamru: 10 } });
  assert.equal(base.additionalReversal, 30);
  // A dish reward (no per-₹ formula) scales with the eligible value that remains.
  const item = calculatePartialReversalAmount({ originalEligibleAmount: 1000, originalReward: 20, refundedAmount: 500, paymentAmount: 1000, alreadyReversed: 0, ruleSnapshot: { kind: "ITEM" } });
  assert.equal(item.additionalReversal, 10);
  // Repeated partial refunds never reverse more than was credited.
  const again = calculatePartialReversalAmount({ originalEligibleAmount: 1000, originalReward: 20, refundedAmount: 1000, paymentAmount: 1000, alreadyReversed: 10, ruleSnapshot: { kind: "ITEM" } });
  assert.equal(again.additionalReversal, 10);
  // Percent-bonus campaigns scale proportionally (previously they were never partially reversed).
  const pct = calculatePartialReversalAmount({ originalEligibleAmount: 1000, originalReward: 50, refundedAmount: 500, paymentAmount: 1000, alreadyReversed: 0, campaignSnapshot: { rewardMode: "PERCENT_BONUS", rewardValue: 50 } });
  assert.equal(pct.additionalReversal, 25);
  const fixed = calculatePartialReversalAmount({ originalEligibleAmount: 1000, originalReward: 75, refundedAmount: 1, paymentAmount: 1000, alreadyReversed: 0, campaignSnapshot: { rewardMode: "FIXED_DAMRU" } });
  assert.equal(fixed.additionalReversal, 75);
});
