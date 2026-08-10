import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NotificationType, NotificationChannel, NotificationCategory } from "@/models/Notification";
import { createNotification, setChannelStatus } from "@/lib/notifications/notificationService";
import { buildNotificationCopy, NotificationContext } from "@/lib/notifications/notificationTemplates";
import { sendNotificationEmail } from "@/lib/email";

/**
 * Payment/refund domain adapter (PRD 4B v2 sections 65/66). Same safety
 * contract as rewardNotificationService.ts: never throws, so a notification
 * failure can never affect the payment/refund state that already succeeded.
 */

const PAYMENT_TYPES: ReadonlySet<NotificationType> = new Set(["PAYMENT_SUCCESSFUL", "PAYMENT_FAILED", "COD_CONFIRMED"]);

// Email for HIGH-priority payment/refund outcomes only — not every pending/processing state.
const EMAIL_ELIGIBLE_TYPES: ReadonlySet<NotificationType> = new Set([
  "PAYMENT_SUCCESSFUL",
  "PAYMENT_FAILED",
  "REFUND_PROCESSED",
  "REFUND_FAILED",
]);

const HIGH_PRIORITY_TYPES: ReadonlySet<NotificationType> = new Set([
  "PAYMENT_SUCCESSFUL", "PAYMENT_FAILED", "REFUND_PROCESSING", "REFUND_PROCESSED", "REFUND_FAILED",
]);

function categoryFor(type: NotificationType): NotificationCategory {
  return PAYMENT_TYPES.has(type) ? "PAYMENTS" : "REFUNDS";
}

export interface NotifyPaymentEventInput extends NotificationContext {
  userId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  sourceId: string | mongoose.Types.ObjectId;
  sourceType?: string;
  dedupSuffix?: string;
  route?: string;
  entityType?: string;
  entityId?: string;
}

export interface NotifyPaymentEventResult {
  success: boolean;
  duplicate: boolean;
  error?: string;
}

export async function notifyPaymentEvent(input: NotifyPaymentEventInput): Promise<NotifyPaymentEventResult> {
  try {
    await connectDB();

    const category = categoryFor(input.type);
    const dedupKey = input.dedupSuffix
      ? `notification:${category.toLowerCase()}:${input.sourceId}:${input.dedupSuffix}`
      : `notification:${category.toLowerCase()}:${input.sourceId}`;

    const copy = buildNotificationCopy(input.type, input);

    const channels: NotificationChannel[] = ["IN_APP"];
    let userEmail: string | undefined;
    let userName: string | undefined;

    if (EMAIL_ELIGIBLE_TYPES.has(input.type)) {
      const user = await User.findById(input.userId).select("email name notificationPreferences").lean<{
        email?: string; name?: string; notificationPreferences?: { orderUpdates: boolean };
      }>();
      userEmail = user?.email;
      userName = user?.name;
      // Payment/refund emails are transactional — gated by orderUpdates
      // (section 33: transactional emails are governed separately from the
      // marketing opt-out flags), defaulting to enabled when untouched.
      const emailEnabled = user?.notificationPreferences?.orderUpdates ?? true;
      if (emailEnabled && userEmail) channels.push("EMAIL");
    }

    const { duplicate, notification } = await createNotification({
      userId: input.userId,
      category,
      type: input.type,
      title: copy.title,
      message: copy.message,
      data: { entityType: input.entityType, entityId: input.entityId, amount: input.amount },
      action: input.route ? { label: "View Order", route: input.route } : undefined,
      channels,
      priority: HIGH_PRIORITY_TYPES.has(input.type) ? "HIGH" : "NORMAL",
      dedupKey,
      sourceType: input.sourceType,
      sourceId: String(input.sourceId),
    });

    if (duplicate || !notification) return { success: true, duplicate: true };

    if (channels.includes("EMAIL") && userEmail) {
      try {
        await sendNotificationEmail(userEmail, copy, userName);
        await setChannelStatus(notification._id, "email", "SENT");
      } catch (err) {
        console.error("Payment notification email failed:", err);
        await setChannelStatus(notification._id, "email", "FAILED", err instanceof Error ? err.message : "Unknown error");
      }
    }

    return { success: true, duplicate: false };
  } catch (err) {
    console.error("notifyPaymentEvent failed:", err);
    return { success: false, duplicate: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
