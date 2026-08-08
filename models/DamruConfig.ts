import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILoyaltyThresholds {
  silver: number;
  gold: number;
  platinum: number;
}

export interface IDamruConfig extends Document {
  redemptionRate: number;
  minRedemption: number;
  maxRedemptionPerOrder: number;
  dailyEarnLimit: number | null;
  expiryEnabled: boolean;
  expiryDays: number | null;
  expiryWarningDays: number;
  loyaltyThresholds: ILoyaltyThresholds;
  updatedAt: Date;
}

const LoyaltyThresholdsSchema = new Schema<ILoyaltyThresholds>(
  {
    silver: { type: Number, default: 1000 },
    gold: { type: Number, default: 5000 },
    platinum: { type: Number, default: 10000 },
  },
  { _id: false }
);

const DamruConfigSchema = new Schema<IDamruConfig>(
  {
    redemptionRate: { type: Number, default: 0.1 },
    minRedemption: { type: Number, default: 100 },
    maxRedemptionPerOrder: { type: Number, default: 2000 },
    dailyEarnLimit: { type: Number, default: null },
    // Recommended default is OFF — existing customers' Damru must never start
    // expiring just because this feature was deployed (see docs/DAMRU_EXPIRY_SYSTEM.md).
    // An admin must deliberately opt in after reviewing the legacy-balance policy.
    expiryEnabled: { type: Boolean, default: false },
    expiryDays: { type: Number, default: null },
    expiryWarningDays: { type: Number, default: 30 },
    loyaltyThresholds: { type: LoyaltyThresholdsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const DamruConfig: Model<IDamruConfig> =
  mongoose.models.DamruConfig || mongoose.model<IDamruConfig>("DamruConfig", DamruConfigSchema);

export default DamruConfig;
