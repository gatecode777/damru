import mongoose, { Schema, Document, Model } from "mongoose";

export type EarnRuleType = "ITEM" | "CATEGORY" | "ORDER_VALUE_TIER";
export type EarnRuleStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
/** ITEM/CATEGORY: how `damruPerUnit` scales with the order lines it matches. */
export type EarnRuleBasis = "PER_UNIT" | "PER_LINE" | "PER_ORDER";
/**
 * ORDER_VALUE_TIER:
 * - HIGHEST_MATCH: the single highest tier reached.
 * - CUMULATIVE:    the sum of every tier reached.
 * - SLAB:          each tier's `damru` is earned per ₹100 of spend inside its band
 *                  (band = its minAmount up to the next tier's minAmount).
 */
export type EarnTierMode = "HIGHEST_MATCH" | "CUMULATIVE" | "SLAB";
/** ORDER_VALUE_TIER: whether a matched tier adds to, or replaces, the base per-₹ order reward. */
export type BaseRewardBehavior = "ADD" | "REPLACE";

export const EARN_RULE_TYPES: readonly EarnRuleType[] = ["ITEM", "CATEGORY", "ORDER_VALUE_TIER"];
export const EARN_RULE_STATUSES: readonly EarnRuleStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];
export const EARN_RULE_BASES: readonly EarnRuleBasis[] = ["PER_UNIT", "PER_LINE", "PER_ORDER"];
/**
 * Business default for a dish reward when the admin doesn't choose a basis:
 * every unit earns it (Biryani = 50 → qty 2 earns 100).
 */
export const DEFAULT_ITEM_REWARD_BASIS: EarnRuleBasis = "PER_UNIT";
export const EARN_TIER_MODES: readonly EarnTierMode[] = ["HIGHEST_MATCH", "CUMULATIVE", "SLAB"];
export const BASE_REWARD_BEHAVIORS: readonly BaseRewardBehavior[] = ["ADD", "REPLACE"];

export interface IEarnTier {
  /** Whole rupees of eligible spend (subtotal − coupon) needed to reach this tier. */
  minAmount: number;
  damru: number;
}

export interface IEarnRule extends Document {
  name: string;
  code: string;
  description: string;
  ruleType: EarnRuleType;
  status: EarnRuleStatus;
  menuItemIds: mongoose.Types.ObjectId[];
  categoryIds: mongoose.Types.ObjectId[];
  /** Empty = every branch. */
  branchIds: mongoose.Types.ObjectId[];
  basis?: EarnRuleBasis | null;
  damruPerUnit: number;
  tiers: IEarnTier[];
  tierMode?: EarnTierMode | null;
  baseRewardBehavior?: BaseRewardBehavior | null;
  maxDamruPerOrder: number | null;
  /** Whether campaign multipliers/percent bonuses also apply to this rule's Damru. */
  includeInCampaignBase: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Incremented on every edit and copied into each credit's ruleSnapshot. */
  version: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wholeNumber = { validator: Number.isInteger, message: "{PATH} must be a whole number." };

const EarnTierSchema = new Schema<IEarnTier>(
  {
    minAmount: { type: Number, required: true, min: 1, validate: wholeNumber },
    damru: { type: Number, required: true, min: 0, validate: wholeNumber },
  },
  { _id: false }
);

const EarnRuleSchema = new Schema<IEarnRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 500 },
    ruleType: { type: String, enum: EARN_RULE_TYPES, required: true },
    status: { type: String, enum: EARN_RULE_STATUSES, default: "DRAFT" },
    menuItemIds: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    branchIds: [{ type: Schema.Types.ObjectId, ref: "Branch" }],
    basis: { type: String, enum: [...EARN_RULE_BASES, null], default: null },
    damruPerUnit: { type: Number, default: 0, min: 0, validate: wholeNumber },
    tiers: { type: [EarnTierSchema], default: [] },
    tierMode: { type: String, enum: [...EARN_TIER_MODES, null], default: null },
    baseRewardBehavior: { type: String, enum: [...BASE_REWARD_BEHAVIORS, null], default: null },
    maxDamruPerOrder: { type: Number, default: null, min: 1, validate: { validator: (v: number | null) => v === null || Number.isInteger(v), message: "maxDamruPerOrder must be a whole number." } },
    includeInCampaignBase: { type: Boolean, default: false },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    version: { type: Number, default: 1, min: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

EarnRuleSchema.index({ status: 1, ruleType: 1 });
EarnRuleSchema.index({ menuItemIds: 1, status: 1 });
EarnRuleSchema.index({ categoryIds: 1, status: 1 });

const EarnRule: Model<IEarnRule> =
  mongoose.models.EarnRule || mongoose.model<IEarnRule>("EarnRule", EarnRuleSchema);

export default EarnRule;
