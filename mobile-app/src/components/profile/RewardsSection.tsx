import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "@/config";
import { queryKeys } from "@/lib/queryClient";
import { getRewardsDashboard, getUpcomingRewards, updateOccasionDetails } from "@/services/rewardsApi";
import { trackRewardEvent } from "@/lib/rewardsAnalytics";
import { EmptyState } from "@/components/ui";
import type { RewardsDashboard, RewardsUpcoming } from "@/types/rewards";
import { getApiErrorMessage } from "@/lib/api";

const LEVEL_LABEL: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };

function OccasionField({ label, icon, daysLeft, date, saving, error, onSave }: {
  label: string; icon: string; daysLeft: number | null; date: string | null; saving: boolean; error: string;
  onSave: (isoDate: string) => void;
}) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [localError, setLocalError] = useState("");

  if (daysLeft !== null) {
    return (
      <View style={styles.occasionRow}>
        <Text style={styles.occasionLabel}>{icon} {label}</Text>
        <View style={styles.lockedPill}>
          <Ionicons name="lock-closed" size={11} color="#a99c94" />
          <Text style={styles.lockedText}>
            {date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "Set"} — contact support to change
          </Text>
        </View>
      </View>
    );
  }

  function submit() {
    setLocalError("");
    const d = Number(day), m = Number(month), y = Number(year);
    if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
      setLocalError("Enter a valid date.");
      return;
    }
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onSave(iso);
  }

  return (
    <View style={styles.occasionBlock}>
      <Text style={styles.occasionLabel}>{icon} {label}</Text>
      <View style={styles.dateInputsRow}>
        <TextInput style={styles.dateInput} placeholder="DD" placeholderTextColor="#a89b93" keyboardType="number-pad" maxLength={2} value={day} onChangeText={setDay} />
        <TextInput style={styles.dateInput} placeholder="MM" placeholderTextColor="#a89b93" keyboardType="number-pad" maxLength={2} value={month} onChangeText={setMonth} />
        <TextInput style={[styles.dateInput, { flex: 1.4 }]} placeholder="YYYY" placeholderTextColor="#a89b93" keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} />
        <Pressable style={styles.saveBtn} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>
      <Text style={styles.warningText}>Please confirm this date is correct. After saving, future changes require support approval.</Text>
      {(localError || error) ? <Text style={styles.errorText}>{localError || error}</Text> : null}
    </View>
  );
}

export function RewardsSection({ onToast }: { onToast: (msg: string) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState("");
  const [annivSaving, setAnnivSaving] = useState(false);
  const [annivError, setAnnivError] = useState("");

  const dashboardQuery = useQuery({
    queryKey: queryKeys.rewards.dashboard(),
    queryFn: getRewardsDashboard,
    staleTime: 30 * 1000,
  });
  const upcomingQuery = useQuery({
    queryKey: queryKeys.rewards.upcoming(),
    queryFn: getUpcomingRewards,
    staleTime: 30 * 1000,
  });

  React.useEffect(() => { trackRewardEvent("rewards_viewed"); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([dashboardQuery.refetch(), upcomingQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function copyCoupon(code: string) {
    await Clipboard.setStringAsync(code);
    onToast(`Code "${code}" copied!`);
    trackRewardEvent("coupon_copied");
  }

  async function saveDob(iso: string) {
    setDobSaving(true); setDobError("");
    const res = await updateOccasionDetails("dateOfBirth", iso);
    setDobSaving(false);
    if (!res.success) { setDobError(res.error || "Could not save."); return; }
    trackRewardEvent("birthday_added");
    queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    queryClient.invalidateQueries({ queryKey: queryKeys.rewards.upcoming() });
    onToast("Date of birth saved!");
  }

  async function saveAnniv(iso: string) {
    setAnnivSaving(true); setAnnivError("");
    const res = await updateOccasionDetails("marriageAnniversary", iso);
    setAnnivSaving(false);
    if (!res.success) { setAnnivError(res.error || "Could not save."); return; }
    trackRewardEvent("anniversary_added");
    queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    queryClient.invalidateQueries({ queryKey: queryKeys.rewards.upcoming() });
    onToast("Anniversary date saved!");
  }

  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.error ? getApiErrorMessage(dashboardQuery.error, "Unable to load your rewards dashboard.") : null;
  const dashboard = dashboardQuery.data as RewardsDashboard | undefined;
  const upcoming = upcomingQuery.data as RewardsUpcoming | undefined;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.orange} /></View>;
  }

  if (error || !dashboard) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Could not load your rewards."}</Text>
        <Pressable style={styles.retryBtn} onPress={() => dashboardQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={React.createElement(RefreshControl as any, { refreshing, onRefresh: handleRefresh, colors: [colors.orange] })}
    >
      {/* Wallet */}
      <View style={styles.walletGrid}>
        <View style={styles.walletStat}>
          <Text style={styles.walletLabel}>Available</Text>
          <Text style={styles.walletValue}>{dashboard.damruBalance}</Text>
        </View>
        <View style={styles.walletStat}>
          <Text style={styles.walletLabel}>Lifetime Earned</Text>
          <Text style={styles.walletValue}>{dashboard.damruTotalEarned}</Text>
        </View>
        <View style={styles.walletStat}>
          <Text style={styles.walletLabel}>Redeemed</Text>
          <Text style={styles.walletValue}>{dashboard.damruTotalRedeemed}</Text>
        </View>
        <View style={styles.walletStat}>
          <Text style={styles.walletLabel}>Tier</Text>
          <Text style={styles.walletValue}>{LEVEL_LABEL[dashboard.loyaltyLevel] || dashboard.loyaltyLevel}</Text>
        </View>
      </View>
      {dashboard.nextLevel && (
        <Text style={styles.nextLevelText}>{dashboard.damruToNextLevel} Damru to reach {LEVEL_LABEL[dashboard.nextLevel]}</Text>
      )}
      {dashboard.expiry?.expiringSoonAmount > 0 && (
        <Text style={styles.expiryHint}>⚠ {dashboard.expiry.expiringSoonAmount} Damru expiring within {dashboard.expiry.warningDays} days</Text>
      )}

      {dashboard.expiry?.expiringSoonAmount > 0 && (
        <View style={styles.expiryCard}>
          <Text style={styles.expiryTitle}>⚠ {dashboard.expiry.expiringSoonAmount} Damru expiring soon</Text>
          {dashboard.expiry.nearestExpiryDate && (
            <Text style={styles.expirySub}>
              Expires by {new Date(dashboard.expiry.nearestExpiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
            </Text>
          )}
          <Text style={styles.expirySub}>Use your Damru before they expire.</Text>
          <Pressable style={styles.expiryShopBtn} onPress={() => { trackRewardEvent("shop_from_expiry_warning"); router.push("/menu"); }}>
            <Text style={styles.expiryShopBtnText}>Shop Now</Text>
          </Pressable>
        </View>
      )}

      {dashboard.loyalty?.currentTier && (
        <Pressable style={styles.loyaltyCard} onPress={() => { trackRewardEvent("loyalty_viewed"); router.push("/rewards-loyalty" as any); }}>
          <View style={styles.streakRow}>
            <View><Text style={styles.loyaltyName}>{dashboard.loyalty.currentTier.badgeIcon || "★"} {dashboard.loyalty.currentTier.name} Member</Text><Text style={styles.streakSub}>{dashboard.loyalty.currentTier.damruMultiplier}x eligible order rewards</Text></View>
            <Text style={styles.viewAllText}>Details</Text>
          </View>
          <View style={styles.progressTrackMini}><View style={[styles.progressFillMini, { width: `${dashboard.loyalty.progressPercentage}%` }]} /></View>
          <Text style={styles.nextLevelText}>{dashboard.loyalty.nextTier ? `${dashboard.loyalty.remainingValue} remaining to ${dashboard.loyalty.nextTier.name}` : "Highest tier reached"}</Text>
        </Pressable>
      )}

      {/* Daily Streak */}
      {dashboard.streak?.isActive && (
        <>
          <Text style={styles.sectionTitle}>Daily Streak 🔥</Text>
          <View style={styles.streakCard}>
            <View style={styles.streakRow}>
              <View>
                <Text style={styles.streakCurrent}>{dashboard.streak.currentStreak} Day{dashboard.streak.currentStreak === 1 ? "" : "s"}</Text>
                <Text style={styles.streakSub}>Longest: {dashboard.streak.longestStreak} day{dashboard.streak.longestStreak === 1 ? "" : "s"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.streakSub}>{dashboard.streak.claimedToday ? "Next reward" : "Check in today for"}</Text>
                <Text style={styles.streakNext}>+{dashboard.streak.nextRewardAmount} Damru</Text>
              </View>
            </View>
            <View style={styles.streakDots}>
              {dashboard.streak.days.map(d => {
                const cyclePos = ((dashboard.streak.currentStreak - 1) % Math.max(1, dashboard.streak.cycleLength)) + 1;
                const isToday = dashboard.streak.claimedToday && d.day === cyclePos;
                const isNext = !dashboard.streak.claimedToday && d.day === dashboard.streak.nextRewardDay;
                return (
                  <View key={d.day} style={[styles.streakDot, isToday && styles.streakDotDone, isNext && styles.streakDotNext]}>
                    <Text style={[styles.streakDotDay, isToday && styles.streakDotDoneText, isNext && styles.streakDotNextText]}>{d.day}</Text>
                    <Text style={[styles.streakDotAmount, isToday && styles.streakDotDoneText, isNext && styles.streakDotNextText]}>{d.amount}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.streakFooter}>
              {dashboard.streak.claimedToday ? "✓ Today's streak reward has been credited." : "Visit again tomorrow to keep your streak alive."}
            </Text>
          </View>
        </>
      )}

      {/* Missions */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Missions</Text>
        <Pressable onPress={() => { trackRewardEvent("missions_viewed"); router.push("/rewards-missions" as any); }}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      {dashboard.missionSummary && (dashboard.missionSummary.active > 0 || dashboard.missionSummary.completed > 0) ? (
        <View style={styles.achievementSummaryCard}>
          <Text style={styles.achievementSummaryText}>
            {dashboard.missionSummary.active} Active{dashboard.missionSummary.completed > 0 ? ` · ${dashboard.missionSummary.completed} Completed` : ""}
          </Text>
          {dashboard.missionSummary.featured.map(m => (
            <View key={m.id} style={{ marginTop: 10 }}>
              <Text style={styles.missionFeaturedName}>{m.name}</Text>
              <Text style={styles.missionFeaturedProgress}>{m.progress} / {m.target} · {m.progressPercentage}%</Text>
              <View style={styles.progressTrackMini}>
                <View style={[styles.progressFillMini, { width: `${m.progressPercentage}%` }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyInline}>No missions available right now.</Text>
      )}

      {/* Achievements */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Pressable onPress={() => { trackRewardEvent("achievements_viewed"); router.push("/rewards-achievements" as any); }}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      {dashboard.achievementSummary ? (
        <View style={styles.achievementSummaryCard}>
          <Text style={styles.achievementSummaryText}>
            {dashboard.achievementSummary.unlocked} / {dashboard.achievementSummary.total} Unlocked
          </Text>
          {dashboard.achievementSummary.recentlyUnlocked.length > 0 && (
            <View style={styles.achievementBadgeRow}>
              {dashboard.achievementSummary.recentlyUnlocked.map(a => (
                <View key={a.id} style={styles.achievementBadgePill}>
                  <Text style={styles.achievementBadgeText}>{a.badgeIcon || "🏆"} {a.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.emptyInline}>No achievements yet.</Text>
      )}

      {/* Invite & Earn */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Invite & Earn</Text>
        <Pressable onPress={() => { trackRewardEvent("referral_screen_viewed"); router.push("/rewards-referrals" as any); }}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      {dashboard.referralSummary ? (
        <View style={styles.achievementSummaryCard}>
          <Text style={styles.achievementSummaryText}>
            {dashboard.referralSummary.successful} Successful{dashboard.referralSummary.pending > 0 ? ` · ${dashboard.referralSummary.pending} Pending` : ""}
          </Text>
          <Text style={styles.missionFeaturedProgress}>{dashboard.referralSummary.totalDamruEarned} Damru Earned</Text>
        </View>
      ) : (
        <Text style={styles.emptyInline}>Invite friends to start earning.</Text>
      )}

      {/* Upcoming */}
      <Text style={styles.sectionTitle}>Upcoming Rewards</Text>
      {upcomingQuery.isLoading ? (
        <ActivityIndicator color={colors.orange} style={{ marginVertical: 16 }} />
      ) : upcomingQuery.error ? (
        <View style={styles.sectionError}>
          <Text style={styles.errorText}>{getApiErrorMessage(upcomingQuery.error, "Unable to load upcoming rewards.")}</Text>
          <Pressable style={styles.retryBtn} onPress={() => upcomingQuery.refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.upcomingGrid}>
          <View style={styles.upcomingCard}>
            <Text style={styles.upcomingLabel}>🎂 Birthday</Text>
            <Text style={styles.upcomingValue}>{upcoming?.birthdayDaysLeft != null ? `${upcoming.birthdayDaysLeft} Days Left` : "Not set"}</Text>
          </View>
          <View style={styles.upcomingCard}>
            <Text style={styles.upcomingLabel}>💍 Anniversary</Text>
            <Text style={styles.upcomingValue}>{upcoming?.anniversaryDaysLeft != null ? `${upcoming.anniversaryDaysLeft} Days Left` : "Not set"}</Text>
          </View>
        </View>
      )}

      {/* Recent activity */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <Pressable onPress={() => { trackRewardEvent("reward_history_viewed"); router.push("/rewards-history" as any); }}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>
      {dashboard.recentTransactions.length === 0 ? (
        <Text style={styles.emptyInline}>No Damru activity yet.</Text>
      ) : dashboard.recentTransactions.map(tx => (
        <View key={tx._id} style={styles.txRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txDesc}>{tx.description || tx.category}</Text>
            <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text>
          </View>
          <Text style={[styles.txAmount, { color: tx.type === "credit" ? colors.green : colors.danger }]}>
            {tx.type === "credit" ? "+" : "−"}{tx.amount}
          </Text>
        </View>
      ))}

      {/* Coupons */}
      <Text style={styles.sectionTitle}>Active Coupons</Text>
      {dashboard.activeCoupons.length === 0 ? (
        <EmptyState title="No active coupons" message="Earn Damru to unlock reward coupons." />
      ) : dashboard.activeCoupons.map(c => (
        <View key={c._id} style={styles.couponCard}>
          <View style={styles.couponHeader}>
            <View style={styles.codeBadge}><Text style={styles.codeText}>{c.code}</Text></View>
            {c.expiryDate ? <Text style={styles.expiryText}>Till {new Date(c.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Text> : null}
          </View>
          <Text style={styles.couponDesc}>
            {c.description || (c.type === "flat" ? `₹${c.value} OFF` : `${c.value}% OFF${c.maxDiscount ? ` (max ₹${c.maxDiscount})` : ""}`)}
            {c.minOrderValue > 0 ? ` · Min ₹${c.minOrderValue}` : ""}
          </Text>
          <View style={styles.couponActions}>
            <Pressable style={styles.couponActionBtn} onPress={() => copyCoupon(c.code)}>
              <Text style={styles.couponActionText}>Copy</Text>
            </Pressable>
            <Pressable style={[styles.couponActionBtn, styles.shopBtn]} onPress={() => { trackRewardEvent("coupon_shop_clicked"); router.push("/menu"); }}>
              <Text style={[styles.couponActionText, { color: "#fff" }]}>Shop Now</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Occasion profile */}
      <Text style={styles.sectionTitle}>Occasion Profile</Text>
      <View style={styles.occasionCard}>
        <OccasionField label="Date of Birth" icon="🎂" daysLeft={upcoming?.birthdayDaysLeft ?? null} date={upcoming?.dateOfBirth ?? null} saving={dobSaving} error={dobError} onSave={saveDob} />
        <View style={styles.divider} />
        <OccasionField label="Marriage Anniversary" icon="💍" daysLeft={upcoming?.anniversaryDaysLeft ?? null} date={upcoming?.marriageAnniversary ?? null} saving={annivSaving} error={annivError} onSave={saveAnniv} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 150 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
  sectionError: { alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 14, padding: 16, marginBottom: 10 },
  walletGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  walletStat: { width: "47%", backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fde3c8", borderRadius: 14, padding: 14 },
  walletLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: "#9a7b52", textTransform: "uppercase", marginBottom: 4 },
  walletValue: { fontFamily: "Poppins_700Bold", fontSize: 20, color: colors.orange },
  nextLevelText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#756860", marginTop: 8, marginBottom: 4 },
  expiryHint: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#c2410c", marginTop: 2, marginBottom: 4 },
  expiryCard: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 16, padding: 14, marginTop: 14 },
  expiryTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#92400e", marginBottom: 4 },
  expirySub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#92400e", marginBottom: 6 },
  expiryShopBtn: { backgroundColor: colors.orange, borderRadius: 10, paddingVertical: 9, alignItems: "center", marginTop: 6 },
  expiryShopBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#fff" },
  loyaltyCard: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fde3c8", borderRadius: 16, padding: 14, marginTop: 14 },
  loyaltyName: { fontFamily: "Poppins_700Bold", fontSize: 17, color: colors.orange },
  sectionTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: colors.ink, marginTop: 22, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
  viewAllText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  streakCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 16, padding: 14 },
  streakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  streakCurrent: { fontFamily: "Poppins_700Bold", fontSize: 20, color: colors.orange },
  streakSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94", marginTop: 2 },
  streakNext: { fontFamily: "Poppins_700Bold", fontSize: 15, color: colors.green },
  streakDots: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  streakDot: { minWidth: 42, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#faf7f3", borderWidth: 1, borderColor: "#eee" },
  streakDotDay: { fontFamily: "Poppins_700Bold", fontSize: 12, color: "#a99c94" },
  streakDotAmount: { fontFamily: "Poppins_400Regular", fontSize: 10, color: "#c2b6ab" },
  streakDotDone: { backgroundColor: "#eafaf0", borderColor: "#bbf7d0" },
  streakDotNext: { backgroundColor: "#fff7ed", borderColor: "#fde3c8" },
  streakDotDoneText: { color: colors.green },
  streakDotNextText: { color: colors.orange },
  streakFooter: { fontFamily: "Poppins_400Regular", fontSize: 11.5, color: "#a99c94", marginTop: 10 },
  achievementSummaryCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 14, padding: 14 },
  achievementSummaryText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: colors.ink },
  achievementBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  achievementBadgePill: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fde3c8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  achievementBadgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: colors.orange },
  missionFeaturedName: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 3 },
  missionFeaturedProgress: { fontFamily: "Poppins_400Regular", fontSize: 11.5, color: "#a99c94", marginBottom: 5 },
  progressTrackMini: { height: 5, borderRadius: 5, backgroundColor: "#f3ece6", overflow: "hidden" },
  progressFillMini: { height: "100%", borderRadius: 5, backgroundColor: colors.orange },
  upcomingGrid: { flexDirection: "row", gap: 10 },
  upcomingCard: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 14, padding: 12 },
  upcomingLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: "#a99c94", marginBottom: 4 },
  upcomingValue: { fontFamily: "Poppins_700Bold", fontSize: 13, color: colors.ink },
  emptyInline: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#a99c94" },
  txRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3ece6" },
  txDesc: { fontFamily: "Poppins_500Medium", fontSize: 13, color: colors.ink, marginBottom: 2 },
  txDate: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94" },
  txAmount: { fontFamily: "Poppins_700Bold", fontSize: 14 },
  couponCard: { backgroundColor: "#fffdfb", borderWidth: 1, borderColor: "#fcf0e4", borderRadius: 16, padding: 14, marginBottom: 10 },
  couponHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  codeBadge: { backgroundColor: "rgba(229, 121, 34, 0.08)", borderWidth: 1, borderColor: "rgba(229, 121, 34, 0.2)", borderStyle: "dashed", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  codeText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange, letterSpacing: 0.5 },
  expiryText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#a99c94" },
  couponDesc: { fontFamily: "Poppins_500Medium", fontSize: 12.5, color: "#756860", marginBottom: 10 },
  couponActions: { flexDirection: "row", gap: 8 },
  couponActionBtn: { flex: 1, borderWidth: 1, borderColor: "#eee3da", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  shopBtn: { backgroundColor: colors.orange, borderColor: colors.orange },
  couponActionText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  occasionCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 16, padding: 16 },
  occasionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  occasionBlock: { paddingVertical: 6 },
  occasionLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 8 },
  lockedPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockedText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#a99c94" },
  dateInputsRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  dateInput: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.ink, textAlign: "center" },
  saveBtn: { backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#fff" },
  warningText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#b45309", marginTop: 6 },
  divider: { height: 1, backgroundColor: "#f3ece6", marginVertical: 10 },
});
