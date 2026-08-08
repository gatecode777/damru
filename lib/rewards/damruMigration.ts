import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import DamruTransaction from "@/models/DamruTransaction";

/**
 * Legacy-balance migration for PRD 4A (Damru Expiry). Backfills a synthetic
 * "Legacy Opening Balance" lot for whatever portion of a user's existing
 * damruBalance is NOT already covered by a tracked lot (remainingAmount set) —
 * i.e. Damru earned before this feature shipped, which has no reconstructable
 * FIFO history and is deliberately NOT guessed at (see docs/DAMRU_EXPIRY_SYSTEM.md).
 *
 * Critical invariants:
 *  - Never touches User.damruBalance/damruTotalEarned/damruTotalRedeemed — the
 *    wallet already reflects this value; the migration only backs it with lot
 *    metadata so it becomes spendable/expirable through the normal allocator.
 *  - The legacy lot NEVER expires (expiresAt: null) — assigning a fabricated
 *    expiry date to Damru whose actual earn date is unknown would be exactly
 *    the kind of guess section 8 of the PRD forbids.
 *  - Idempotent: a deterministic idempotencyKey per user means rerunning after
 *    a partial failure, or after new lots have been created in the meantime,
 *    only ever tops up the remaining shortfall — never creates a duplicate.
 */

export interface MigrateUserResult {
  userId: string;
  action: "migrated" | "already_covered" | "zero_balance" | "would_migrate";
  shortfall: number;
}

async function trackedLotSum(userId: mongoose.Types.ObjectId): Promise<number> {
  const [agg] = await DamruTransaction.aggregate([
    { $match: { userId, type: "credit", remainingAmount: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
  ]);
  return agg?.total || 0;
}

/** Migrates a single user. Safe to call multiple times — see module docs. */
export async function migrateUser(
  userId: mongoose.Types.ObjectId,
  damruBalance: number,
  opts: { dryRun: boolean }
): Promise<MigrateUserResult> {
  await connectDB();
  if (damruBalance <= 0) return { userId: String(userId), action: "zero_balance", shortfall: 0 };

  const lotSum = await trackedLotSum(userId);
  const shortfall = damruBalance - lotSum;
  if (shortfall <= 0) return { userId: String(userId), action: "already_covered", shortfall: 0 };

  if (opts.dryRun) return { userId: String(userId), action: "would_migrate", shortfall };

  const idempotencyKey = `legacy-opening-balance:${userId}`;
  try {
    await DamruTransaction.create({
      userId,
      type: "credit",
      category: "legacy_opening_balance",
      amount: shortfall,
      balanceAfter: damruBalance,
      description: "Legacy Opening Balance",
      idempotencyKey,
      originalAmount: shortfall,
      remainingAmount: shortfall,
      expiresAt: null,
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      // Already migrated by a prior run (possibly concurrent) — safe no-op.
      return { userId: String(userId), action: "already_covered", shortfall: 0 };
    }
    throw err;
  }

  return { userId: String(userId), action: "migrated", shortfall };
}

export interface MigrationSummary {
  dryRun: boolean;
  usersChecked: number;
  usersMigrated: number;
  usersAlreadyCovered: number;
  usersZeroBalance: number;
  totalShortfallDamru: number;
}

/** Iterates every user via cursor (bounded memory, no PII in return value — counts and totals only). */
export async function runMigration(opts: { dryRun: boolean }): Promise<MigrationSummary> {
  await connectDB();
  const summary: MigrationSummary = {
    dryRun: opts.dryRun,
    usersChecked: 0,
    usersMigrated: 0,
    usersAlreadyCovered: 0,
    usersZeroBalance: 0,
    totalShortfallDamru: 0,
  };

  for await (const user of User.find().select("_id damruBalance").cursor()) {
    summary.usersChecked++;
    const result = await migrateUser(user._id, user.damruBalance, opts);
    if (result.action === "migrated" || result.action === "would_migrate") {
      summary.usersMigrated++;
      summary.totalShortfallDamru += result.shortfall;
    } else if (result.action === "already_covered") {
      summary.usersAlreadyCovered++;
    } else {
      summary.usersZeroBalance++;
    }
  }

  return summary;
}
