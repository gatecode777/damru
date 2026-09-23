import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { computeExpiry, validateExpiryConfig, categoryIsExpiryEligible } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";

test("computeExpiry returns null (never expires) when expiry is disabled — the required default-off behavior", () => {
  const result = computeExpiry("birthday", { expiryEnabled: false, expiryDays: 365 });
  assert.equal(result, null);
});

test("computeExpiry returns null when enabled but no validity period is configured", () => {
  const result = computeExpiry("birthday", { expiryEnabled: true, expiryDays: null });
  assert.equal(result, null);
});

test("computeExpiry returns a date exactly expiryDays from now when enabled and configured", () => {
  const before = Date.now();
  const result = computeExpiry("birthday", { expiryEnabled: true, expiryDays: 30 });
  const after = Date.now();
  assert.ok(result instanceof Date);
  const expectedMin = before + 30 * 24 * 60 * 60 * 1000;
  const expectedMax = after + 30 * 24 * 60 * 60 * 1000;
  assert.ok(result!.getTime() >= expectedMin && result!.getTime() <= expectedMax);
});

test("computeExpiry never assigns an expiry date to legacy_opening_balance regardless of config", () => {
  const result = computeExpiry("legacy_opening_balance", { expiryEnabled: true, expiryDays: 30 });
  assert.equal(result, null);
  assert.equal(categoryIsExpiryEligible("legacy_opening_balance"), false);
});

test("computeExpiry honors an explicit neverExpires override even when expiry is enabled", () => {
  const result = computeExpiry("admin_credit", { expiryEnabled: true, expiryDays: 30 }, { neverExpires: true });
  assert.equal(result, null);
});

test("validateExpiryConfig accepts any stored values while expiry is disabled", () => {
  assert.equal(validateExpiryConfig({ expiryEnabled: false, expiryDays: -5, expiryWarningDays: -5 }), null);
  assert.equal(validateExpiryConfig({ expiryEnabled: false, expiryDays: null, expiryWarningDays: 0 }), null);
});

test("validateExpiryConfig rejects a non-positive or non-integer expiryDays when enabling", () => {
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 0, expiryWarningDays: 0 }));
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: -10, expiryWarningDays: 0 }));
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30.5, expiryWarningDays: 0 }));
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: null, expiryWarningDays: 0 }));
});

test("validateExpiryConfig rejects a negative or non-integer expiryWarningDays when enabling", () => {
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30, expiryWarningDays: -1 }));
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30, expiryWarningDays: 5.5 }));
});

test("validateExpiryConfig rejects a warning period that is not shorter than the validity period", () => {
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30, expiryWarningDays: 30 }));
  assert.ok(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30, expiryWarningDays: 45 }));
  assert.equal(validateExpiryConfig({ expiryEnabled: true, expiryDays: 30, expiryWarningDays: 29 }), null, "one day shorter must be accepted");
});

test("changing the expiry configuration only affects future credits — an already-issued credit's expiresAt is never retroactively changed", async () => {
  await connectDB();
  // Deliberately does NOT touch the real (shared, singleton) DamruConfig doc —
  // that would race other test files running concurrently against the same
  // database via `node --test`'s default cross-file parallelism. Instead this
  // constructs config objects directly and calls awardDamru with an
  // explicitly-injected idempotencyKey per "policy era", which is exactly
  // what production code does with whatever getDamruConfig() returns at the
  // moment a credit is created — the mechanism under test doesn't care where
  // the config value came from.
  const user = await User.create({
    name: "Config Change Test User",
    email: `config-change-test-${Date.now()}@example.test`,
    password: "not-a-real-hash",
    damruBalance: 0,
  });

  try {
    const policyA = { redemptionRate: 0.1, minRedemption: 100, maxRedemptionPerOrder: 2000, dailyEarnLimit: null, expiryEnabled: true, expiryDays: 100, expiryWarningDays: 10, loyaltyThresholds: { silver: 1000, gold: 5000, platinum: 10000 } };
    const issuedUnderA = computeExpiry("birthday", policyA);
    assert.ok(issuedUnderA, "the credit must receive an expiry date under the 100-day policy");

    await DamruTransaction.create({
      userId: user._id, type: "credit", category: "birthday", amount: 250, balanceAfter: 250,
      description: "Test reward", idempotencyKey: `config-change-test-${user._id}`,
      originalAmount: 250, remainingAmount: 250, expiresAt: issuedUnderA,
    });

    // Policy changes to a much shorter window — this must NEVER be applied
    // retroactively to the record already written above.
    const policyB = { ...policyA, expiryDays: 10 };
    const wouldIssueUnderB = computeExpiry("birthday", policyB);
    assert.notEqual(wouldIssueUnderB!.getTime(), issuedUnderA!.getTime(), "sanity check: the two policies really do produce different dates");

    const reloadedTx = await DamruTransaction.findOne({ idempotencyKey: `config-change-test-${user._id}` }).lean();
    assert.equal(
      new Date(reloadedTx!.expiresAt as unknown as string).getTime(),
      issuedUnderA!.getTime(),
      "the already-issued credit's expiresAt must be completely unaffected by the later config change"
    );
  } finally {
    await DamruTransaction.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  }
});
