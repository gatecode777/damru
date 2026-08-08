export type LoyaltyLevel = "bronze" | "silver" | "gold" | "platinum";

export type DamruTransactionCategory =
  | "welcome_registration"
  | "birthday"
  | "marriage_anniversary"
  | "account_anniversary"
  | "first_order"
  | "daily_login"
  | "achievement"
  | "mission"
  | "referral"
  | "order_reward"
  | "loyalty_tier"
  | "redemption"
  | "admin_credit"
  | "admin_debit"
  | "refund_restore"
  | "expiry"
  | "legacy_opening_balance";

export type RewardCoupon = {
  _id: string;
  code: string;
  description: string;
  type: "flat" | "percentage";
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  usageLimit?: number | null;
  usedCount?: number;
  expiryDate: string | null;
};

export type RewardTransaction = {
  _id: string;
  type: "credit" | "debit";
  category: DamruTransactionCategory;
  amount: number;
  balanceAfter?: number;
  description: string;
  createdAt: string;
  expiresAt?: string | null;
};

export type RewardsExpiry = {
  enabled: boolean;
  expiringSoonAmount: number;
  nearestExpiryDate: string | null;
  warningDays: number;
};

export type DailyStreakInfo = {
  isActive: boolean;
  currentStreak: number;
  longestStreak: number;
  claimedToday: boolean;
  nextRewardDay: number;
  nextRewardAmount: number;
  cycleLength: number;
  days: { day: number; amount: number }[];
};

export type AchievementSummaryEntry = {
  id: string;
  name: string;
  badgeName: string | null;
  badgeIcon: string | null;
  unlockedAt: string;
};

export type AchievementSummary = {
  unlocked: number;
  total: number;
  recentlyUnlocked: AchievementSummaryEntry[];
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  category: string;
  progress: number;
  target: number;
  progressPercentage: number;
  status: "IN_PROGRESS" | "COMPLETED" | "CLAIMED";
  badgeName: string | null;
  badgeIcon: string | null;
  reward: { type: "damru" | "badge" | "damru_badge"; damruAmount: number };
  unlockedAt: string | null;
};

export type AchievementsResponse = {
  summary: { total: number; unlocked: number; inProgress: number };
  achievements: Achievement[];
};

export type MissionSummaryEntry = {
  id: string;
  name: string;
  progress: number;
  target: number;
  progressPercentage: number;
  damruAmount: number;
};

export type MissionSummary = {
  active: number;
  completed: number;
  featured: MissionSummaryEntry[];
};

export type Mission = {
  id: string;
  name: string;
  description: string;
  missionType: string;
  periodType: string;
  progress: number;
  target: number;
  progressPercentage: number;
  status: "IN_PROGRESS" | "COMPLETED" | "CLAIMED" | "EXPIRED";
  reward: { damruAmount: number };
  startsAt: string | null;
  endsAt: string | null;
  timeRemaining: number | null;
};

export type MissionsResponse = {
  summary: { active: number; completed: number; expiringSoon: number };
  missions: Mission[];
};

export type ReferralSummary = {
  successful: number;
  pending: number;
  totalDamruEarned: number;
  referralCode: string;
};

export type ReferralHistoryEntry = {
  id: string;
  status: "REGISTERED" | "PENDING_QUALIFICATION" | "QUALIFIED" | "REWARDED" | "REJECTED" | "CANCELLED";
  registeredAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  rewardAmount: number;
  referredName: string | null;
};

export type ReferralsResponse = {
  referralCode: string;
  share: { message: string; link: string };
  summary: { total: number; pending: number; successful: number; totalDamruEarned: number };
  referrals: ReferralHistoryEntry[];
  page: number;
  limit: number;
  totalPages: number;
};

export type RewardsDashboard = {
  damruBalance: number;
  damruTotalEarned: number;
  damruTotalRedeemed: number;
  loyaltyLevel: LoyaltyLevel;
  nextLevel: LoyaltyLevel | null;
  damruToNextLevel: number;
  activeCoupons: RewardCoupon[];
  recentTransactions: RewardTransaction[];
  streak: DailyStreakInfo;
  achievementSummary: AchievementSummary;
  missionSummary: MissionSummary;
  referralSummary: ReferralSummary;
  loyalty: LoyaltyDashboardSummary;
  expiry: RewardsExpiry;
};

export type LoyaltyTierSummary = { id: string; code: string; name: string; rank: number; badgeName: string | null; badgeIcon: string | null; damruMultiplier: number };
export type LoyaltyDashboardSummary = { currentTier: LoyaltyTierSummary | null; nextTier: (LoyaltyTierSummary & { minimumValue: number }) | null; progressPercentage: number; remainingValue: number };
export type LoyaltyResponse = { currentTier: LoyaltyTierSummary | null; qualification: { type: string; currentValue: number } | null; nextTier: (LoyaltyTierSummary & { minimumValue: number }) | null; progress: { percentage: number; remainingValue: number }; benefits: string[]; tiers: (LoyaltyTierSummary & { minimumValue: number; maximumValue: number | null; benefits: string[] })[] };

export type RewardsHistoryPage = {
  transactions: RewardTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RewardsUpcoming = {
  birthdayDaysLeft: number | null;
  anniversaryDaysLeft: number | null;
  dateOfBirth: string | null;
  marriageAnniversary: string | null;
  nextLoyaltyLevel: LoyaltyLevel | null;
  damruToNextLevel: number;
};

export type RedeemResult = {
  success: boolean;
  discount?: number;
  newBalance?: number;
  error?: string;
};
