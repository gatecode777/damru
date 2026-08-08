import "dotenv/config";
import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import { evaluateLoyaltyTier } from "../lib/loyaltyEngine";

async function main() {
  await connectDB(); let processed = 0; let changed = 0;
  for await (const user of User.find().select("_id").cursor()) {
    const result = await evaluateLoyaltyTier(user._id, { issueBonus: false });
    processed++; if (result.changed) changed++;
  }
  console.log(`Loyalty reconciliation complete. Processed: ${processed}; changed: ${changed}. No bonuses issued.`);
  process.exit(0);
}
main().catch(err => { console.error("Loyalty reconciliation failed:", err instanceof Error ? err.message : "Unknown error"); process.exit(1); });
