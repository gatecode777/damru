import mongoose, { Document, Model, Schema } from "mongoose";

export const REWARD_RISK_EVENT_TYPES = [
  "REWARD_EARNING_VELOCITY",
  "REDEMPTION_VELOCITY",
  "EARN_REDEEM_REFUND_ABUSE",
  "REFUND_ABUSE",
  "CANCELLATION_ABUSE",
  "REWARD_REVERSAL_FREQUENCY",
  "REWARD_DEBT",
  "REFERRAL_FARMING",
  "CAMPAIGN_ABUSE",
  "MISSION_VELOCITY",
  "ADMIN_ADJUSTMENT",
] as const;
export const REWARD_RISK_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;
export const REWARD_RISK_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const REWARD_RISK_DECISIONS = ["NONE", "LEGITIMATE", "ABUSE_CONFIRMED", "MONITOR", "NO_ACTION", "DISMISSED"] as const;

export type RewardRiskEventType = (typeof REWARD_RISK_EVENT_TYPES)[number];
export type RewardRiskStatus = (typeof REWARD_RISK_STATUSES)[number];
export type RewardRiskSeverity = (typeof REWARD_RISK_SEVERITIES)[number];
export type RewardRiskDecision = (typeof REWARD_RISK_DECISIONS)[number];

export interface IRewardRiskEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventType: RewardRiskEventType;
  severity: RewardRiskSeverity;
  score: number;
  status: RewardRiskStatus;
  sourceType: string;
  sourceId: string;
  orderId?: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  referralId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  refundId?: mongoose.Types.ObjectId;
  reversalId?: mongoose.Types.ObjectId;
  actingAdminId?: mongoose.Types.ObjectId;
  ruleCode: string;
  dedupeKey: string;
  reasons: string[];
  relatedAmount: number;
  metadata?: Record<string, unknown>;
  detectedAt: Date;
  lastDetectedAt: Date;
  occurrenceCount: number;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewDecision: RewardRiskDecision;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RewardRiskEventSchema = new Schema<IRewardRiskEvent>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  eventType: { type: String, enum: REWARD_RISK_EVENT_TYPES, required: true },
  severity: { type: String, enum: REWARD_RISK_SEVERITIES, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, enum: REWARD_RISK_STATUSES, required: true, default: "OPEN" },
  sourceType: { type: String, required: true },
  sourceId: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  transactionId: { type: Schema.Types.ObjectId, ref: "DamruTransaction" },
  referralId: { type: Schema.Types.ObjectId, ref: "Referral" },
  campaignId: { type: Schema.Types.ObjectId, ref: "RewardCampaign" },
  refundId: { type: Schema.Types.ObjectId, ref: "PaymentRefund" },
  reversalId: { type: Schema.Types.ObjectId, ref: "RewardReversal" },
  actingAdminId: { type: Schema.Types.ObjectId, ref: "Admin" },
  ruleCode: { type: String, required: true },
  dedupeKey: { type: String, required: true, unique: true },
  reasons: { type: [String], required: true, default: [] },
  relatedAmount: { type: Number, required: true, default: 0, min: 0 },
  metadata: { type: Schema.Types.Mixed },
  detectedAt: { type: Date, required: true, default: Date.now },
  lastDetectedAt: { type: Date, required: true, default: Date.now },
  occurrenceCount: { type: Number, required: true, default: 1, min: 1 },
  reviewedAt: { type: Date },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  reviewDecision: { type: String, enum: REWARD_RISK_DECISIONS, required: true, default: "NONE" },
  reviewNote: { type: String, maxlength: 1000 },
}, { timestamps: true });

RewardRiskEventSchema.index({ userId: 1, detectedAt: -1 });
RewardRiskEventSchema.index({ status: 1, severity: 1, detectedAt: -1 });
RewardRiskEventSchema.index({ ruleCode: 1, userId: 1, detectedAt: -1 });
RewardRiskEventSchema.index({ sourceType: 1, sourceId: 1 });
RewardRiskEventSchema.index({ eventType: 1, detectedAt: -1 });

const RewardRiskEvent: Model<IRewardRiskEvent> =
  mongoose.models.RewardRiskEvent || mongoose.model<IRewardRiskEvent>("RewardRiskEvent", RewardRiskEventSchema);

export default RewardRiskEvent;
