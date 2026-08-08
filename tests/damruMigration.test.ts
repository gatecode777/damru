import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb";
import { migrateUser } from "../lib/rewards/damruMigration";
import { reconcileDamruLots } from "../lib/rewards/damruAllocation";
import User from "../models/User";
import DamruTransaction from "../models/DamruTransaction";

async function makeUser(damruBalance: number) {
  return User.create({
    name: "Migration Test User",
    email: `migration-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "not-a-real-hash",
    damruBalance,
  });
}

async function cleanup(userId: mongoose.Types.ObjectId) {
  await DamruTransaction.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

async function lotSum(userId: mongoose.Types.ObjectId): Promise<number> {
  const [agg] = await DamruTransaction.aggregate([
    { $match: { userId, type: "credit", remainingAmount: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
  ]);
  return agg?.total || 0;
}

test("a user with zero balance is skipped — no legacy lot is created", async () => {
  await connectDB();
  const user = await makeUser(0);
  try {
    const result = await migrateUser(user._id, 0, { dryRun: false });
    assert.equal(result.action, "zero_balance");
    const count = await DamruTransaction.countDocuments({ userId: user._id });
    assert.equal(count, 0);
  } finally {
    await cleanup(user._id);
  }
});

test("a user with a positive, entirely untracked balance gets a legacy opening-balance lot for the full amount", async () => {
  await connectDB();
  const user = await makeUser(1200);
  try {
    const result = await migrateUser(user._id, 1200, { dryRun: false });
    assert.equal(result.action, "migrated");
    assert.equal(result.shortfall, 1200);

    const lot = await DamruTransaction.findOne({ userId: user._id, category: "legacy_opening_balance" }).lean();
    assert.ok(lot);
    assert.equal(lot?.amount, 1200);
    assert.equal(lot?.originalAmount, 1200);
    assert.equal(lot?.remainingAmount, 1200);
    assert.equal(lot?.expiresAt ?? null, null, "legacy Damru must never be assigned a fabricated expiry date");

    // The migration must NEVER touch the wallet — it only backs an existing balance with lot metadata.
    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 1200, "balance must be unchanged by migration");

    assert.equal(await lotSum(user._id), 1200, "lot total must now equal the wallet balance");
  } finally {
    await cleanup(user._id);
  }
});

test("a user with mixed history — some already lot-tracked, some legacy — only gets a lot for the untracked shortfall", async () => {
  await connectDB();
  const user = await makeUser(1000);
  // 400 of the 1000 is already a real, lot-tracked credit (post-deploy, pre-migration timing).
  await DamruTransaction.create({
    userId: user._id, type: "credit", category: "welcome_registration", amount: 400, balanceAfter: 1000,
    description: "Already tracked", idempotencyKey: `mixed-history-tracked-${user._id}`,
    originalAmount: 400, remainingAmount: 400, expiresAt: null,
  });
  // The other 600 has no lot at all — genuinely legacy.
  try {
    const result = await migrateUser(user._id, 1000, { dryRun: false });
    assert.equal(result.action, "migrated");
    assert.equal(result.shortfall, 600, "only the untracked 600 should be backfilled, not the full 1000");

    assert.equal(await lotSum(user._id), 1000, "lot total must now equal the wallet balance");
  } finally {
    await cleanup(user._id);
  }
});

test("a user already fully covered by tracked lots is left alone", async () => {
  await connectDB();
  const user = await makeUser(500);
  await DamruTransaction.create({
    userId: user._id, type: "credit", category: "welcome_registration", amount: 500, balanceAfter: 500,
    description: "Already tracked", idempotencyKey: `fully-covered-${user._id}`,
    originalAmount: 500, remainingAmount: 500, expiresAt: null,
  });
  try {
    const result = await migrateUser(user._id, 500, { dryRun: false });
    assert.equal(result.action, "already_covered");
    const legacyCount = await DamruTransaction.countDocuments({ userId: user._id, category: "legacy_opening_balance" });
    assert.equal(legacyCount, 0);
  } finally {
    await cleanup(user._id);
  }
});

test("dry run reports what would happen without writing anything", async () => {
  await connectDB();
  const user = await makeUser(300);
  try {
    const result = await migrateUser(user._id, 300, { dryRun: true });
    assert.equal(result.action, "would_migrate");
    assert.equal(result.shortfall, 300);

    const count = await DamruTransaction.countDocuments({ userId: user._id });
    assert.equal(count, 0, "dry run must not create any documents");
  } finally {
    await cleanup(user._id);
  }
});

test("rerunning migration for an already-migrated user is a safe no-op — balance and lot total are preserved", async () => {
  await connectDB();
  const user = await makeUser(800);
  try {
    const first = await migrateUser(user._id, 800, { dryRun: false });
    assert.equal(first.action, "migrated");

    const second = await migrateUser(user._id, 800, { dryRun: false });
    assert.equal(second.action, "already_covered", "a rerun must not create a duplicate legacy lot");

    const legacyCount = await DamruTransaction.countDocuments({ userId: user._id, category: "legacy_opening_balance" });
    assert.equal(legacyCount, 1, "exactly one legacy lot must exist after any number of reruns");

    const reloadedUser = await User.findById(user._id).select("damruBalance").lean();
    assert.equal(reloadedUser?.damruBalance, 800, "balance must be unaffected by reruns");
    assert.equal(await lotSum(user._id), 800);
  } finally {
    await cleanup(user._id);
  }
});

test("reconcileDamruLots reports no mismatch for a migrated user", async () => {
  await connectDB();
  const user = await makeUser(650);
  try {
    await migrateUser(user._id, 650, { dryRun: false });
    const result = await reconcileDamruLots(user._id);
    assert.equal(result.mismatches.length, 0, "a migrated user's wallet and lot total must match exactly");
  } finally {
    await cleanup(user._id);
  }
});
