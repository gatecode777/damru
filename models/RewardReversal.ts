import mongoose, { Document, Model, Schema } from "mongoose";

export const REWARD_REVERSAL_REASONS = [
  "ORDER_CANCELLED",
  "FULL_REFUND",
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
  walletAmount: number;
  debtAmount: number;
  reason: RewardReversalReason;
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
    originalTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", required: true, unique: true },
    reversalTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    refundId: { type: Schema.Types.ObjectId, ref: "PaymentRefund" },
    amount: { type: Number, required: true, min: 0 },
    walletAmount: { type: Number, required: true, default: 0, min: 0 },
    debtAmount: { type: Number, required: true, default: 0, min: 0 },
    reason: { type: String, enum: REWARD_REVERSAL_REASONS, required: true },
    note: { type: String, maxlength: 500 },
    status: { type: String, enum: ["RESERVED", "APPLIED", "FAILED"], required: true, default: "RESERVED" },
    idempotencyKey: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    failureReason: { type: String },
  },
  { timestamps: true }
);

RewardReversalSchema.index({ orderId: 1, createdAt: -1 }, { sparse: true });
RewardReversalSchema.index({ refundId: 1, createdAt: -1 }, { sparse: true });
RewardReversalSchema.index({ userId: 1, createdAt: -1 });

const RewardReversal: Model<IRewardReversal> =
  mongoose.models.RewardReversal || mongoose.model<IRewardReversal>("RewardReversal", RewardReversalSchema);

export default RewardReversal;
