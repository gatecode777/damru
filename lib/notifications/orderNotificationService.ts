import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NotificationType, NotificationChannel } from "@/models/Notification";
import { createNotification, setChannelStatus } from "@/lib/notifications/notificationService";
import { buildNotificationCopy, NotificationContext } from "@/lib/notifications/notificationTemplates";
import { sendNotificationEmail } from "@/lib/email";

/**
 * Order-lifecycle domain adapter (PRD 4B v2 section 64). Hooked at the
 * trusted order-status-transition call site only — never derived from a
 * frontend view. Same never-throws safety contract as the other adapters.
 */

// Only major milestones get email — not every intermediate kitchen status (PRD 4B v2 section 25's spirit: don't spam).
const EMAIL_ELIGIBLE_TYPES: ReadonlySet<NotificationType> = new Set(["ORDER_PLACED", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED", "ORDER_CANCELLED"]);

export interface NotifyOrderEventInput extends NotificationContext {
  userId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  sourceId: string | mongoose.Types.ObjectId;
  route?: string;
}

export interface NotifyOrderEventResult {
  success: boolean;
  duplicate: boolean;
  error?: string;
}

export async function notifyOrderEvent(input: NotifyOrderEventInput): Promise<NotifyOrderEventResult> {
  try {
    await connectDB();

    // One notification per (order, status) — a repeated status update (e.g. a
    // duplicate admin click, a retried webhook) is a safe no-op (section 64).
    const dedupKey = `notification:order:${input.sourceId}:${input.type}`;
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
      const emailEnabled = user?.notificationPreferences?.orderUpdates ?? true;
      if (emailEnabled && userEmail) channels.push("EMAIL");
    }

    const { duplicate, notification } = await createNotification({
      userId: input.userId,
      category: "ORDERS",
      type: input.type,
      title: copy.title,
      message: copy.message,
      action: input.route ? { label: "View Order", route: input.route } : undefined,
      channels,
      priority: "NORMAL",
      dedupKey,
      sourceType: "Order",
      sourceId: String(input.sourceId),
    });

    if (duplicate || !notification) return { success: true, duplicate: true };

    if (channels.includes("EMAIL") && userEmail) {
      try {
        await sendNotificationEmail(userEmail, copy, userName);
        await setChannelStatus(notification._id, "email", "SENT");
      } catch (err) {
        console.error("Order notification email failed:", err);
        await setChannelStatus(notification._id, "email", "FAILED", err instanceof Error ? err.message : "Unknown error");
      }
    }

    return { success: true, duplicate: false };
  } catch (err) {
    console.error("notifyOrderEvent failed:", err);
    return { success: false, duplicate: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
