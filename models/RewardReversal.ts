import mongoose, { Document, Model, Schema } from "mongoose";

export const REWARD_REVERSAL_REASONS = [
  "ORDER_CANCELLED",
  "FULL_REFUND",
  "PARTIAL_REFUND",
  "PAYMENT_REVERSED",
  "FRAUD_CONFIRMED",
  "ADMIN_CORRECTION",
  "OTHER",
] as const;

export type RewardReversalReason = (typeof REWARD_REVERSAL_REASONS)[number];
export type RewardReversalStatus = "RESERVED" | "APPLIED" | "FAILED";

export interface IRewardReversal extends Document {
  userId: mongoose.Types.ObjectId;
  originalTransactionId: mongoose.Types.ObjectId;
  reversalTransactionId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  refundId?: mongoose.Types.ObjectId;
  amount: number;
  /** The portion of `amount` this specific reversal record accounts for.
   *  For full reversals this equals `amount`. For partial reversals it is
   *  the slice claimed by this particular refund event. Summing all APPLIED
   *  records for an originalTransactionId gives the total already reversed. */
  partialAmount: number;
  walletAmount: number;
  debtAmount: number;
  reason: RewardReversalReason;
  /** Stable identifier for the event that triggered this reversal — refundId
   *  string for PARTIAL_REFUND/FULL_REFUND, `cancel:{orderId}` for
   *  ORDER_CANCELLED, etc. Used as the compound-unique discriminator so each
   *  distinct triggering event can produce exactly one reversal per original
   *  transaction. */
  triggerId: string;
  note?: string;
  status: RewardReversalStatus;
  idempotencyKey: string;
  createdBy?: mongoose.Types.ObjectId;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RewardReversalSchema = new Schema<IRewardReversal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    originalTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", required: true },
    reversalTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    refundId: { type: Schema.Types.ObjectId, ref: "PaymentRefund" },
    amount: { type: Number, required: true, min: 0 },
    partialAmount: { type: Number, required: true, default: 0, min: 0 },
    walletAmount: { type: Number, required: true, default: 0, min: 0 },
    debtAmount: { type: Number, required: true, default: 0, min: 0 },
    reason: { type: String, enum: REWARD_REVERSAL_REASONS, required: true },
    triggerId: { type: String, required: true },
    note: { type: String, maxlength: 500 },
    status: { type: String, enum: ["RESERVED", "APPLIED", "FAILED"], required: true, default: "RESERVED" },
    idempotencyKey: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    failureReason: { type: String },
  },
  { timestamps: true }
);

// One reversal record per (original transaction, triggering event) — allows
// accumulating multiple partial reversals against the same credit without
// colliding. Full-reversal calls also use triggerId so they remain idempotent.
RewardReversalSchema.index({ originalTransactionId: 1, triggerId: 1 }, { unique: true });
RewardReversalSchema.index({ orderId: 1, createdAt: -1 }, { sparse: true });
RewardReversalSchema.index({ refundId: 1, createdAt: -1 }, { sparse: true });
RewardReversalSchema.index({ userId: 1, createdAt: -1 });
RewardReversalSchema.index({ userId: 1, status: 1 });
// Efficient sum of already-reversed amounts for a given original transaction.
RewardReversalSchema.index({ originalTransactionId: 1, status: 1 });

const RewardReversal: Model<IRewardReversal> =
  mongoose.models.RewardReversal || mongoose.model<IRewardReversal>("RewardReversal", RewardReversalSchema);

export default RewardReversal;
