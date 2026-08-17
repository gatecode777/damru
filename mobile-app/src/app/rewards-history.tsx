import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Stack } from "expo-router";
import { colors } from "@/config";
import { EmptyState } from "@/components/ui";
import { getRewardHistory } from "@/services/rewardsApi";
import type { RewardTransaction } from "@/types/rewards";
import { getApiErrorMessage } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

function TxCardSkeleton() {
  return (
    <View style={styles.txCard}>
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width={90} height={11} />
      </View>
      <Skeleton width={70} height={14} />
    </View>
  );
}

export default function RewardsHistoryScreen() {
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, mode: "initial" | "refresh" | "more") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode === "more") setLoadingMore(true);
    setError(null);
    try {
      const data = await getRewardHistory(targetPage, 20);
      setTransactions(prev => (mode === "more" ? [...prev, ...data.transactions] : data.transactions));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load your reward history."));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  React.useEffect(() => { load(1, "initial"); }, [load]);

  function handleEndReached() {
    if (loadingMore || loading || refreshing || page >= totalPages) return;
    load(page + 1, "more");
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Reward History", headerShown: true }} />

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TxCardSkeleton key={i} />
          ))}
        </View>
      ) : error && transactions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(1, "initial")}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            React.createElement(RefreshControl as any, {
              refreshing,
              onRefresh: () => load(1, "refresh"),
              colors: [colors.orange],
            })
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleEndReached}
          ListEmptyComponent={<EmptyState title="No Damru activity yet" message="Your reward history will appear here." />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.orange} /> : null}
          renderItem={({ item }) => (
            <View style={styles.txCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{item.description || item.category}</Text>
                <Text style={styles.txDate}>
                  {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
                {item.type === "credit" && item.expiresAt && (
                  <Text style={styles.txDate}>
                    Expires {new Date(item.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                )}
              </View>
              <Text style={[styles.txAmount, { color: item.type === "credit" ? colors.green : colors.danger }]}>
                {item.type === "credit" ? "+" : "−"}{item.amount} Damru
              </Text>
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
  txCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#ffffff", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#eee3da",
  },
  txDesc: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 2 },
  txDate: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94" },
  txAmount: { fontFamily: "Poppins_700Bold", fontSize: 14 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
});
