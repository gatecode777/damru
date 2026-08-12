import mongoose, { Schema, Document, Model } from "mongoose";

export type DamruTransactionType = "credit" | "debit";
export type DamruTransactionCategory =
  | "welcome_registration"
  | "birthday"
  | "marriage_anniversary"
  | "account_anniversary"
  | "first_order"
  | "daily_login"
  | "achievement"
  | "mission"
  | "referral"
  | "order_reward"
  | "loyalty_tier"
  | "redemption"
  | "admin_credit"
  | "admin_debit"
  | "refund_restore"
  | "expiry"
  | "legacy_opening_balance"
  | "campaign"
  | "reward_reversal"
  | "reward_debt_recovery";

export interface IDamruAllocation {
  creditTransactionId: mongoose.Types.ObjectId;
  amount: number;
}

export interface IDamruTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: DamruTransactionType;
  category: DamruTransactionCategory;
  amount: number;
  balanceAfter: number;
  description: string;
  idempotencyKey: string;
  ruleId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  couponId?: mongoose.Types.ObjectId;
  adjustedBy?: mongoose.Types.ObjectId;
  adjustmentReason?: string;
  campaignId?: mongoose.Types.ObjectId;
  campaignCode?: string;
  campaignSnapshot?: Record<string, unknown>;
  originalTransactionId?: mongoose.Types.ObjectId;
  originalCategory?: string;
  sourceType?: string;
  sourceId?: string;
  refundId?: mongoose.Types.ObjectId;
  reversalReason?: string;
  reversalNote?: string;
  // Expiry "lot" fields — only ever set on credit transactions that are subject to
  // expiry policy (see lib/rewards/damruAllocation.ts). Absent (not merely null) on
  // every transaction created before this feature shipped and on non-expiring
  // credits, which is intentional: `remainingAmount > 0` queries used for FEFO
  // allocation and the expiry cron naturally skip fields that don't exist, so
  // pre-migration history is invisible to both until the migration backfills it.
  expiresAt?: Date | null;
  originalAmount?: number;
  remainingAmount?: number;
  expiredAmount?: number;
  expiryProcessedAt?: Date | null;
  // Only ever set on debit transactions (redemption, admin_debit, expiry) — records
  // exactly which credit lot(s) this debit consumed, and how much of each.
  allocations?: IDamruAllocation[];
  createdAt: Date;
  updatedAt: Date;
}

const DamruTransactionSchema = new Schema<IDamruTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    category: {
      type: String,
      enum: [
        "welcome_registration",
        "birthday",
        "marriage_anniversary",
        "account_anniversary",
        "first_order",
        "daily_login",
        "achievement",
        "mission",
        "referral",
        "order_reward",
        "loyalty_tier",
        "redemption",
        "admin_credit",
        "admin_debit",
        "refund_restore",
        "expiry",
        "legacy_opening_balance",
        "campaign",
        "reward_reversal",
        "reward_debt_recovery",
      ],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: "" },
    idempotencyKey: { type: String, required: true, unique: true },
    ruleId: { type: Schema.Types.ObjectId, ref: "RewardRule" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
    adjustedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    adjustmentReason: { type: String },
    campaignId: { type: Schema.Types.ObjectId, ref: "RewardCampaign" },
    campaignCode: { type: String },
    campaignSnapshot: { type: Schema.Types.Mixed },
    originalTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction" },
    originalCategory: { type: String },
    sourceType: { type: String },
    sourceId: { type: String },
    refundId: { type: Schema.Types.ObjectId, ref: "PaymentRefund" },
    reversalReason: { type: String },
    reversalNote: { type: String },
    expiresAt: { type: Date, default: undefined },
    originalAmount: { type: Number, default: undefined },
    remainingAmount: { type: Number, default: undefined },
    expiredAmount: { type: Number, default: undefined },
    expiryProcessedAt: { type: Date, default: undefined },
    allocations: {
      type: [{ creditTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction" }, amount: Number }],
      default: undefined,
      _id: false,
    },
  },
  { timestamps: true }
);

DamruTransactionSchema.index({ userId: 1, createdAt: -1 });
DamruTransactionSchema.index({ orderId: 1, type: 1, category: 1 });
DamruTransactionSchema.index({ originalTransactionId: 1 }, { sparse: true });
DamruTransactionSchema.index({ adjustedBy: 1, createdAt: -1 }, { sparse: true });
// Bounded admin analytics scans filter by time before grouping by category.
DamruTransactionSchema.index({ createdAt: -1, type: 1, category: 1 });
// FEFO allocator's per-user lot lookup (redemption, admin debit). Sparse because
// only lot-tracked credits (post-migration / post-deploy) carry remainingAmount —
// legacy history is deliberately excluded from this index.
DamruTransactionSchema.index({ userId: 1, remainingAmount: 1 }, { sparse: true });
// Expiry cron's cross-user batch scan for due lots.
DamruTransactionSchema.index({ expiresAt: 1, remainingAmount: 1 }, { sparse: true });

const DamruTransaction: Model<IDamruTransaction> =
  mongoose.models.DamruTransaction ||
  mongoose.model<IDamruTransaction>("DamruTransaction", DamruTransactionSchema);

export default DamruTransaction;
