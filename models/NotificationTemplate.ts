import mongoose, { Schema, Document, Model } from "mongoose";
import type { NotificationCategory, NotificationType } from "@/models/Notification";

/**
 * Admin-authored reusable templates (PRD 4B v2 section 10). Only used by
 * PROMOTIONAL campaigns — transactional notifications (rewards/orders/
 * payments/refunds) use the hardcoded template functions in
 * lib/notifications/notificationTemplates.ts, not this model, so a template
 * edit here can never silently change what a "Payment Successful" email says.
 */
export interface INotificationTemplate extends Document {
  name: string;
  code: string;
  category: NotificationCategory;
  type: NotificationType;
  titleTemplate: string;
  messageTemplate: string;
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
  imageUrl?: string;
  defaultAction?: { label: string; route: string };
  supportedChannels: ("IN_APP" | "EMAIL" | "PUSH")[];
  /** Variable names this template references, e.g. ["firstName","discount","expiryDate"] — validated against at send time (section 12). */
  variables: string[];
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    category: {
      type: String,
      required: true,
      enum: ["REWARDS", "ORDERS", "PAYMENTS", "REFUNDS", "COUPONS", "ACCOUNT", "SECURITY", "PROMOTIONS", "CAMPAIGNS", "SYSTEM", "DELIVERY"],
    },
    type: { type: String, required: true, default: "PROMOTIONAL_CAMPAIGN" },
    titleTemplate: { type: String, required: true },
    messageTemplate: { type: String, required: true },
    emailSubjectTemplate: { type: String },
    emailBodyTemplate: { type: String },
    imageUrl: { type: String },
    defaultAction: { type: { label: String, route: String }, _id: false },
    supportedChannels: { type: [{ type: String, enum: ["IN_APP", "EMAIL", "PUSH"] }], required: true, default: ["IN_APP"] },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

NotificationTemplateSchema.index({ category: 1, isActive: 1 });

const NotificationTemplate: Model<INotificationTemplate> =
  mongoose.models.NotificationTemplate || mongoose.model<INotificationTemplate>("NotificationTemplate", NotificationTemplateSchema);

export default NotificationTemplate;
