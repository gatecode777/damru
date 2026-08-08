export type RewardAnalyticsEvent =
  | "rewards_viewed"
  | "coupon_copied"
  | "coupon_used"
  | "damru_redeemed"
  | "birthday_added"
  | "anniversary_added"
  | "achievements_viewed"
  | "achievement_unlocked"
  | "achievement_detail_viewed"
  | "missions_viewed"
  | "mission_detail_viewed"
  | "mission_completed"
  | "referral_screen_viewed"
  | "referral_code_copied"
  | "referral_link_copied"
  | "referral_shared"
  | "referral_code_applied"
  | "referral_qualified"
  | "referral_rewarded"
  | "loyalty_viewed"
  | "loyalty_tier_changed"
  | "loyalty_progress_viewed"
  | "expiry_warning_viewed"
  | "expiry_details_viewed"
  | "shop_from_expiry_warning";

/**
 * No analytics SDK is wired into this codebase yet. This stub keeps event
 * names/shapes stable so a real sink (GA, PostHog, etc.) can be dropped in
 * later without touching call sites. Never pass raw date values in `meta` —
 * birthday/anniversary events should only signal that the action happened.
 */
export function trackRewardEvent(event: RewardAnalyticsEvent, meta?: Record<string, string | number | boolean>) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[rewards-analytics] ${event}`, meta || {});
  }
}
