import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILoyaltyThresholds {
  silver: number;
  gold: number;
  platinum: number;
}

export interface IOrderEarnConfig {
  /** Rupees of eligible spend (subtotal − coupon) that earn one Damru. */
  rupeesPerDamru: number;
  rounding: "FLOOR";
  enabled: boolean;
}

export interface IDamruConfig extends Document {
  /**
   * The single source of truth for Damru's monetary value, in whole paise per
   * Damru. 10 → 10 Damru = ₹1. Every redemption, wallet ₹ display, liability
   * and analytics figure is derived from this via lib/rewards/damruValue.ts.
   */
  paisePerDamru: number;
  /** @deprecated Legacy float ₹-per-Damru. Read once to migrate into paisePerDamru; never used for money. */
  redemptionRate?: number;
  orderEarn: IOrderEarnConfig;
  minRedemption: number;
  maxRedemptionPerOrder: number;
  dailyEarnLimit: number | null;
  expiryEnabled: boolean;
  expiryDays: number | null;
  expiryWarningDays: number;
  loyaltyThresholds: ILoyaltyThresholds;
  updatedAt: Date;
}

const wholeNumber = { validator: Number.isInteger, message: "{PATH} must be a whole number." };

const LoyaltyThresholdsSchema = new Schema<ILoyaltyThresholds>(
  {
    silver: { type: Number, default: 1000 },
    gold: { type: Number, default: 5000 },
    platinum: { type: Number, default: 10000 },
  },
  { _id: false }
);

const OrderEarnSchema = new Schema<IOrderEarnConfig>(
  {
    rupeesPerDamru: { type: Number, default: 10, min: 1, validate: wholeNumber },
    rounding: { type: String, enum: ["FLOOR"], default: "FLOOR" },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const DamruConfigSchema = new Schema<IDamruConfig>(
  {
    // Business default: 10 Damru = ₹1 (1 Damru = 10 paise).
    paisePerDamru: { type: Number, default: 10, min: 1, max: 10000, validate: wholeNumber },
    redemptionRate: { type: Number },
    orderEarn: { type: OrderEarnSchema, default: () => ({}) },
    minRedemption: { type: Number, default: 100, min: 0, validate: wholeNumber },
    maxRedemptionPerOrder: { type: Number, default: 2000, min: 0, validate: wholeNumber },
    dailyEarnLimit: { type: Number, default: null, min: 1, validate: { validator: (v: number | null) => v === null || Number.isInteger(v), message: "dailyEarnLimit must be a whole number." } },
    // Recommended default is OFF — existing customers' Damru must never start
    // expiring just because this feature was deployed.
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
