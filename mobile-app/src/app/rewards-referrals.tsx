import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Share } from "react-native";
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { colors } from "@/config";
import { EmptyState } from "@/components/ui";
import { getReferrals } from "@/services/rewardsApi";
import { trackRewardEvent } from "@/lib/rewardsAnalytics";
import type { ReferralHistoryEntry, ReferralsResponse } from "@/types/rewards";

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  PENDING_QUALIFICATION: "Waiting for qualifying order",
  QUALIFIED: "Qualified",
  REWARDED: "Rewarded",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export default function RewardsReferralsScreen() {
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"" | "code" | "link">("");

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      const result = await getReferrals(1, 30);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Could not load referrals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { trackRewardEvent("referral_screen_viewed"); load("initial"); }, [load]);

  async function copy(kind: "code" | "link") {
    if (!data) return;
    await Clipboard.setStringAsync(kind === "code" ? data.referralCode : data.share.link);
    setCopied(kind);
    trackRewardEvent(kind === "code" ? "referral_code_copied" : "referral_link_copied");
    setTimeout(() => setCopied(""), 2000);
  }

  async function share() {
    if (!data) return;
    trackRewardEvent("referral_shared");
    try {
      await Share.share({ message: data.share.message, url: data.share.link });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Invite & Earn", headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.orange} />
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load("initial")}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.referrals || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            React.createElement(RefreshControl as any, {
              refreshing,
              onRefresh: () => load("refresh"),
              colors: [colors.orange],
            })
          }
          ListHeaderComponent={data ? (
            <View style={styles.headerBlock}>
              <Text style={styles.codeLabel}>Your Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{data.referralCode}</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={() => copy("code")}>
                  <Text style={styles.actionBtnText}>{copied === "code" ? "Copied!" : "Copy Code"}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => copy("link")}>
                  <Text style={styles.actionBtnText}>{copied === "link" ? "Copied!" : "Copy Link"}</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.shareBtn]} onPress={share}>
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Share</Text>
                </Pressable>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>{data.summary.successful}</Text>
                  <Text style={styles.summaryLabel}>Successful</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>{data.summary.pending}</Text>
                  <Text style={styles.summaryLabel}>Pending</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryValue}>{data.summary.totalDamruEarned}</Text>
                  <Text style={styles.summaryLabel}>Damru Earned</Text>
                </View>
              </View>

              <View style={styles.howItWorks}>
                <Text style={styles.howTitle}>How it works</Text>
                <Text style={styles.howStep}>1. Share your code with friends</Text>
                <Text style={styles.howStep}>2. They sign up and enter it during registration</Text>
                <Text style={styles.howStep}>3. You both earn Damru once their first eligible order is delivered</Text>
              </View>

              <Text style={styles.historyTitle}>Referral History</Text>
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState title="No referrals yet" message="Invite friends to start earning Damru together." />}
          renderItem={({ item }: { item: ReferralHistoryEntry }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.referredName || "Referral"}</Text>
                <Text style={styles.cardStatus}>{STATUS_LABEL[item.status] || item.status}</Text>
              </View>
              {item.status === "REWARDED" && <Text style={styles.cardReward}>+{item.rewardAmount} Damru</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  headerBlock: { marginBottom: 8 },
  codeLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: "#a99c94", marginBottom: 6 },
  codeRow: { marginBottom: 12 },
  code: { fontFamily: "Poppins_700Bold", fontSize: 20, letterSpacing: 1, color: colors.orange, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fde3c8", borderStyle: "dashed", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: "flex-start" },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: "#eee3da", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  actionBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12.5, color: colors.orange },
  shareBtn: { backgroundColor: colors.orange, borderColor: colors.orange },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  summaryStat: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 14, padding: 12, alignItems: "center" },
  summaryValue: { fontFamily: "Poppins_700Bold", fontSize: 18, color: colors.ink },
  summaryLabel: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94", marginTop: 2 },
  howItWorks: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee3da", borderRadius: 14, padding: 14, marginBottom: 18 },
  howTitle: { fontFamily: "Poppins_700Bold", fontSize: 13, color: colors.ink, marginBottom: 8 },
  howStep: { fontFamily: "Poppins_400Regular", fontSize: 12.5, color: "#756860", marginBottom: 4 },
  historyTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: colors.ink, marginBottom: 10 },
  card: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#eee3da" },
  cardName: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 2 },
  cardStatus: { fontFamily: "Poppins_400Regular", fontSize: 11.5, color: "#a99c94", textTransform: "capitalize" },
  cardReward: { fontFamily: "Poppins_700Bold", fontSize: 13, color: colors.green },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
});
