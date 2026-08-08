import mongoose, { Document, Model, Schema } from "mongoose";

export type LoyaltyQualificationType = "LIFETIME_SPEND" | "COMPLETED_ORDERS" | "DAMRU_EARNED";

export interface ILoyaltyTier extends Document {
  name: string; code: string; rank: number; qualificationType: LoyaltyQualificationType;
  minimumValue: number; maximumValue: number | null; damruMultiplier: number;
  benefits: string[]; badgeName?: string; badgeIcon?: string; tierBonusDamru: number;
  isActive: boolean; createdAt: Date; updatedAt: Date;
}

const LoyaltyTierSchema = new Schema<ILoyaltyTier>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  rank: { type: Number, required: true, min: 0, unique: true },
  qualificationType: { type: String, enum: ["LIFETIME_SPEND", "COMPLETED_ORDERS", "DAMRU_EARNED"], required: true },
  minimumValue: { type: Number, required: true, min: 0 },
  maximumValue: { type: Number, default: null, min: 0 },
  damruMultiplier: { type: Number, required: true, default: 1, min: 1 },
  benefits: { type: [String], default: [] },
  badgeName: { type: String, trim: true }, badgeIcon: { type: String, trim: true },
  tierBonusDamru: { type: Number, default: 0, min: 0 }, isActive: { type: Boolean, default: true },
}, { timestamps: true });

LoyaltyTierSchema.pre("validate", function () {
  if (this.maximumValue !== null && this.maximumValue <= this.minimumValue) {
    this.invalidate("maximumValue", "Maximum value must be greater than minimum value.");
  }
});

const LoyaltyTier: Model<ILoyaltyTier> = mongoose.models.LoyaltyTier || mongoose.model<ILoyaltyTier>("LoyaltyTier", LoyaltyTierSchema);
export default LoyaltyTier;
