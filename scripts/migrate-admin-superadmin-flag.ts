import "dotenv/config";
import { connectDB } from "../lib/mongodb";
import Admin from "../models/Admin";

/**
 * Makes the existing "admin" role's full-access bypass explicit and stored,
 * instead of implicit-via-undefined. Rerunnable and safe: only touches
 * role:"admin" accounts that have never had isSuperAdmin set, and only ever
 * sets it to true — it never revokes access. See docs/PRODUCTION_READINESS.md
 * (Authorization Model) for why this exists.
 *
 * Not required for safety before deploying the isSuperAdmin check itself —
 * checkApiPerm/getAdminPerms already treat an unset flag on an "admin"-role
 * account as full access — but running this makes every account's access
 * level an explicit, auditable stored value rather than relying on that
 * backward-compatibility default indefinitely.
 */
async function main() {
  await connectDB();
  const result = await Admin.updateMany(
    { role: "admin", isSuperAdmin: { $exists: false } },
    { $set: { isSuperAdmin: true } }
  );
  console.log(`Admin isSuperAdmin backfill complete. Matched: ${result.matchedCount}; modified: ${result.modifiedCount}.`);
  process.exit(0);
}
main().catch(err => { console.error("Admin isSuperAdmin backfill failed:", err instanceof Error ? err.message : "Unknown error"); process.exit(1); });
