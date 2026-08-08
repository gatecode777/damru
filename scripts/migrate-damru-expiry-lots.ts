import "dotenv/config";
import { connectDB } from "../lib/mongodb";
import mongoose from "mongoose";
import { runMigration } from "../lib/rewards/damruMigration";
import { reconcileDamruLots } from "../lib/rewards/damruAllocation";

// Usage: npx tsx scripts/migrate-damru-expiry-lots.ts [--dry-run]
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  const summary = await runMigration({ dryRun });
  console.log(`Damru expiry-lot migration ${dryRun ? "(DRY RUN) " : ""}complete.`);
  console.log(`Users checked: ${summary.usersChecked}`);
  console.log(`Users migrated${dryRun ? " (would migrate)" : ""}: ${summary.usersMigrated}`);
  console.log(`Users already covered: ${summary.usersAlreadyCovered}`);
  console.log(`Users with zero balance: ${summary.usersZeroBalance}`);
  console.log(`Total legacy Damru backfilled${dryRun ? " (projected)" : ""}: ${summary.totalShortfallDamru}`);

  if (!dryRun) {
    const reconciliation = await reconcileDamruLots();
    console.log(`Post-migration reconciliation — users checked: ${reconciliation.checked}, mismatches: ${reconciliation.mismatches.length}`);
    if (reconciliation.mismatches.length > 0) {
      console.error("Wallet/lot mismatches remain after migration — investigate before enabling expiry.");
    }
  }

  await mongoose.connection.close();
  process.exit(0);
}
main().catch(err => { console.error("Damru expiry-lot migration failed:", err instanceof Error ? err.message : "Unknown error"); process.exit(1); });
