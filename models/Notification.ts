import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One canonical category/type taxonomy for the whole notification platform
 * (PRD 4B v2 sections 5/6) — backend, website, and mobile all reference these
 * exact string values, never ad-hoc names.
 */
export type NotificationCategory =
  | "REWARDS"
  | "ORDERS"
  | "PAYMENTS"
  | "REFUNDS"
  | "COUPONS"
  | "ACCOUNT"
  | "SECURITY"
  | "PROMOTIONS"
  | "CAMPAIGNS"
  | "SYSTEM"
  | "DELIVERY";

export type NotificationType =
  // Rewards
  | "DAMRU_CREDITED"
  | "DAMRU_REDEEMED"
  | "DAMRU_EXPIRING_SOON"
  | "DAMRU_EXPIRED"
  | "DAMRU_RESTORED"
  | "REWARD_ADJUSTED"
  | "DAILY_CHECKIN_REWARD"
  | "STREAK_MILESTONE"
  | "ACHIEVEMENT_UNLOCKED"
  | "MISSION_COMPLETED"
  | "REFERRAL_REGISTERED"
  | "REFERRAL_QUALIFIED"
  | "REFERRAL_REWARDED"
  | "BIRTHDAY_REWARD"
  | "MARRIAGE_ANNIVERSARY_REWARD"
  | "ACCOUNT_ANNIVERSARY_REWARD"
  | "LOYALTY_TIER_UPGRADED"
  | "LOYALTY_BENEFIT_AVAILABLE"
  // Orders — mapped 1:1 to this project's actual Order.status values (see models/Order.ts)
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_PREPARING"
  | "ORDER_OUT_FOR_DELIVERY"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  // Reservations
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_DECLINED"
  | "RESERVATION_DELETED"
  | "COMPLAINT_DELETED"
  // Payments
  | "PAYMENT_SUCCESSFUL"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "COD_CONFIRMED"
  // Refunds
  | "REFUND_PROCESSING"
  | "REFUND_PROCESSED"
  | "REFUND_FAILED"
  // Coupons
  | "COUPON_ISSUED"
  // Account
  | "WELCOME"
  | "PASSWORD_CHANGED"
  // Promotions / admin campaigns
  | "PROMOTIONAL_CAMPAIGN";

export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH";
export type ChannelStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

/** Optional CTA — only ever an internal route, never an arbitrary external URL (PRD 4B v2 section 8/55). */
export interface INotificationAction {
  label: string;
  route: string;
}

/** Minimal, non-sensitive payload for client-side navigation only — never the full source record. */
export interface INotificationData {
  entityType?: string;
  entityId?: string;
  amount?: number;
}

export interface IChannelDelivery {
  status: ChannelStatus;
  sentAt?: Date | null;
  error?: string;
}

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  imageUrl?: string;
  action?: INotificationAction;
  data?: INotificationData;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date | null;
  dedupKey: string;
  /** What produced this notification — a DamruTransaction, Order, PaymentRefund, Coupon, campaign send, etc. Informational only, never used for auth. */
  sourceType?: string;
  sourceId?: string;
  campaignId?: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  delivery: {
    inApp: IChannelDelivery;
    email: IChannelDelivery;
    push: IChannelDelivery;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChannelDeliverySchema = new Schema<IChannelDelivery>(
  {
    status: { type: String, enum: ["PENDING", "SENT", "FAILED", "SKIPPED"], required: true, default: "SKIPPED" },
    sentAt: { type: Date, default: null },
    // Safe, short human-readable failure reason only — never a raw provider payload/secret (section 7/76).
    error: { type: String },
  },
  { _id: false }
);

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      required: true,
      enum: ["REWARDS", "ORDERS", "PAYMENTS", "REFUNDS", "COUPONS", "ACCOUNT", "SECURITY", "PROMOTIONS", "CAMPAIGNS", "SYSTEM", "DELIVERY"],
    },
    type: {
      type: String,
      required: true,
      enum: [
        "DAMRU_CREDITED", "DAMRU_REDEEMED", "DAMRU_EXPIRING_SOON", "DAMRU_EXPIRED", "DAMRU_RESTORED", "REWARD_ADJUSTED",
        "DAILY_CHECKIN_REWARD", "STREAK_MILESTONE", "ACHIEVEMENT_UNLOCKED", "MISSION_COMPLETED",
        "REFERRAL_REGISTERED", "REFERRAL_QUALIFIED", "REFERRAL_REWARDED",
        "BIRTHDAY_REWARD", "MARRIAGE_ANNIVERSARY_REWARD", "ACCOUNT_ANNIVERSARY_REWARD",
        "LOYALTY_TIER_UPGRADED", "LOYALTY_BENEFIT_AVAILABLE",
        "ORDER_PLACED", "ORDER_CONFIRMED", "ORDER_PREPARING", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED", "ORDER_CANCELLED",
        "RESERVATION_CONFIRMED", "RESERVATION_DECLINED", "RESERVATION_DELETED", "COMPLAINT_DELETED",
        "PAYMENT_SUCCESSFUL", "PAYMENT_PENDING", "PAYMENT_FAILED", "COD_CONFIRMED",
        "REFUND_PROCESSING", "REFUND_PROCESSED", "REFUND_FAILED",
        "COUPON_ISSUED",
        "WELCOME", "PASSWORD_CHANGED",
        "PROMOTIONAL_CAMPAIGN",
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    imageUrl: { type: String },
    action: { type: { label: String, route: String }, _id: false },
    data: { type: { entityType: String, entityId: String, amount: Number }, _id: false, default: undefined },
    channels: { type: [{ type: String, enum: ["IN_APP", "EMAIL", "PUSH"] }], required: true, default: [] },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"], required: true, default: "NORMAL" },
    isRead: { type: Boolean, required: true, default: false },
    readAt: { type: Date, default: null },
    dedupKey: { type: String, required: true, unique: true },
    sourceType: { type: String },
    sourceId: { type: String },
    campaignId: { type: Schema.Types.ObjectId, ref: "NotificationCampaign" },
    templateId: { type: Schema.Types.ObjectId, ref: "NotificationTemplate" },
    delivery: {
      type: {
        inApp: { type: ChannelDeliverySchema, default: () => ({ status: "SKIPPED" }) },
        email: { type: ChannelDeliverySchema, default: () => ({ status: "SKIPPED" }) },
        push: { type: ChannelDeliverySchema, default: () => ({ status: "SKIPPED" }) },
      },
      _id: false,
      required: true,
      default: () => ({ inApp: { status: "SKIPPED" }, email: { status: "SKIPPED" }, push: { status: "SKIPPED" } }),
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ campaignId: 1, userId: 1 }, { sparse: true });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
