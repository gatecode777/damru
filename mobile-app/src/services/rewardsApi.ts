import { get, patch } from "@/lib/api";
import type {
  RewardsDashboard, RewardsHistoryPage, RewardsUpcoming, RewardCoupon, AchievementsResponse, MissionsResponse, ReferralsResponse, LoyaltyResponse,
} from "@/types/rewards";

export const getRewardsDashboard = () => get<RewardsDashboard>("/api/rewards/dashboard");
export type ActiveRewardCampaign={_id:string;name:string;description:string;campaignType:string;rewardMode:string;rewardValue:number;minimumOrderAmount:number;endsAt:string};
export const getActiveRewardCampaigns=()=>get<{campaigns:ActiveRewardCampaign[]}>("/api/rewards/campaigns");

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

export async function updateOccasionDetails(field: "dateOfBirth" | "marriageAnniversary", value: string): Promise<{ success: boolean; error?: string }> {
  const action = field === "dateOfBirth" ? "updateDateOfBirth" : "updateMarriageAnniversary";
  try {
    await patch("/api/user/me", { action, [field]: value });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Could not save date." };
  }
}
