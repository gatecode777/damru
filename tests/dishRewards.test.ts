import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateOrderDamru, type EarnRuleInput } from "../lib/rewards/orderEarn";
import { buildRewardBadges, validateEarnRule } from "../lib/rewards/earnRules";
import { toDishLines } from "../lib/rewards/orderEarnings";
import { buildDishRewardRows } from "../lib/rewards/dishRewards";

const BIRYANI = "64b000000000000000000011";
const PANEER = "64b000000000000000000012";
const DRINK = "64b000000000000000000013";
const FRIES = "64b000000000000000000014";
const MAINS = "64c000000000000000000011";
const SIDES = "64c000000000000000000012";
const BRANCH_A = "64d000000000000000000011";

const NO_BASE = { rupeesPerDamru: 10, rounding: "FLOOR" as const, enabled: false };
const BASE = { rupeesPerDamru: 10, rounding: "FLOOR" as const, enabled: true };

/** A dish rule exactly as the admin "Dish Rewards" form produces it (validated, basis omitted → default). */
function dishRule(id: string, menuItemId: string, damruPerUnit: number, extra: Partial<EarnRuleInput> = {}): EarnRuleInput {
  const { values, error } = validateEarnRule({ name: id, code: id, ruleType: "ITEM", menuItemIds: [menuItemId], damruPerUnit, status: "ACTIVE" });
  assert.equal(error, undefined);
  return { ...values!, id, version: 1, startsAt: null, endsAt: null, ...extra };
}

const biryani = dishRule("DISH-BIRYANI", BIRYANI, 50);
const paneer = dishRule("DISH-PANEER", PANEER, 30);
const drink = dishRule("DISH-DRINK", DRINK, 5);

test("one dish: 50 Damru per item by default — qty 1 → 50, 2 → 100, 3 → 150", () => {
  assert.equal(biryani.basis, "PER_UNIT");
  for (const [qty, expected] of [[1, 50], [2, 100], [3, 150]]) {
    assert.equal(evaluateOrderDamru({ items: [{ menuItemId: BIRYANI, qty }], eligibleAmount: 0 }, [biryani], NO_BASE).totalDamru, expected);
  }
});

test("every dish has its own value: Biryani ×2 + Paneer ×1 + Drink ×3 = 145, with a per-dish breakdown", () => {
  const evaluation = evaluateOrderDamru({
    items: [
      { menuItemId: BIRYANI, categoryId: MAINS, name: "Chicken Biryani", qty: 2 },
      { menuItemId: PANEER, categoryId: MAINS, name: "Paneer Tikka", qty: 1 },
      { menuItemId: DRINK, categoryId: SIDES, name: "Cold Drink", qty: 3 },
    ],
    eligibleAmount: 0,
  }, [biryani, paneer, drink], NO_BASE);
  assert.equal(evaluation.totalDamru, 145);
  assert.deepEqual(
    toDishLines(evaluation).map(l => [l.name, l.qty, l.damru, l.calculation]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    [["Chicken Biryani", 2, 100, "50 × 2"], ["Cold Drink", 3, 15, "5 × 3"], ["Paneer Tikka", 1, 30, "30 × 1"]]
  );
  const byName = Object.fromEntries(toDishLines(evaluation).map(l => [l.name, l]));
  assert.equal(byName["Chicken Biryani"].damru, 100);
  assert.equal(byName["Paneer Tikka"].damru, 30);
  assert.equal(byName["Cold Drink"].damru, 15);
  for (const line of evaluation.itemRewards.flatMap(r => r.lines ?? [])) {
    assert.equal(line.basis, "PER_UNIT");
    assert.equal(line.ruleVersion, 1);
  }
});

test("a dish without an active rule earns no dish reward and shows no badge — never a fallback", () => {
  const e = evaluateOrderDamru({ items: [{ menuItemId: FRIES, categoryId: SIDES, name: "French Fries", qty: 4 }], eligibleAmount: 0 }, [biryani, paneer], NO_BASE);
  assert.equal(e.totalDamru, 0);
  assert.equal(toDishLines(e).length, 0);
  const badges = buildRewardBadges([biryani, paneer], [{ _id: BIRYANI, category: MAINS }, { _id: FRIES, category: SIDES }]);
  assert.equal(badges.get(BIRYANI)?.label, "Earn 50 Damru per item");
  assert.equal(badges.get(BIRYANI)?.shortLabel, "+50 Damru");
  assert.equal(badges.has(FRIES), false);
});

test("paused, expired and future dish rewards earn nothing", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");
  const items = [{ menuItemId: BIRYANI, qty: 2 }];
  const cases = [
    { ...biryani, status: "PAUSED" as const },
    { ...biryani, endsAt: "2026-09-23T00:00:00.000Z" },
    { ...biryani, startsAt: "2026-10-01T00:00:00.000Z" },
  ];
  for (const r of cases) assert.equal(evaluateOrderDamru({ items, eligibleAmount: 0 }, [r], NO_BASE, now).totalDamru, 0);
  // Inside its window it applies.
  const windowed = { ...biryani, startsAt: "2026-09-23T00:00:00.000Z", endsAt: "2026-09-30T23:59:59.000Z" };
  assert.equal(evaluateOrderDamru({ items, eligibleAmount: 0 }, [windowed], NO_BASE, now).totalDamru, 100);
});

test("a 0-Damru dish rule explicitly removes the reward, even over a category reward", () => {
  const sidesCategory: EarnRuleInput = { ...validateEarnRule({ name: "Sides", code: "SIDES", ruleType: "CATEGORY", categoryIds: [SIDES], basis: "PER_UNIT", damruPerUnit: 3 }).values!, id: "SIDES", version: 1, status: "ACTIVE", startsAt: null, endsAt: null };
  const friesZero = dishRule("DISH-FRIES", FRIES, 0);
  const items = [{ menuItemId: FRIES, categoryId: SIDES, qty: 2 }, { menuItemId: DRINK, categoryId: SIDES, qty: 1 }];
  const e = evaluateOrderDamru({ items, eligibleAmount: 0 }, [sidesCategory, friesZero], NO_BASE);
  assert.equal(e.totalDamru, 3, "fries earn 0; the drink still earns the category reward");
  const badges = buildRewardBadges([sidesCategory, friesZero], [{ _id: FRIES, category: SIDES }, { _id: DRINK, category: SIDES }]);
  assert.equal(badges.has(FRIES), false);
  assert.equal(badges.get(DRINK)?.damru, 3);
});

test("base + dish reward follow the configured behaviour: ADD (100) or REPLACE (50)", () => {
  const order = { items: [{ menuItemId: BIRYANI, qty: 1 }], eligibleAmount: 500 };
  const add = evaluateOrderDamru(order, [biryani], { ...BASE, dishRewardBaseBehavior: "ADD" });
  assert.deepEqual([add.baseReward.amount, add.totalDamru], [50, 100]);
  const replace = evaluateOrderDamru(order, [biryani], { ...BASE, dishRewardBaseBehavior: "REPLACE" });
  assert.deepEqual([replace.baseReward.amount, replace.baseReward.replacedBy, replace.totalDamru], [0, "DISH_REWARDS", 50]);
  // REPLACE only applies when a dish reward actually applies.
  const noDish = evaluateOrderDamru({ items: [{ menuItemId: FRIES, qty: 1 }], eligibleAmount: 500 }, [biryani], { ...BASE, dishRewardBaseBehavior: "REPLACE" });
  assert.equal(noDish.totalDamru, 50);
});

test("per line / per order basis and branch-specific dish rewards", () => {
  const perOrder = dishRule("DISH-BIRYANI-PO", BIRYANI, 50, { basis: "PER_ORDER" });
  assert.equal(evaluateOrderDamru({ items: [{ menuItemId: BIRYANI, qty: 3 }], eligibleAmount: 0 }, [perOrder], NO_BASE).totalDamru, 50);
  const perLine = dishRule("DISH-BIRYANI-PL", BIRYANI, 50, { basis: "PER_LINE" });
  assert.equal(evaluateOrderDamru({ items: [{ menuItemId: BIRYANI, qty: 3 }], eligibleAmount: 0 }, [perLine], NO_BASE).totalDamru, 50);
  const branchOnly = dishRule("DISH-BIRYANI-B", BIRYANI, 50, { branchIds: [BRANCH_A] });
  assert.equal(evaluateOrderDamru({ items: [{ menuItemId: BIRYANI, qty: 1 }], eligibleAmount: 0, branchId: "64d0000000000000000000ff" }, [branchOnly], NO_BASE).totalDamru, 0);
  assert.equal(evaluateOrderDamru({ items: [{ menuItemId: BIRYANI, qty: 1 }], eligibleAmount: 0, branchId: BRANCH_A }, [branchOnly], NO_BASE).totalDamru, 50);
});

test("admin dish list: governing rule, search, filters, sort and pagination", () => {
  const dishes = [
    { _id: BIRYANI, name: "Chicken Biryani", slug: "chicken-biryani", category: MAINS, basePrice: 299, isActive: true },
    { _id: PANEER, name: "Paneer Tikka", slug: "paneer-tikka", category: MAINS, basePrice: 249, isActive: true },
    { _id: DRINK, name: "Cold Drink", slug: "cold-drink", category: SIDES, basePrice: 60, isActive: true },
    { _id: FRIES, name: "French Fries", slug: "french-fries", category: SIDES, basePrice: 149, isActive: true },
  ];
  const oldPaused = { ...dishRule("DISH-BIRYANI-OLD", BIRYANI, 20), status: "PAUSED" as const, updatedAt: "2026-09-01T00:00:00.000Z" };
  const rules = [
    { ...biryani, updatedAt: "2026-09-20T00:00:00.000Z" }, oldPaused,
    { ...paneer, status: "PAUSED" as const, updatedAt: "2026-09-20T00:00:00.000Z" },
    { ...drink, branchIds: [BRANCH_A], updatedAt: "2026-09-20T00:00:00.000Z" },
  ];
  const names = new Map([[MAINS, "Mains"], [SIDES, "Sides"]]);

  const all = buildDishRewardRows(dishes, rules, names);
  assert.equal(all.total, 4);
  const biryaniRow = all.rows.find(r => r._id === BIRYANI)!;
  assert.equal(biryaniRow.reward?.damruPerUnit, 50, "the active rule governs, not the older paused one");
  assert.equal(biryaniRow.otherRules, 1);
  assert.equal(all.rows.find(r => r._id === FRIES)!.reward, null);

  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { q: "biry" }).rows.map(r => r.name), ["Chicken Biryani"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { q: "cold-drink" }).rows.map(r => r.name), ["Cold Drink"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { categoryId: SIDES }).rows.map(r => r.name), ["Cold Drink", "French Fries"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { configured: "no" }).rows.map(r => r.name), ["French Fries"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { status: "active" }).rows.map(r => r.name), ["Chicken Biryani", "Cold Drink"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { status: "inactive" }).rows.map(r => r.name), ["Paneer Tikka"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { branchId: "64d0000000000000000000ff" }).rows.map(r => r.name), ["Chicken Biryani", "Paneer Tikka"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { sort: "reward_desc" }).rows.map(r => r.name), ["Chicken Biryani", "Paneer Tikka", "Cold Drink", "French Fries"]);
  assert.deepEqual(buildDishRewardRows(dishes, rules, names, { sort: "reward_asc" }).rows.map(r => r.name), ["Cold Drink", "Paneer Tikka", "Chicken Biryani", "French Fries"]);
  const page2 = buildDishRewardRows(dishes, rules, names, { limit: 3, page: 2 });
  assert.deepEqual([page2.total, page2.page, page2.rows.length], [4, 2, 1]);
});
