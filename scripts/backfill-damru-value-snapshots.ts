/**
 * One-time backfill for ledger rows written before value snapshots existed.
 *
 * 1. Every DamruTransaction without `valuePaise` gets `paisePerDamru` +
 *    `valuePaise` at the CURRENT configured rate. Run this BEFORE changing the
 *    Damru value in admin, so history is recorded at the rate it was earned at.
 * 2. Every legacy `order_reward` credit without a `ruleSnapshot` gets the rule
 *    that was hard-coded when it was issued (₹10 of eligible spend per Damru),
 *    so a later partial refund recomputes it exactly as before.
 *
 * Never touches balances, amounts, lots or reversals. Idempotent.
 *
 * Usage:
 *   npx tsx scripts/backfill-damru-value-snapshots.ts          # dry run (counts only)
 *   npx tsx scripts/backfill-damru-value-snapshots.ts --apply  # write
 */
import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

// The base order rule that was hard-coded (lib/rewardEngine.ts) before the
// earn rate became configurable. Only ever written into LEGACY snapshots.
const LEGACY_BASE_RUPEES_PER_DAMRU = 10;

async function main() {
  const apply = process.argv.includes("--apply");
  const { connectDB } = await import("../lib/mongodb");
  const { getDamruConfig } = await import("../lib/getDamruConfig");
  const { default: DamruTransaction } = await import("../models/DamruTransaction");
  await connectDB();

  const { paisePerDamru } = await getDamruConfig();
  const missingValue = { valuePaise: { $exists: false } };
  const legacyBase = { category: "order_reward", ruleSnapshot: { $exists: false } };
  const [valueCount, baseCount] = await Promise.all([
    DamruTransaction.countDocuments(missingValue),
    DamruTransaction.countDocuments(legacyBase),
  ]);
  console.log(`Current rate: ${paisePerDamru} paise per Damru (${100 / paisePerDamru} Damru = ₹1).`);
  console.log(`Rows without a value snapshot: ${valueCount}`);
  console.log(`Legacy order rewards without a rule snapshot: ${baseCount}`);

  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to backfill.");
  } else {
    const values = await DamruTransaction.updateMany(
      missingValue,
      [{ $set: { paisePerDamru, valuePaise: { $multiply: ["$amount", paisePerDamru] } } }],
      { updatePipeline: true }
    );
    const snapshots = await DamruTransaction.updateMany(legacyBase, {
      $set: { ruleSnapshot: { kind: "BASE", rupeesPerDamru: LEGACY_BASE_RUPEES_PER_DAMRU, rounding: "FLOOR", legacy: true } },
    });
    console.log(`Value snapshots written: ${values.modifiedCount}`);
    console.log(`Legacy rule snapshots written: ${snapshots.modifiedCount}`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Damru value-snapshot backfill failed:", err instanceof Error ? err.message : "Unknown error");
  process.exit(1);
});
