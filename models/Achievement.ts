import mongoose, { Schema, Document, Model } from "mongoose";

export type AchievementCategory =
  | "SHOPPING"
  | "SPENDING"
  | "ENGAGEMENT"
  | "PROFILE"
  | "LOYALTY"
  | "REFERRAL"
  | "SPECIAL";

export type AchievementConditionType =
  | "ORDER_COUNT"
  | "LIFETIME_SPEND"
  | "LOGIN_STREAK"
  | "PROFILE_COMPLETE"
  | "ACCOUNT_AGE_DAYS";

export interface IAchievement extends Document {
  name: string;
  code: string;
  description: string;
  category: AchievementCategory;
  conditionType: AchievementConditionType;
  conditionValue: number;
  rewardDamruAmount: number;
  badgeName?: string;
  badgeIcon?: string;
  priority: number;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AchievementSchema = new Schema<IAchievement>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["SHOPPING", "SPENDING", "ENGAGEMENT", "PROFILE", "LOYALTY", "REFERRAL", "SPECIAL"],
      required: true,
    },
    conditionType: {
      type: String,
      enum: ["ORDER_COUNT", "LIFETIME_SPEND", "LOGIN_STREAK", "PROFILE_COMPLETE", "ACCOUNT_AGE_DAYS"],
      required: true,
    },
    conditionValue: { type: Number, required: true, min: 1 },
    rewardDamruAmount: { type: Number, default: 0, min: 0 },
    badgeName: { type: String },
    badgeIcon: { type: String },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AchievementSchema.index({ isActive: 1, conditionType: 1 });

const Achievement: Model<IAchievement> =
  mongoose.models.Achievement || mongoose.model<IAchievement>("Achievement", AchievementSchema);

export default Achievement;
