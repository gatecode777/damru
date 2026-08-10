import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NotificationType, NotificationChannel } from "@/models/Notification";
import type { DamruTransactionCategory } from "@/models/DamruTransaction";
import { createNotification, setChannelStatus } from "@/lib/notifications/notificationService";
import { buildNotificationCopy, NotificationContext } from "@/lib/notifications/notificationTemplates";
import { sendRewardEmail, sendNotificationEmail } from "@/lib/email";

/**
 * The reward-domain adapter every reward-producing call site uses (PRD 4B v2
 * section 67: rewards prefer the MORE SPECIFIC type — e.g. ACHIEVEMENT_UNLOCKED
 * — over also sending a generic DAMRU_CREDITED for the same transaction).
 * Trusted backend-only input — never called with client-supplied data, and
 * never itself computes or awards Damru; it only reacts to an
 * already-committed reward event.
 *
 * Safety contract: this function NEVER throws. Every internal failure
 * (email send, DB hiccup) is caught and logged; the caller always gets a
 * result object back, never an exception — so "reward succeeds, notification
 * fails" can never accidentally roll back or block the reward that already
 * happened (PRD 4B v2 section 2/61).
 */

const EMAIL_ELIGIBLE_TYPES: ReadonlySet<NotificationType> = new Set([
  "REFERRAL_REWARDED",
  "BIRTHDAY_REWARD",
  "MARRIAGE_ANNIVERSARY_REWARD",
  "ACCOUNT_ANNIVERSARY_REWARD",
  "LOYALTY_TIER_UPGRADED",
  "DAMRU_EXPIRING_SOON",
  "DAMRU_RESTORED",
]);

// Credit-shaped types use the existing "+amount added" email template;
// DAMRU_EXPIRING_SOON is a warning, not a credit, so it uses the generic one.
const CREDIT_SHAPED_EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  "REFERRAL_REWARDED",
  "BIRTHDAY_REWARD",
  "MARRIAGE_ANNIVERSARY_REWARD",
  "ACCOUNT_ANNIVERSARY_REWARD",
  "LOYALTY_TIER_UPGRADED",
  "DAMRU_RESTORED",
]);

/**
 * Maps a DamruTransaction credit category to its notification type — the
 * single source of truth so no call site re-derives this mapping itself.
 * `legacy_opening_balance` deliberately returns null: it's a one-time
 * migration artifact backfilling PRE-EXISTING balance, not a new reward
 * event. `admin_credit` and `refund_restore` are handled at their own call
 * sites (adjustDamru / restoreDamruForOrder) since they don't flow through
 * awardDamru.
 */
export function mapCreditCategoryToType(category: DamruTransactionCategory): NotificationType | null {
  switch (category) {
    case "birthday": return "BIRTHDAY_REWARD";
    case "marriage_anniversary": return "MARRIAGE_ANNIVERSARY_REWARD";
    case "account_anniversary": return "ACCOUNT_ANNIVERSARY_REWARD";
    case "daily_login": return "DAILY_CHECKIN_REWARD";
    case "achievement": return "ACHIEVEMENT_UNLOCKED";
    case "mission": return "MISSION_COMPLETED";
    case "referral": return "REFERRAL_REWARDED";
    case "loyalty_tier": return "LOYALTY_TIER_UPGRADED";
    case "welcome_registration":
    case "first_order":
    case "order_reward":
      return "DAMRU_CREDITED";
    case "admin_credit":
    case "refund_restore":
    case "legacy_opening_balance":
      return null;
    default:
      return null;
  }
}

export interface NotifyRewardEventInput extends NotificationContext {
  userId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  /** Stable id of the source record (DamruTransaction, lot, coupon, …) — forms the dedup key together with `dedupSuffix`. */
  sourceId: string | mongoose.Types.ObjectId;
  sourceType?: string;
  /** Extra dedup specificity for sources that legitimately notify more than once (e.g. expiry warning windows). */
  dedupSuffix?: string;
  route?: string;
  entityType?: string;
  entityId?: string;
}

export interface NotifyRewardEventResult {
  success: boolean;
  duplicate: boolean;
  error?: string;
}

function dedupKeyPrefix(type: NotificationType): string {
  if (type === "COUPON_ISSUED") return "notification:coupon";
  if (type === "DAMRU_EXPIRING_SOON") return "notification:expiry-warning";
  return "notification:reward";
}

export async function notifyRewardEvent(input: NotifyRewardEventInput): Promise<NotifyRewardEventResult> {
  try {
    await connectDB();

    const dedupKey = input.dedupSuffix
      ? `${dedupKeyPrefix(input.type)}:${input.sourceId}:${input.dedupSuffix}`
      : `${dedupKeyPrefix(input.type)}:${input.sourceId}`;

    const copy = buildNotificationCopy(input.type, input);

    const channels: NotificationChannel[] = ["IN_APP"];
    let emailEnabled = false;
    let userEmail: string | undefined;
    let userName: string | undefined;

    if (EMAIL_ELIGIBLE_TYPES.has(input.type)) {
      const user = await User.findById(input.userId).select("email name notificationPreferences").lean<{
        email?: string; name?: string; notificationPreferences?: { rewardUpdates: boolean };
      }>();
      userEmail = user?.email;
      userName = user?.name;
      // Defaults to enabled when the user has never touched preferences (section 31).
      // Reward emails are transactional, gated by rewardUpdates — NOT the
      // promotional* flags, which only govern admin campaign sends.
      emailEnabled = user?.notificationPreferences?.rewardUpdates ?? true;
      if (emailEnabled && userEmail) channels.push("EMAIL");
    }
    // PUSH intentionally never added — no push infrastructure exists yet (see docs/NOTIFICATION_SYSTEM.md).

    const { duplicate, notification } = await createNotification({
      userId: input.userId,
      category: "REWARDS",
      type: input.type,
      title: copy.title,
      message: copy.message,
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        amount: input.amount,
      },
      action: input.route ? { label: "View Rewards", route: input.route } : undefined,
      channels,
      dedupKey,
      sourceType: input.sourceType,
      sourceId: String(input.sourceId),
    });

    if (duplicate || !notification) return { success: true, duplicate: true };

    if (channels.includes("EMAIL") && userEmail) {
      try {
        if (CREDIT_SHAPED_EMAIL_TYPES.has(input.type)) {
          await sendRewardEmail(userEmail, { title: copy.title, amount: input.amount ?? 0, description: input.description }, userName);
        } else {
          await sendNotificationEmail(userEmail, copy, userName);
        }
        await setChannelStatus(notification._id, "email", "SENT");
      } catch (err) {
        // Never let an email failure surface to the caller — the reward (and
        // even the notification record itself) already succeeded.
        console.error("Reward notification email failed:", err);
        await setChannelStatus(notification._id, "email", "FAILED", err instanceof Error ? err.message : "Unknown error");
      }
    }

    return { success: true, duplicate: false };
  } catch (err) {
    console.error("notifyRewardEvent failed:", err);
    return { success: false, duplicate: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
