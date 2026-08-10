import { get, post, patch } from "@/lib/api";
import type {
  RewardsDashboard, RewardsHistoryPage, RewardsUpcoming, RedeemResult, RewardCoupon, AchievementsResponse, MissionsResponse, ReferralsResponse, LoyaltyResponse,
} from "@/types/rewards";

export const getRewardsDashboard = () => get<RewardsDashboard>("/api/rewards/dashboard");

export const getRewardHistory = (page = 1, limit = 20) =>
  get<RewardsHistoryPage>(`/api/rewards/history?page=${page}&limit=${limit}`);

export const getRewardCoupons = () => get<{ coupons: RewardCoupon[] }>("/api/rewards/coupons");

export const getUpcomingRewards = () => get<RewardsUpcoming>("/api/rewards/upcoming");

export const getAchievements = () => get<AchievementsResponse>("/api/rewards/achievements");

export const getMissions = () => get<MissionsResponse>("/api/rewards/missions");

export const getReferrals = (page = 1, limit = 20) =>
  get<ReferralsResponse>(`/api/rewards/referrals?page=${page}&limit=${limit}`);
export const getLoyalty = () => get<LoyaltyResponse>("/api/rewards/loyalty");
export const getRewardsExpiry = () => get<RewardsDashboard["expiry"] & { breakdown?: unknown[] }>("/api/rewards/expiry");

export async function redeemDamru(orderId: string, amount: number): Promise<RedeemResult> {
  try {
    const data = await post<{ success: boolean; discount: number; newBalance: number }>("/api/rewards/redeem", { orderId, amount });
    return { success: true, discount: data.discount, newBalance: data.newBalance };
  } catch (err: any) {
    return { success: false, error: err?.message || "Redemption failed." };
  }
}

export async function updateOccasionDetails(field: "dateOfBirth" | "marriageAnniversary", value: string): Promise<{ success: boolean; error?: string }> {
  const action = field === "dateOfBirth" ? "updateDateOfBirth" : "updateMarriageAnniversary";
  try {
    await patch("/api/user/me", { action, [field]: value });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Could not save date." };
  }
}
