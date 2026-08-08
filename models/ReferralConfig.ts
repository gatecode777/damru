import mongoose, { Schema, Document, Model } from "mongoose";

export type ReferralQualificationEvent = "FIRST_DELIVERED_ORDER" | "FIRST_ELIGIBLE_ORDER";

export interface IReferralConfig extends Document {
  isActive: boolean;
  referrerRewardDamru: number;
  referredUserRewardDamru: number;
  qualificationEvent: ReferralQualificationEvent;
  minimumOrderAmount: number;
  rewardDelayDays: number;
  maximumSuccessfulReferralsPerUser: number | null;
  codePrefix: string;
  codeLength: number;
  requireEmailVerified: boolean;
  requireMobileVerified: boolean;
  allowExistingUserReferralCodeEntry: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  updatedAt: Date;
}

const ReferralConfigSchema = new Schema<IReferralConfig>(
  {
    isActive: { type: Boolean, default: true },
    referrerRewardDamru: { type: Number, default: 500, min: 0 },
    referredUserRewardDamru: { type: Number, default: 250, min: 0 },
    qualificationEvent: { type: String, enum: ["FIRST_DELIVERED_ORDER", "FIRST_ELIGIBLE_ORDER"], default: "FIRST_DELIVERED_ORDER" },
    minimumOrderAmount: { type: Number, default: 999, min: 0 },
    rewardDelayDays: { type: Number, default: 0, min: 0 },
    maximumSuccessfulReferralsPerUser: { type: Number, default: null },
    codePrefix: { type: String, default: "DAMRU" },
    codeLength: { type: Number, default: 6, min: 4, max: 10 },
    requireEmailVerified: { type: Boolean, default: false },
    requireMobileVerified: { type: Boolean, default: false },
    allowExistingUserReferralCodeEntry: { type: Boolean, default: false },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const ReferralConfig: Model<IReferralConfig> =
  mongoose.models.ReferralConfig || mongoose.model<IReferralConfig>("ReferralConfig", ReferralConfigSchema);

export default ReferralConfig;
