import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import DamruConfig, { IDamruConfig } from "@/models/DamruConfig";

export type DamruConfigValues = {
  /** Whole paise per Damru — the single source of Damru's monetary value. */
  paisePerDamru: number;
  orderEarn: { rupeesPerDamru: number; rounding: "FLOOR"; enabled: boolean; dishRewardBaseBehavior: "ADD" | "REPLACE" };
  minRedemption: number;
  maxRedemptionPerOrder: number;
  dailyEarnLimit: number | null;
  expiryEnabled: boolean;
  expiryDays: number | null;
  expiryWarningDays: number;
  loyaltyThresholds: { silver: number; gold: number; platinum: number };
};

// Short per-instance cache. Admin saves call invalidateDamruConfigCache() so
// the instance that handled the save is immediately fresh; other serverless
// instances converge within this TTL.
const CACHE_TTL_MS = 30_000;
let cachedConfig: DamruConfigValues | null = null;
let cacheExpiry = 0;

export function invalidateDamruConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
}

/**
 * One-time migration from the legacy float `redemptionRate` (₹ per Damru) to
 * integer `paisePerDamru`. Preserves whatever value is live today when it is
 * a whole number of paise; otherwise the schema default applies. Idempotent —
 * the `$exists: false` guard means it only ever writes once.
 */
async function migrateLegacyRate(raw: Record<string, unknown>) {
  if (raw.paisePerDamru !== undefined && raw.paisePerDamru !== null) return;
  const legacy = typeof raw.redemptionRate === "number" ? raw.redemptionRate : null;
  const converted = legacy !== null ? Math.round(legacy * 100) : null;
  const exact = converted !== null && converted >= 1 && Math.abs(converted - legacy! * 100) < 1e-6;
  if (legacy !== null && !exact) {
    console.warn(`[DamruConfig] legacy redemptionRate ${legacy} is not a whole number of paise; using the schema default. Review the value in Admin → Rewards → Damru Configuration.`);
  }
  const paisePerDamru = exact ? converted : DamruConfig.schema.path("paisePerDamru").options.default;
  await DamruConfig.updateOne({ _id: raw._id as mongoose.Types.ObjectId, paisePerDamru: { $exists: false } }, { $set: { paisePerDamru } });
}

/** Returns the persisted singleton, creating it from schema defaults the first time. */
export async function getOrCreateDamruConfig() {
  await connectDB();
  const raw = await DamruConfig.collection.findOne({});
  if (!raw) return DamruConfig.create({});
  await migrateLegacyRate(raw as Record<string, unknown>);
  return (await DamruConfig.findById(raw._id))!;
}

export function toDamruConfigValues(doc: IDamruConfig): DamruConfigValues {
  return {
    paisePerDamru: doc.paisePerDamru,
    orderEarn: {
      rupeesPerDamru: doc.orderEarn.rupeesPerDamru,
      rounding: doc.orderEarn.rounding,
      enabled: doc.orderEarn.enabled,
      dishRewardBaseBehavior: doc.orderEarn.dishRewardBaseBehavior,
    },
    minRedemption: doc.minRedemption,
    maxRedemptionPerOrder: doc.maxRedemptionPerOrder,
    dailyEarnLimit: doc.dailyEarnLimit ?? null,
    expiryEnabled: doc.expiryEnabled ?? false,
    expiryDays: doc.expiryDays ?? null,
    expiryWarningDays: doc.expiryWarningDays,
    loyaltyThresholds: {
      silver: doc.loyaltyThresholds.silver,
      gold: doc.loyaltyThresholds.gold,
      platinum: doc.loyaltyThresholds.platinum,
    },
  };
}

/** Fetch the singleton DamruConfig (schema defaults are the only defaults). */
export async function getDamruConfig(): Promise<DamruConfigValues> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) return cachedConfig;

  const doc = await getOrCreateDamruConfig();
  const config = toDamruConfigValues(doc);
  cachedConfig = config;
  cacheExpiry = now + CACHE_TTL_MS;
  return config;
}
