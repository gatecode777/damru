import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseEarnDamru, damruPerRupee, damruToPaise, isValidPaisePerDamru, isWholeDamru, maxDamruForPaise, parseWholeDamru, valueSnapshot,
} from "../lib/rewards/damruValue";
import { calculateLiability } from "../lib/rewards/analytics";
import { validateDamruConfigUpdate } from "../lib/rewards/damruConfigUpdate";
import type { DamruConfigValues } from "../lib/getDamruConfig";

test("10 Damru = ₹1 (10 paise per Damru) converts exactly in integer paise", () => {
  assert.equal(damruToPaise(10, 10), 100);      // ₹1
  assert.equal(damruToPaise(100, 10), 1000);    // ₹10
  assert.equal(damruToPaise(500, 10), 5000);    // ₹50
  assert.equal(damruToPaise(1000, 10), 10000);  // ₹100
  assert.equal(damruPerRupee(10), 10);
  assert.deepEqual(valueSnapshot(1250, 10), { paisePerDamru: 10, valuePaise: 12500 });
});

test("a changed rate (20 Damru = ₹1 or 5 Damru = ₹1) is applied everywhere through the same helpers", () => {
  assert.equal(damruPerRupee(5), 20);
  assert.equal(damruToPaise(100, 5), 500);      // 20 Damru = ₹1 → 100 Damru = ₹5
  assert.equal(damruPerRupee(20), 5);
  assert.equal(damruToPaise(100, 20), 2000);    // 5 Damru = ₹1 → 100 Damru = ₹20
  assert.equal(calculateLiability(1250, 10), 125);
  assert.equal(calculateLiability(1250, 5), 62.5);
  assert.equal(calculateLiability(-10, 10), 0);
});

test("whole-number Damru validation rejects fractions, negatives, NaN and Infinity", () => {
  for (const bad of [10.5, 20.25, 0.5, -1, NaN, Infinity, -Infinity, "12.5", "abc", {}, [1]]) {
    assert.equal(parseWholeDamru(bad), null, `expected ${String(bad)} to be rejected`);
  }
  assert.equal(parseWholeDamru("150"), 150);
  assert.equal(parseWholeDamru(150), 150);
  assert.equal(parseWholeDamru(""), 0);
  assert.equal(parseWholeDamru(undefined), 0);
  assert.equal(isWholeDamru(3), true);
  assert.equal(isWholeDamru(3.2), false);
  assert.equal(isValidPaisePerDamru(10), true);
  for (const bad of [0, -5, 2.5, NaN, 10_001]) assert.equal(isValidPaisePerDamru(bad), false);
});

test("the redeemable Damru never exceeds what the payable amount can absorb", () => {
  assert.equal(maxDamruForPaise(15000, 10), 1500);   // ₹150 payable → at most 1500 Damru
  assert.equal(maxDamruForPaise(15005, 10), 1500);   // floor: never over-discount by a paisa
  assert.equal(maxDamruForPaise(0, 10), 0);
  assert.equal(maxDamruForPaise(-100, 10), 0);
});

test("base order earning: ₹10 spent = 1 Damru, floored", () => {
  assert.equal(baseEarnDamru(10000, 10), 10);    // ₹100
  assert.equal(baseEarnDamru(50000, 10), 50);    // ₹500
  assert.equal(baseEarnDamru(100000, 10), 100);  // ₹1000
  assert.equal(baseEarnDamru(99999, 10), 99);    // ₹999.99
  assert.equal(baseEarnDamru(100000, 20), 50);   // configurable: ₹20 per Damru
  assert.equal(baseEarnDamru(100000, 0), 0);
});

const current: DamruConfigValues = {
  paisePerDamru: 10,
  orderEarn: { rupeesPerDamru: 10, rounding: "FLOOR", enabled: true },
  minRedemption: 100, maxRedemptionPerOrder: 2000, dailyEarnLimit: null,
  expiryEnabled: false, expiryDays: null, expiryWarningDays: 30,
  loyaltyThresholds: { silver: 1000, gold: 5000, platinum: 10000 },
};

test("admin config validation accepts whole-number changes and rejects invalid money values", () => {
  assert.equal(validateDamruConfigUpdate({ paisePerDamru: 5 }, current).next?.paisePerDamru, 5);
  assert.equal(validateDamruConfigUpdate({ orderEarn: { rupeesPerDamru: 20 } }, current).next?.orderEarn.rupeesPerDamru, 20);
  assert.equal(validateDamruConfigUpdate({ dailyEarnLimit: 500 }, current).next?.dailyEarnLimit, 500);
  assert.equal(validateDamruConfigUpdate({ dailyEarnLimit: null }, current).next?.dailyEarnLimit, null);
  for (const bad of [0, -10, 2.5, "10", null]) {
    assert.ok(validateDamruConfigUpdate({ paisePerDamru: bad }, current).error, `paisePerDamru ${String(bad)} must be rejected`);
  }
  assert.ok(validateDamruConfigUpdate({ orderEarn: { rupeesPerDamru: 0 } }, current).error);
  assert.ok(validateDamruConfigUpdate({ orderEarn: { rupeesPerDamru: 7.5 } }, current).error);
  assert.ok(validateDamruConfigUpdate({ dailyEarnLimit: 0 }, current).error);
  assert.ok(validateDamruConfigUpdate({ dailyEarnLimit: 12.5 }, current).error);
  assert.ok(validateDamruConfigUpdate({ minRedemption: 5000 }, current).error, "min above max is rejected");
});
