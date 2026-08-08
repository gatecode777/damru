import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { istDateParts } from "../lib/rewardEngine";

/**
 * Regression coverage for the Phase 1 reward timezone policy: occasion
 * rewards (birthday/anniversary) are matched against Asia/Kolkata calendar
 * dates, not UTC or server-local time. These are exactly the midnight
 * boundary cases where UTC and IST disagree on "what day it is".
 */
test("23:31 UTC on Mar 31 is already Apr 1 in IST (UTC+5:30)", () => {
  // 23:31 UTC + 5:30 = 05:01 the next day in IST.
  const date = new Date("2026-03-31T23:31:00.000Z");
  const parts = istDateParts(date);
  assert.deepEqual(parts, { year: 2026, month: 4, day: 1 });
});

test("18:29 UTC on Mar 31 is still Mar 31 in IST", () => {
  // 18:29 UTC + 5:30 = 23:59 the same day in IST.
  const date = new Date("2026-03-31T18:29:00.000Z");
  const parts = istDateParts(date);
  assert.deepEqual(parts, { year: 2026, month: 3, day: 31 });
});

test("IST year boundary: Dec 31 18:30 UTC becomes Jan 1 in IST", () => {
  const date = new Date("2025-12-31T18:30:00.000Z");
  const parts = istDateParts(date);
  assert.deepEqual(parts, { year: 2026, month: 1, day: 1 });
});
