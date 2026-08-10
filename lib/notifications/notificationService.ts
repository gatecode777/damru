import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Notification, {
  INotification,
  NotificationType,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  INotificationData,
  INotificationAction,
} from "@/models/Notification";

/**
 * Generic, event-type-agnostic notification CRUD/delivery-tracking layer
 * (PRD 4B v2 section 7/10). Nothing here knows about Damru, orders, or any
 * specific domain concept — that lives in the per-domain adapter files
 * (rewardNotificationService.ts, orderNotificationService.ts, etc.) and
 * notificationTemplates.ts. This file only knows how to store, deduplicate,
 * paginate, and mark notifications read.
 *
 * No retention/auto-deletion policy is implemented — section 78 explicitly
 * says to document and defer this until product decides, not invent one.
 * See docs/NOTIFICATION_SYSTEM.md.
 */

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000;
}

export interface CreateNotificationInput {
  userId: string | mongoose.Types.ObjectId;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  imageUrl?: string;
  action?: INotificationAction;
  data?: INotificationData;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  dedupKey: string;
  sourceType?: string;
  sourceId?: string;
  campaignId?: mongoose.Types.ObjectId | string;
  templateId?: mongoose.Types.ObjectId | string;
}

export interface CreateNotificationResult {
  duplicate: boolean;
  notification?: INotification;
}

/**
 * Idempotent insert keyed on `dedupKey` — the ONLY correctness guarantee this
 * PRD requires (sections 9/46/62). A duplicate call (repeated scheduler run,
 * repeated webhook, repeated evaluator pass) is a safe, silent no-op: it
 * returns the EXISTING notification rather than erroring or creating a
 * second one. Callers must never treat a duplicate as a failure.
 */
export async function createNotification(input: CreateNotificationInput): Promise<CreateNotificationResult> {
  await connectDB();
  try {
    const notification = await Notification.create({
      userId: input.userId,
      category: input.category,
      type: input.type,
      title: input.title,
      message: input.message,
      imageUrl: input.imageUrl,
      action: input.action,
      data: input.data,
      channels: input.channels,
      priority: input.priority ?? "NORMAL",
      dedupKey: input.dedupKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      campaignId: input.campaignId,
      templateId: input.templateId,
      delivery: {
        inApp: { status: input.channels.includes("IN_APP") ? "SENT" : "SKIPPED", sentAt: input.channels.includes("IN_APP") ? new Date() : null },
        email: { status: input.channels.includes("EMAIL") ? "PENDING" : "SKIPPED" },
        push: { status: input.channels.includes("PUSH") ? "PENDING" : "SKIPPED" },
      },
    });
    return { duplicate: false, notification };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const existing = await Notification.findOne({ dedupKey: input.dedupKey });
      return { duplicate: true, notification: existing || undefined };
    }
    throw err;
  }
}

export async function setChannelStatus(
  notificationId: mongoose.Types.ObjectId | string,
  channel: "email" | "push",
  status: "SENT" | "FAILED",
  error?: string
): Promise<void> {
  await connectDB();
  const set: Record<string, unknown> = { [`delivery.${channel}.status`]: status };
  if (status === "SENT") set[`delivery.${channel}.sentAt`] = new Date();
  if (error) set[`delivery.${channel}.error`] = error.slice(0, 300); // bounded — never a raw provider payload
  await Notification.updateOne({ _id: notificationId }, { $set: set });
}

export interface ListNotificationsFilter {
  category?: NotificationCategory;
}

export interface ListNotificationsResult {
  notifications: INotification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Ownership is enforced by the caller always passing the AUTHENTICATED userId — never a client-supplied one. */
export async function listNotifications(
  userId: string | mongoose.Types.ObjectId,
  page = 1,
  limit = 20,
  filter: ListNotificationsFilter = {}
): Promise<ListNotificationsResult> {
  await connectDB();
  const safeLimit = Math.min(50, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const query: Record<string, unknown> = { userId };
  if (filter.category) query.category = filter.category;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean<INotification[]>(),
    Notification.countDocuments(query),
  ]);

  return { notifications, page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
}

/** Indexed count only — never loads notification bodies just to count unread ones (section 79). */
export async function getUnreadCount(userId: string | mongoose.Types.ObjectId): Promise<number> {
  await connectDB();
  return Notification.countDocuments({ userId, isRead: false });
}

/** Ownership-scoped — the filter includes userId so a foreign notification id simply matches nothing. */
export async function markRead(userId: string | mongoose.Types.ObjectId, notificationId: string): Promise<boolean> {
  await connectDB();
  if (!mongoose.isValidObjectId(notificationId)) return false;
  const result = await Notification.updateOne(
    { _id: notificationId, userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

export async function markAllRead(userId: string | mongoose.Types.ObjectId): Promise<number> {
  await connectDB();
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount;
}
