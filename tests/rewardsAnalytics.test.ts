import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLiability, maskEmail, percentage, REWARD_ISSUE_CATEGORIES, resolveAnalyticsRange } from "../lib/rewards/analytics";

test("issued categories exclude restoration, expiry, redemption and legacy balances", () => {
  assert.equal(REWARD_ISSUE_CATEGORIES.includes("order_reward"), true);
  assert.equal((REWARD_ISSUE_CATEGORIES as readonly string[]).includes("refund_restore"), false);
  assert.equal((REWARD_ISSUE_CATEGORIES as readonly string[]).includes("legacy_opening_balance"), false);
});

test("liability uses configured rupees per Damru", () => {
  assert.equal(calculateLiability(600, 0.1), 60);
  assert.equal(calculateLiability(-10, 0.1), 0);
});

test("rates are safe when the denominator is zero", () => {
  assert.equal(percentage(10, 0), 0);
  assert.equal(percentage(30, 100), 30);
});

test("today range follows Asia/Kolkata boundaries", () => {
  const range = resolveAnalyticsRange({ preset: "today" }, new Date("2026-08-10T18:45:00.000Z"));
  assert.equal(range.start.toISOString(), "2026-08-10T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-08-10T18:45:00.000Z");
});

test("custom range is inclusive and rejects inversions", () => {
  const range = resolveAnalyticsRange({ preset: "custom", start: "2026-08-01", end: "2026-08-10" });
  assert.equal(range.start.toISOString(), "2026-07-31T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-08-10T18:29:59.999Z");
  assert.throws(() => resolveAnalyticsRange({ preset: "custom", start: "2026-08-10", end: "2026-08-01" }), /before/);
});

test("admin-facing email is masked", () => assert.equal(maskEmail("testcustomer@example.com"), "te*****@example.com"));
