export type RewardAnalyticsEvent =
  | "rewards_viewed"
  | "reward_history_viewed"
  | "coupon_copied"
  | "coupon_shop_clicked"
  | "damru_redemption_started"
  | "damru_redemption_succeeded"
  | "damru_redemption_failed"
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

/** No analytics SDK exists in this app yet — dev-only console stub, never pass raw dates. */
export function trackRewardEvent(event: RewardAnalyticsEvent, meta?: Record<string, string | number | boolean>) {
  if (__DEV__) {
    console.debug(`[rewards-analytics] ${event}`, meta || {});
  }
}
