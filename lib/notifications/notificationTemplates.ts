import type { NotificationType } from "@/models/Notification";

/**
 * Pure copy-building functions for TRANSACTIONAL notifications — every call
 * site passes trusted data it already has (amount from the actual
 * DamruTransaction/Order, dates from the actual document). Nothing here
 * invents or hardcodes a reward amount, order status, or payment result
 * (PRD 4B v2 sections 13/14/64/65/66). Promotional/campaign copy is
 * user-authored via NotificationTemplate + templateRenderer.ts instead —
 * this file is exclusively for system-triggered transactional events.
 */
export interface NotificationContext {
  amount?: number;
  description?: string;
  expiresAt?: Date | string | null;
  orderNumber?: string;
  couponCode?: string;
  couponDescription?: string;
  couponExpiryDate?: Date | string | null;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

export interface NotificationCopy {
  title: string;
  message: string;
}

export function buildNotificationCopy(type: NotificationType, ctx: NotificationContext): NotificationCopy {
  const amount = ctx.amount ?? 0;
  const description = ctx.description?.trim();
  const order = ctx.orderNumber ? `#${ctx.orderNumber}` : "your order";

  switch (type) {
    // Rewards
    case "DAMRU_CREDITED":
      return { title: "💰 Damru Credited", message: `+${amount} Damru added${description ? ` — ${description}` : ""}` };
    case "DAMRU_REDEEMED":
      return { title: "Damru Redeemed", message: `${amount} Damru redeemed — applied to ${order}.` };
    case "DAILY_CHECKIN_REWARD":
      return { title: "🔥 Daily Check-In Complete", message: `+${amount} Damru${description ? ` — ${description}` : ""}` };
    case "STREAK_MILESTONE":
      return { title: "🔥 Streak Milestone", message: description || "You've hit a new streak milestone!" };
    case "ACHIEVEMENT_UNLOCKED":
      return { title: "🏆 Achievement Unlocked", message: `${description || "An achievement"} — +${amount} Damru earned` };
    case "MISSION_COMPLETED":
      return { title: "🎯 Mission Completed", message: `${description || "A mission"} — +${amount} Damru earned` };
    case "REFERRAL_REGISTERED":
      return { title: "👥 Referral Registered", message: description || "Your referral signed up successfully." };
    case "REFERRAL_QUALIFIED":
      return { title: "👥 Referral Qualified", message: description || "Your referral just qualified for a reward." };
    case "REFERRAL_REWARDED":
      return { title: "👥 Referral Reward Earned", message: `${description || "Your referral reward is here"} — +${amount} Damru` };
    case "BIRTHDAY_REWARD":
      return { title: "🎂 Happy Birthday", message: `Your birthday reward is ready — +${amount} Damru${description ? ` (${description})` : ""}` };
    case "MARRIAGE_ANNIVERSARY_REWARD":
      return { title: "💍 Happy Anniversary", message: `Your anniversary reward is ready — +${amount} Damru${description ? ` (${description})` : ""}` };
    case "ACCOUNT_ANNIVERSARY_REWARD":
      return { title: "🎉 Account Anniversary", message: `Thanks for being with us — +${amount} Damru${description ? ` (${description})` : ""}` };
    case "LOYALTY_TIER_UPGRADED":
      return {
        title: "⭐ Loyalty Tier Upgrade",
        message: amount > 0 ? `${description || "You reached a new tier"} — +${amount} Damru bonus` : (description || "You reached a new loyalty tier — new benefits are now active."),
      };
    case "LOYALTY_BENEFIT_AVAILABLE":
      return { title: "⭐ New Loyalty Benefit", message: description || "A new loyalty benefit is now available to you." };
    case "COUPON_ISSUED":
      return {
        title: "🎟 New Reward Coupon",
        message: `${ctx.couponDescription || ctx.couponCode || "A new coupon"}${ctx.couponExpiryDate ? ` — valid until ${fmtDate(ctx.couponExpiryDate)}` : ""}`,
      };
    case "DAMRU_EXPIRING_SOON":
      return { title: "⏳ Damru Expiring Soon", message: `${amount} Damru expiring soon — use them before ${fmtDate(ctx.expiresAt)}.` };
    case "DAMRU_EXPIRED":
      return { title: "Damru Expired", message: `${amount} Damru expired — expired Damru has been removed from your wallet.` };
    case "DAMRU_RESTORED":
      return { title: "↩️ Damru Restored", message: `${amount} Damru has been returned to your wallet${description ? ` — ${description}` : ""}` };

    // Orders
    case "ORDER_PLACED":
      return { title: "Order Confirmed 🎉", message: `Your order ${order} has been placed successfully.` };
    case "ORDER_CONFIRMED":
      return { title: "Order Confirmed", message: `Order ${order} has been confirmed by the restaurant.` };
    case "ORDER_PREPARING":
      return { title: "Order Being Prepared 👨‍🍳", message: `Order ${order} is being prepared.` };
    case "ORDER_OUT_FOR_DELIVERY":
      return { title: "Your order is on the way 🛵", message: `Order ${order} is out for delivery.` };
    case "ORDER_DELIVERED":
      return { title: "Order Delivered ✅", message: `Order ${order} has been delivered. Enjoy your meal!` };
    case "ORDER_CANCELLED":
      return { title: "Order Cancelled", message: `Order ${order} has been cancelled.${description ? ` ${description}` : ""}` };

    // Payments
    case "PAYMENT_SUCCESSFUL":
      return { title: "Payment Successful ✅", message: `Your payment for ${order} was successful.` };
    case "PAYMENT_FAILED":
      return { title: "Payment Failed", message: `Your payment for ${order} could not be completed.${description ? ` ${description}` : ""}` };
    case "COD_CONFIRMED":
      return { title: "Order Confirmed — Pay on Delivery", message: `${order} is confirmed for Cash on Delivery.` };

    // Refunds
    case "REFUND_PROCESSING":
      return { title: "Refund In Progress", message: `A refund of ₹${amount} for ${order} is being processed.` };
    case "REFUND_PROCESSED":
      return { title: "Refund Processed ✅", message: `₹${amount} has been refunded for ${order}.` };
    case "REFUND_FAILED":
      return { title: "Refund Failed", message: `We couldn't process your refund for ${order}. Our team has been notified.` };

    // Account
    case "WELCOME":
      return { title: "Welcome to Damru By Namo 🎉", message: description || "Your account is ready — explore rewards and place your first order." };
    case "PASSWORD_CHANGED":
      return { title: "Password Changed", message: "Your account password was just changed. If this wasn't you, please contact support immediately." };

    case "PROMOTIONAL_CAMPAIGN":
      return { title: description || "New update", message: description || "" };

    default:
      return { title: "Notification", message: description || "You have a new update." };
  }
}
