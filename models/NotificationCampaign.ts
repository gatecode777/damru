import mongoose, { Schema, Document, Model } from "mongoose";
import type { NotificationChannel, INotificationAction } from "@/models/Notification";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "FAILED";

export type AudienceSegment =
  | "ALL_USERS"
  | "NEW_USERS"
  | "ACTIVE_USERS"
  | "INACTIVE_USERS"
  | "DAMRU_USERS"
  | "LOYALTY_TIER"
  | "SELECTED_USERS";

export interface IAudience {
  segment: AudienceSegment;
  /** Only for segment === "LOYALTY_TIER" — a LoyaltyTier.code (e.g. "gold"). Never hardcoded tier names. */
  loyaltyTierCode?: string;
  /** Only for segment === "INACTIVE_USERS" / "ACTIVE_USERS" — days since last delivered order. */
  activityWindowDays?: number;
  /** Only for segment === "SELECTED_USERS". */
  userIds?: mongoose.Types.ObjectId[];
}

export interface INotificationCampaign extends Document {
  name: string;
  templateId?: mongoose.Types.ObjectId;
  audience: IAudience;
  channels: NotificationChannel[];
  scheduledAt?: Date | null;
  status: CampaignStatus;
  // Snapshotted at send/schedule time — a later template edit never changes an already-scheduled campaign (section 49).
  title: string;
  message: string;
  imageUrl?: string;
  action?: INotificationAction;
  estimatedRecipients: number;
  processedRecipients: number;
  sentCount: number;
  failedCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    name: { type: String, required: true, trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: "NotificationTemplate" },
    audience: {
      type: {
        segment: { type: String, required: true, enum: ["ALL_USERS", "NEW_USERS", "ACTIVE_USERS", "INACTIVE_USERS", "DAMRU_USERS", "LOYALTY_TIER", "SELECTED_USERS"] },
        loyaltyTierCode: { type: String },
        activityWindowDays: { type: Number },
        userIds: { type: [Schema.Types.ObjectId], ref: "User" },
      },
      _id: false,
      required: true,
    },
    channels: { type: [{ type: String, enum: ["IN_APP", "EMAIL", "PUSH"] }], required: true, default: ["IN_APP"] },
    scheduledAt: { type: Date, default: null },
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"], required: true, default: "DRAFT" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    imageUrl: { type: String },
    action: { type: { label: String, route: String }, _id: false },
    estimatedRecipients: { type: Number, default: 0 },
    processedRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true }
);

NotificationCampaignSchema.index({ status: 1, scheduledAt: 1 });

const NotificationCampaign: Model<INotificationCampaign> =
  mongoose.models.NotificationCampaign || mongoose.model<INotificationCampaign>("NotificationCampaign", NotificationCampaignSchema);

export default NotificationCampaign;
