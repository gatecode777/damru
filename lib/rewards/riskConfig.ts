import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import RewardRiskConfig from "@/models/RewardRiskConfig";

export const DEFAULT_REWARD_RISK_CONFIG = {
  scoring: { medium: 30, high: 60, critical: 80 },
  earningVelocity: {
    windowHours: 24,
    minimumTotalDamru: 5_000,
    minimumTransactionCount: 10,
    promotionalDamru: 3_000,
  },
  redemptionVelocity: {
    windowHours: 1,
    minimumTotalDamru: 3_000,
    minimumTransactionCount: 3,
    recentPromotionalWindowHours: 2,
  },
  earnRedeemRefund: {
    windowDays: 30,
    minimumRefundCount: 2,
    minimumReversalCount: 2,
    minimumRedemptionAmount: 100,
  },
  refunds: {
    windowDays: 30,
    minimumOrderCount: 3,
    ratio: 0.5,
    minimumRefundedAmount: 1_000,
  },
  cancellations: {
    windowDays: 30,
    minimumOrderCount: 4,
    ratio: 0.6,
  },
  rewardDebt: {
    amount: 500,
    reversalCount30Days: 3,
  },
  reversals: {
    windowDays: 30,
    minimumCount: 3,
    minimumAmount: 500,
    minimumIssuedAmount: 500,
    issuedRatio: 0.5,
  },
  referrals: {
    windowDays: 7,
    createdCount: 10,
    qualifiedCount: 5,
  },
  campaigns: {
    windowHours: 24,
    usageCount: 8,
    rewardAmount: 5_000,
    reversalCount: 3,
  },
  missions: {
    windowHours: 24,
    completionCount: 5,
    rewardAmount: 2_500,
  },
  adminAdjustments: {
    windowHours: 24,
    perUserCount: 5,
    perUserAmount: 5_000,
    perAdminCount: 20,
  },
};

export type RewardRiskConfigValues = typeof DEFAULT_REWARD_RISK_CONFIG;

// Backwards-compatible export for callers that only need documented defaults.
export const REWARD_RISK_CONFIG = DEFAULT_REWARD_RISK_CONFIG;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mergeConfig(value: unknown): RewardRiskConfigValues {
  const root = asObject(value);
  const merged = structuredClone(DEFAULT_REWARD_RISK_CONFIG);
  for (const key of Object.keys(merged) as Array<keyof RewardRiskConfigValues>) {
    Object.assign(merged[key], asObject(root[key]));
  }
  return merged;
}

export async function getRewardRiskConfig(): Promise<RewardRiskConfigValues> {
  await connectDB();
  const document = await RewardRiskConfig.findOne({ key: "default" }).select("values").lean<{ values?: unknown }>();
  return mergeConfig(document?.values);
}

type NumericRule = { path: string; min: number; max: number; integer?: boolean };
const NUMERIC_RULES: NumericRule[] = [
  { path: "scoring.medium", min: 1, max: 98, integer: true }, { path: "scoring.high", min: 2, max: 99, integer: true }, { path: "scoring.critical", min: 3, max: 100, integer: true },
  { path: "earningVelocity.windowHours", min: 1, max: 720, integer: true }, { path: "earningVelocity.minimumTotalDamru", min: 1, max: 1_000_000 }, { path: "earningVelocity.minimumTransactionCount", min: 2, max: 10_000, integer: true }, { path: "earningVelocity.promotionalDamru", min: 1, max: 1_000_000 },
  { path: "redemptionVelocity.windowHours", min: 1, max: 168, integer: true }, { path: "redemptionVelocity.minimumTotalDamru", min: 1, max: 1_000_000 }, { path: "redemptionVelocity.minimumTransactionCount", min: 2, max: 10_000, integer: true }, { path: "redemptionVelocity.recentPromotionalWindowHours", min: 1, max: 720, integer: true },
  { path: "earnRedeemRefund.windowDays", min: 1, max: 365, integer: true }, { path: "earnRedeemRefund.minimumRefundCount", min: 2, max: 1_000, integer: true }, { path: "earnRedeemRefund.minimumReversalCount", min: 1, max: 1_000, integer: true }, { path: "earnRedeemRefund.minimumRedemptionAmount", min: 1, max: 1_000_000 },
  { path: "refunds.windowDays", min: 1, max: 365, integer: true }, { path: "refunds.minimumOrderCount", min: 2, max: 10_000, integer: true }, { path: "refunds.ratio", min: 0.01, max: 1 }, { path: "refunds.minimumRefundedAmount", min: 1, max: 10_000_000 },
  { path: "cancellations.windowDays", min: 1, max: 365, integer: true }, { path: "cancellations.minimumOrderCount", min: 2, max: 10_000, integer: true }, { path: "cancellations.ratio", min: 0.01, max: 1 },
  { path: "rewardDebt.amount", min: 1, max: 1_000_000 }, { path: "rewardDebt.reversalCount30Days", min: 1, max: 1_000, integer: true },
  { path: "reversals.windowDays", min: 1, max: 365, integer: true }, { path: "reversals.minimumCount", min: 1, max: 1_000, integer: true }, { path: "reversals.minimumAmount", min: 1, max: 1_000_000 }, { path: "reversals.minimumIssuedAmount", min: 1, max: 1_000_000 }, { path: "reversals.issuedRatio", min: 0.01, max: 1 },
  { path: "referrals.windowDays", min: 1, max: 365, integer: true }, { path: "referrals.createdCount", min: 2, max: 10_000, integer: true }, { path: "referrals.qualifiedCount", min: 2, max: 10_000, integer: true },
  { path: "campaigns.windowHours", min: 1, max: 720, integer: true }, { path: "campaigns.usageCount", min: 2, max: 10_000, integer: true }, { path: "campaigns.rewardAmount", min: 1, max: 1_000_000 }, { path: "campaigns.reversalCount", min: 1, max: 1_000, integer: true },
  { path: "missions.windowHours", min: 1, max: 720, integer: true }, { path: "missions.completionCount", min: 2, max: 10_000, integer: true }, { path: "missions.rewardAmount", min: 1, max: 1_000_000 },
  { path: "adminAdjustments.windowHours", min: 1, max: 720, integer: true }, { path: "adminAdjustments.perUserCount", min: 2, max: 10_000, integer: true }, { path: "adminAdjustments.perUserAmount", min: 1, max: 1_000_000 }, { path: "adminAdjustments.perAdminCount", min: 2, max: 10_000, integer: true },
];

function readPath(root: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => asObject(current)[key], root);
}

export function validateRewardRiskConfig(input: unknown): RewardRiskConfigValues {
  const root = asObject(input);
  const value = mergeConfig(root);
  for (const rule of NUMERIC_RULES) {
    const candidate = readPath(root, rule.path);
    if (candidate === undefined) continue;
    const number = Number(candidate);
    if (!Number.isFinite(number) || number < rule.min || number > rule.max || (rule.integer && !Number.isInteger(number))) {
      throw new Error(`${rule.path} must be ${rule.integer ? "a whole number" : "a number"} between ${rule.min} and ${rule.max}.`);
    }
    const [section, field] = rule.path.split(".") as [keyof RewardRiskConfigValues, string];
    (value[section] as unknown as Record<string, number>)[field] = number;
  }
  if (!(value.scoring.medium < value.scoring.high && value.scoring.high < value.scoring.critical)) {
    throw new Error("Risk score thresholds must be ordered: medium < high < critical.");
  }
  return value;
}

export async function saveRewardRiskConfig(input: unknown, updatedBy: string | mongoose.Types.ObjectId) {
  await connectDB();
  const values = validateRewardRiskConfig(input);
  return RewardRiskConfig.findOneAndUpdate(
    { key: "default" },
    { $set: { values, updatedBy }, $setOnInsert: { key: "default" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const PROMOTIONAL_REWARD_CATEGORIES = [
  "campaign",
  "referral",
  "mission",
  "achievement",
  "daily_login",
  "welcome_registration",
  "birthday",
  "marriage_anniversary",
  "account_anniversary",
] as const;
