import type {
  RewardsDashboard, RewardsHistoryPage, RewardsUpcoming, RedeemResult, RewardCoupon, AchievementsResponse, MissionsResponse, ReferralsResponse, LoyaltyResponse,
} from "./rewardTypes";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}

export function getDashboard() {
  return getJson<RewardsDashboard & { error?: string }>("/api/rewards/dashboard");
}

export function getHistory(page = 1, limit = 20) {
  return getJson<RewardsHistoryPage & { error?: string }>(`/api/rewards/history?page=${page}&limit=${limit}`);
}

export function getCoupons() {
  return getJson<{ coupons: RewardCoupon[] }>("/api/rewards/coupons");
}

export function getUpcoming() {
  return getJson<RewardsUpcoming & { error?: string }>("/api/rewards/upcoming");
}

export function getAchievements() {
  return getJson<AchievementsResponse & { error?: string }>("/api/rewards/achievements");
}

export function getMissions() {
  return getJson<MissionsResponse & { error?: string }>("/api/rewards/missions");
}

export function getReferrals(page = 1, limit = 20) {
  return getJson<ReferralsResponse & { error?: string }>(`/api/rewards/referrals?page=${page}&limit=${limit}`);
}
export function getLoyalty() { return getJson<LoyaltyResponse & { error?: string }>("/api/rewards/loyalty"); }

export async function redeemDamru(orderId: string, amount: number): Promise<RedeemResult> {
  const res = await fetch("/api/rewards/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amount }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return { success: false, error: data.error || "Redemption failed." };
  return { success: true, discount: data.discount, newBalance: data.newBalance };
}

export async function updateDateOfBirth(dateOfBirth: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/user/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "updateDateOfBirth", dateOfBirth }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return { success: false, error: data.error || "Could not save date of birth." };
  return { success: true };
}

export async function updateMarriageAnniversary(marriageAnniversary: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/user/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "updateMarriageAnniversary", marriageAnniversary }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return { success: false, error: data.error || "Could not save anniversary date." };
  return { success: true };
}
