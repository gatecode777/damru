import { connectDB } from "@/lib/mongodb";
import DamruConfig, { IDamruConfig } from "@/models/DamruConfig";

export type DamruConfigValues = {
  redemptionRate: number;
  minRedemption: number;
  maxRedemptionPerOrder: number;
  dailyEarnLimit: number | null;
  expiryEnabled: boolean;
  expiryDays: number | null;
  expiryWarningDays: number;
  loyaltyThresholds: { silver: number; gold: number; platinum: number };
};

const DEFAULTS: DamruConfigValues = {
  redemptionRate: 0.1,
  minRedemption: 100,
  maxRedemptionPerOrder: 2000,
  dailyEarnLimit: null,
  expiryEnabled: false,
  expiryDays: null,
  expiryWarningDays: 30,
  loyaltyThresholds: { silver: 1000, gold: 5000, platinum: 10000 },
};

/** Fetch the singleton DamruConfig, creating it with defaults if it doesn't exist yet. */
export async function getDamruConfig(): Promise<DamruConfigValues> {
  await connectDB();
  const doc = await DamruConfig.findOne().lean<IDamruConfig>();
  if (!doc) return DEFAULTS;
  return {
    redemptionRate: doc.redemptionRate,
    minRedemption: doc.minRedemption,
    maxRedemptionPerOrder: doc.maxRedemptionPerOrder,
    dailyEarnLimit: doc.dailyEarnLimit,
    expiryEnabled: doc.expiryEnabled ?? false,
    expiryDays: doc.expiryDays,
    expiryWarningDays: doc.expiryWarningDays ?? 30,
    loyaltyThresholds: doc.loyaltyThresholds,
  };
}

export async function getOrCreateDamruConfig() {
  await connectDB();
  let doc = await DamruConfig.findOne();
  if (!doc) doc = await DamruConfig.create({});
  return doc;
}
