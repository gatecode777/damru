import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Order from "@/models/Order";
import NotificationCampaign, { INotificationCampaign, IAudience, AudienceSegment } from "@/models/NotificationCampaign";
import { createNotification, setChannelStatus } from "@/lib/notifications/notificationService";
import { sendNotificationEmail } from "@/lib/email";
import type { NotificationChannel, INotificationAction } from "@/models/Notification";

/**
 * Admin-campaign engine (PRD 4B v2 sections 25-29). Transactional
 * notifications (rewards/orders/payments/refunds) NEVER go through here —
 * this file is exclusively for admin-initiated PROMOTIONAL sends, kept
 * architecturally separate per section 30.
 */

const BATCH_SIZE = 500; // section 28 — never send the whole audience synchronously

function audienceFilter(audience: IAudience): Record<string, unknown> {
  switch (audience.segment) {
    case "ALL_USERS":
      return {};
    case "NEW_USERS": {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return { createdAt: { $gte: cutoff } };
    }
    case "DAMRU_USERS":
      return { damruBalance: { $gt: 0 } };
    case "LOYALTY_TIER":
      return audience.loyaltyTierCode ? { loyaltyTierCode: audience.loyaltyTierCode } : { _id: null };
    case "SELECTED_USERS":
      return audience.userIds && audience.userIds.length > 0 ? { _id: { $in: audience.userIds } } : { _id: null };
    // ACTIVE_USERS / INACTIVE_USERS are resolved separately below — they key off
    // Order activity, not a User field, so they can't be expressed as a single filter here.
    default:
      return {};
  }
}

/**
 * ACTIVE_USERS / INACTIVE_USERS use trusted delivered-order timestamps
 * (section 22: "Do not infer user activity from notification opens alone").
 * Returns a set of user ids who HAVE ordered within the window — callers
 * invert this for INACTIVE_USERS via $nin.
 */
async function usersWithRecentOrder(days: number): Promise<mongoose.Types.ObjectId[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Order.aggregate([
    { $match: { status: "delivered", createdAt: { $gte: cutoff }, userId: { $ne: null } } },
    { $group: { _id: "$userId" } },
  ]);
  return rows.map(r => r._id);
}

/** Backend-authoritative recipient count — never trusts a frontend-supplied number (section 85). */
export async function estimateAudienceSize(audience: IAudience): Promise<number> {
  await connectDB();
  const days = audience.activityWindowDays ?? 30;
  if (audience.segment === "ACTIVE_USERS") {
    const ids = await usersWithRecentOrder(days);
    return ids.length;
  }
  if (audience.segment === "INACTIVE_USERS") {
    const activeIds = await usersWithRecentOrder(days);
    return User.countDocuments({ _id: { $nin: activeIds } });
  }
  return User.countDocuments(audienceFilter(audience));
}

/** Streaming cursor over the resolved audience — never loads the full list into memory (section 79). */
async function audienceCursor(audience: IAudience) {
  const days = audience.activityWindowDays ?? 30;
  if (audience.segment === "ACTIVE_USERS") {
    const ids = await usersWithRecentOrder(days);
    return User.find({ _id: { $in: ids } }).select("_id email name notificationPreferences").cursor();
  }
  if (audience.segment === "INACTIVE_USERS") {
    const activeIds = await usersWithRecentOrder(days);
    return User.find({ _id: { $nin: activeIds } }).select("_id email name notificationPreferences").cursor();
  }
  return User.find(audienceFilter(audience)).select("_id email name notificationPreferences").cursor();
}

export interface CreateCampaignInput {
  name: string;
  templateId?: string;
  audience: IAudience;
  channels: NotificationChannel[];
  title: string;
  message: string;
  imageUrl?: string;
  action?: INotificationAction;
  scheduledAt?: Date | null;
  createdBy: string | mongoose.Types.ObjectId;
}

export interface CreateCampaignResult {
  success: boolean;
  campaign?: INotificationCampaign;
  error?: string;
}

/**
 * Title/message are snapshotted onto the campaign document at creation time
 * (section 49) — a later edit to the referenced template never changes an
 * already-created/scheduled campaign.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  await connectDB();
  if (!input.name?.trim()) return { success: false, error: "Campaign name is required." };
  if (!input.title?.trim() || !input.message?.trim()) return { success: false, error: "Title and message are required." };
  if (!input.channels || input.channels.length === 0) return { success: false, error: "At least one channel is required." };
  if (input.audience.segment === "LOYALTY_TIER" && !input.audience.loyaltyTierCode) {
    return { success: false, error: "A loyalty tier must be selected for this audience." };
  }
  if (input.audience.segment === "SELECTED_USERS" && (!input.audience.userIds || input.audience.userIds.length === 0)) {
    return { success: false, error: "At least one user must be selected for this audience." };
  }

  const estimatedRecipients = await estimateAudienceSize(input.audience);

  const campaign = await NotificationCampaign.create({
    name: input.name.trim(),
    templateId: input.templateId,
    audience: input.audience,
    channels: input.channels,
    scheduledAt: input.scheduledAt ?? null,
    status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
    title: input.title,
    message: input.message,
    imageUrl: input.imageUrl,
    action: input.action,
    estimatedRecipients,
    createdBy: input.createdBy,
  });

  return { success: true, campaign };
}

/**
 * Processes ONE bounded batch of the audience for a campaign already in
 * PROCESSING state. Each recipient's own dedupKey (`notification:campaign:
 * {campaignId}:{userId}`) makes this naturally resumable and idempotent —
 * a user already notified for this campaign is a safe, cheap no-op on any
 * later pass, so re-scanning from the top of the audience on a subsequent
 * run never double-notifies anyone (see module docs for the accepted
 * trade-off: re-scanning re-touches already-notified users cheaply rather
 * than tracking an explicit resume cursor — acceptable at this project's
 * audience scale, called out as a deferred optimization for very large ones).
 */
async function processCampaignBatch(campaign: INotificationCampaign): Promise<void> {
  const cursor = await audienceCursor(campaign.audience);
  let touched = 0;
  let sent = 0;
  let failed = 0;

  for await (const user of cursor) {
    if (touched >= BATCH_SIZE) break;
    touched++;

    const promoInAppEnabled = user.notificationPreferences?.promotionalInApp ?? true;
    const promoEmailEnabled = user.notificationPreferences?.promotionalEmail ?? true;

    const channels: NotificationChannel[] = [];
    if (campaign.channels.includes("IN_APP") && promoInAppEnabled) channels.push("IN_APP");
    if (campaign.channels.includes("EMAIL") && promoEmailEnabled && user.email) channels.push("EMAIL");
    // PUSH never dispatched — no provider configured (see docs/NOTIFICATION_SYSTEM.md).

    if (channels.length === 0) continue; // fully opted out — not counted as failed, just skipped

    const { duplicate, notification } = await createNotification({
      userId: user._id,
      category: "PROMOTIONS",
      type: "PROMOTIONAL_CAMPAIGN",
      title: campaign.title,
      message: campaign.message,
      imageUrl: campaign.imageUrl,
      action: campaign.action,
      channels,
      priority: "LOW",
      dedupKey: `notification:campaign:${campaign._id}:${user._id}`,
      sourceType: "NotificationCampaign",
      sourceId: String(campaign._id),
      campaignId: campaign._id,
      templateId: campaign.templateId,
    });

    if (duplicate) continue; // already notified on a prior batch pass

    if (channels.includes("EMAIL") && user.email && notification) {
      try {
        await sendNotificationEmail(user.email, { title: campaign.title, message: campaign.message }, user.name);
        await setChannelStatus(notification._id, "email", "SENT");
        sent++;
      } catch (err) {
        console.error("Campaign email failed:", err);
        await setChannelStatus(notification._id, "email", "FAILED", err instanceof Error ? err.message : "Unknown error");
        failed++;
      }
    } else {
      sent++;
    }
  }
  await cursor.close();

  const updated = await NotificationCampaign.findByIdAndUpdate(
    campaign._id,
    { $inc: { processedRecipients: touched, sentCount: sent, failedCount: failed } },
    { new: true }
  );

  // Fewer than a full batch means the audience is exhausted — done.
  if (updated && touched < BATCH_SIZE) {
    await NotificationCampaign.updateOne({ _id: campaign._id, status: "PROCESSING" }, { $set: { status: "COMPLETED" } });
  }
}

export interface SendCampaignResult {
  success: boolean;
  error?: string;
}

const CAMPAIGN_SEND_ENABLED = process.env.NOTIFICATION_CAMPAIGN_SEND_ENABLED !== "false";

/**
 * Admin "Send Now" — atomically claims the campaign (DRAFT/SCHEDULED →
 * PROCESSING) so a double-click can never start it twice, then processes one
 * batch synchronously (bounded to BATCH_SIZE, section 28). If the audience is
 * larger than one batch, it stays PROCESSING and the scheduler finishes the
 * rest (section 27/29).
 */
export async function sendCampaignNow(campaignId: string, adminId: string | mongoose.Types.ObjectId): Promise<SendCampaignResult> {
  await connectDB();
  if (!CAMPAIGN_SEND_ENABLED) {
    return { success: false, error: "Campaign sending is disabled in this environment (NOTIFICATION_CAMPAIGN_SEND_ENABLED=false)." };
  }
  void adminId; // recorded via admin audit log at the API route layer, not here

  const claimed = await NotificationCampaign.findOneAndUpdate(
    { _id: campaignId, status: { $in: ["DRAFT", "SCHEDULED"] } },
    { $set: { status: "PROCESSING" } },
    { new: true }
  );
  if (!claimed) return { success: false, error: "Campaign is not in a sendable state (already processing, completed, or cancelled)." };

  await processCampaignBatch(claimed);
  return { success: true };
}

export interface ScheduleCampaignResult {
  success: boolean;
  error?: string;
}

export async function scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<ScheduleCampaignResult> {
  await connectDB();
  if (scheduledAt.getTime() <= Date.now()) return { success: false, error: "Scheduled time must be in the future." };
  const updated = await NotificationCampaign.findOneAndUpdate(
    { _id: campaignId, status: "DRAFT" },
    { $set: { status: "SCHEDULED", scheduledAt } }
  );
  if (!updated) return { success: false, error: "Only a draft campaign can be scheduled." };
  return { success: true };
}

export async function cancelCampaign(campaignId: string): Promise<ScheduleCampaignResult> {
  await connectDB();
  const updated = await NotificationCampaign.findOneAndUpdate(
    { _id: campaignId, status: { $in: ["DRAFT", "SCHEDULED"] } },
    { $set: { status: "CANCELLED" } }
  );
  if (!updated) return { success: false, error: "Only a draft or scheduled campaign can be cancelled." };
  return { success: true };
}

export interface ProcessDueCampaignsResult {
  campaignsProcessed: number;
}

/**
 * Scheduler entry point (reuses the existing daily rewards cron — section
 * 27, no separate cron architecture). Claims each due SCHEDULED campaign
 * (atomic transition to PROCESSING, so two overlapping scheduler runs can't
 * both claim the same one) plus any campaign still PROCESSING from a prior
 * run whose audience wasn't fully sent in one batch, and advances each by
 * one batch.
 */
export async function processDueCampaigns(maxCampaigns = 20): Promise<ProcessDueCampaignsResult> {
  await connectDB();
  if (!CAMPAIGN_SEND_ENABLED) return { campaignsProcessed: 0 };

  let campaignsProcessed = 0;
  const now = new Date();

  const due = await NotificationCampaign.find({ status: "SCHEDULED", scheduledAt: { $lte: now } })
    .select("_id")
    .limit(maxCampaigns)
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  for (const { _id } of due) {
    const claimed = await NotificationCampaign.findOneAndUpdate(
      { _id, status: "SCHEDULED" },
      { $set: { status: "PROCESSING" } },
      { new: true }
    );
    if (claimed) {
      await processCampaignBatch(claimed);
      campaignsProcessed++;
    }
  }

  const inProgress = await NotificationCampaign.find({ status: "PROCESSING" })
    .limit(maxCampaigns)
    .lean<INotificationCampaign[]>();
  for (const campaign of inProgress) {
    await processCampaignBatch(campaign as INotificationCampaign);
    campaignsProcessed++;
  }

  return { campaignsProcessed };
}

export type { AudienceSegment };
