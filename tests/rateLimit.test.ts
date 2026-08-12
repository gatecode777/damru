import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../lib/rateLimit";
import RateLimit from "../models/RateLimit";

/**
 * Regression coverage for the Phase 6 rate limiter: requests at or under the
 * limit are allowed, the next one is blocked, and a different key gets its
 * own independent window.
 */
test("allows up to the limit, then blocks the next request in the same window", async () => {
  const key = `test-rate-limit:${Date.now()}:${Math.random()}`;
  // Use a day-long test window so a slow/shared CI database cannot cross the
  // fixed-window boundary between these four sequential assertions.
  const opts = { limit: 3, windowSeconds: 86400 };

  try {
    const r1 = await checkRateLimit(key, opts);
    const r2 = await checkRateLimit(key, opts);
    const r3 = await checkRateLimit(key, opts);
    const r4 = await checkRateLimit(key, opts);

    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r3.allowed, true);
    assert.equal(r4.allowed, false, "the 4th request should exceed a limit of 3");
    assert.ok(r4.retryAfterSeconds > 0);
  } finally {
    await RateLimit.deleteMany({ key: { $regex: `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:` } });
  }
});

test("different keys get independent windows", async () => {
  const keyA = `test-rate-limit-a:${Date.now()}:${Math.random()}`;
  const keyB = `test-rate-limit-b:${Date.now()}:${Math.random()}`;
  const opts = { limit: 1, windowSeconds: 86400 };

  try {
    const a1 = await checkRateLimit(keyA, opts);
    const b1 = await checkRateLimit(keyB, opts);

    assert.equal(a1.allowed, true);
    assert.equal(b1.allowed, true, "a separate key must not share the other key's counter");
  } finally {
    await RateLimit.deleteMany({
      key: {
        $regex: `^(${keyA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${keyB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}):`,
      },
    });
  }
});
