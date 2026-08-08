import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { colors } from "@/config";
import { EmptyState } from "@/components/ui";
import { getAchievements } from "@/services/rewardsApi";
import type { Achievement } from "@/types/rewards";

export default function RewardsAchievementsScreen() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [summary, setSummary] = useState<{ total: number; unlocked: number; inProgress: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);
    try {
      const data = await getAchievements();
      setAchievements(data.achievements);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err?.message || "Could not load achievements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load("initial"); }, [load]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Achievements", headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.orange} />
        </View>
      ) : error && achievements.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load("initial")}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={achievements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            React.createElement(RefreshControl as any, {
              refreshing,
              onRefresh: () => load("refresh"),
              colors: [colors.orange],
            })
          }
          ListHeaderComponent={summary ? (
            <Text style={styles.summaryText}>{summary.unlocked} / {summary.total} Unlocked</Text>
          ) : null}
          ListEmptyComponent={<EmptyState title="No achievements yet" message="Keep ordering and staying active to unlock achievements." />}
          renderItem={({ item }) => {
            const done = item.status === "CLAIMED" || item.status === "COMPLETED";
            return (
              <View style={[styles.card, done && styles.cardDone]}>
                <Text style={[styles.name, done && styles.nameDone]}>{done ? "✓ " : ""}{item.name}</Text>
                {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
                {done ? (
                  <Text style={styles.reward}>
                    {item.reward.damruAmount > 0 ? `${item.reward.damruAmount} Damru Earned` : ""}
                    {item.badgeName ? ` · ${item.badgeName}` : ""}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.progress}>{item.progress} / {item.target} · {item.progressPercentage}%</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${item.progressPercentage}%` }]} />
                    </View>
                    {item.reward.damruAmount > 0 && (
                      <Text style={styles.rewardHint}>Reward: {item.reward.damruAmount} Damru{item.badgeName ? ` + ${item.badgeName} badge` : ""}</Text>
                    )}
                  </>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  summaryText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: colors.ink, marginBottom: 12 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#eee3da" },
  cardDone: { backgroundColor: "#eafaf0", borderColor: "#bbf7d0" },
  name: { fontFamily: "Poppins_700Bold", fontSize: 14, color: colors.ink, marginBottom: 4 },
  nameDone: { color: colors.green },
  desc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#a99c94", marginBottom: 8 },
  progress: { fontFamily: "Poppins_500Medium", fontSize: 12, color: "#756860", marginBottom: 4 },
  progressTrack: { height: 6, borderRadius: 6, backgroundColor: "#f3ece6", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6, backgroundColor: colors.orange },
  reward: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.green },
  rewardHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: colors.orange, marginTop: 6 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
});
