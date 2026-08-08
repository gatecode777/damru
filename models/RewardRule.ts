import mongoose, { Schema, Document, Model } from "mongoose";

export type RewardRuleCategory =
  | "welcome_registration"
  | "birthday"
  | "marriage_anniversary"
  | "account_anniversary"
  | "first_order";

export type CouponTemplateType = "flat" | "percentage";

export interface ICouponTemplate {
  type: CouponTemplateType;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
}

export interface IRewardRule extends Document {
  category: RewardRuleCategory;
  label: string;
  description: string;
  isActive: boolean;
  amount: number;
  validForDays: number | null;
  couponTemplate?: ICouponTemplate;
  createdAt: Date;
  updatedAt: Date;
}

const CouponTemplateSchema = new Schema<ICouponTemplate>(
  {
    type: { type: String, enum: ["flat", "percentage"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: null },
    minOrderValue: { type: Number, default: 0 },
  },
  { _id: false }
);

const RewardRuleSchema = new Schema<IRewardRule>(
  {
    category: {
      type: String,
      enum: ["welcome_registration", "birthday", "marriage_anniversary", "account_anniversary", "first_order"],
      required: true,
      unique: true,
    },
    label: { type: String, required: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    amount: { type: Number, default: 0, min: 0 },
    validForDays: { type: Number, default: null },
    couponTemplate: { type: CouponTemplateSchema, default: undefined },
  },
  { timestamps: true }
);

const RewardRule: Model<IRewardRule> =
  mongoose.models.RewardRule || mongoose.model<IRewardRule>("RewardRule", RewardRuleSchema);

export default RewardRule;
