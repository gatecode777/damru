import mongoose, { Schema, Document, Model } from "mongoose";

export type ReferralStatus =
  | "REGISTERED"
  | "PENDING_QUALIFICATION"
  | "QUALIFIED"
  | "REWARDED"
  | "REJECTED"
  | "CANCELLED"
  | "INVALIDATED"
  | "REQUALIFIED";

export interface IReferral extends Document {
  referrerUserId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  referralCode: string;
  status: ReferralStatus;
  registeredAt: Date;
  qualifiedAt?: Date | null;
  rewardEligibleAt?: Date | null;
  rewardedAt?: Date | null;
  qualificationOrderId?: mongoose.Types.ObjectId | null;
  referrerRewardAmount: number;
  referredRewardAmount: number;
  referrerTransactionId?: mongoose.Types.ObjectId | null;
  referredTransactionId?: mongoose.Types.ObjectId | null;
  rejectionReason?: string | null;
  /** Set when a REWARDED referral is clawed back because the qualification
   *  order was refunded or cancelled. Enables re-qualification on the next
   *  eligible order without creating a new Referral document. */
  invalidatedAt?: Date | null;
  invalidationOrderId?: mongoose.Types.ObjectId | null;
  invalidationReason?: string | null;
  /** Incremented each time this referral is invalidated and re-qualified.
   *  Used by the risk engine to detect farming. */
  requalificationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    referralCode: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "REGISTERED",
        "PENDING_QUALIFICATION",
        "QUALIFIED",
        "REWARDED",
        "REJECTED",
        "CANCELLED",
        "INVALIDATED",
        "REQUALIFIED",
      ],
      default: "PENDING_QUALIFICATION",
    },
    registeredAt: { type: Date, default: Date.now },
    qualifiedAt: { type: Date, default: null },
    rewardEligibleAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
    qualificationOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    referrerRewardAmount: { type: Number, default: 0 },
    referredRewardAmount: { type: Number, default: 0 },
    referrerTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
    referredTransactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction", default: null },
    rejectionReason: { type: String, default: null },
    invalidatedAt: { type: Date, default: null },
    invalidationOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    invalidationReason: { type: String, default: null },
    requalificationCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ReferralSchema.index({ referrerUserId: 1, createdAt: -1 });
ReferralSchema.index({ referrerUserId: 1, status: 1 });
ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ qualificationOrderId: 1 });
ReferralSchema.index({ status: 1, rewardEligibleAt: 1 });
// Supports evaluateReferralClawback lookup by invalidated qualification order.
ReferralSchema.index({ invalidationOrderId: 1 }, { sparse: true });
// Supports requalification lookup for referred users.
ReferralSchema.index({ referredUserId: 1, status: 1 });

const Referral: Model<IReferral> =
  mongoose.models.Referral || mongoose.model<IReferral>("Referral", ReferralSchema);

export default Referral;
