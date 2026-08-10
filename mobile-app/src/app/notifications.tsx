import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Stack, router } from "expo-router";
import { colors } from "@/config";
import { EmptyState } from "@/components/ui";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/services/notificationsApi";
import type { AppNotification } from "@/types/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>([]);
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
      const data = await getNotifications(targetPage, 20);
      setItems(prev => (mode === "more" ? [...prev, ...data.notifications] : data.notifications));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load notifications."));
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

  async function handlePress(item: AppNotification) {
    if (!item.isRead) {
      setItems(prev => prev.map(n => (n._id === item._id ? { ...n, isRead: true } : n)));
      try {
        await markNotificationRead(item._id);
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      } catch {
        setItems(prev => prev.map(n => (n._id === item._id ? { ...n, isRead: false } : n)));
      }
    }
    if (item.action?.route) router.push(item.action.route as any);
  }

  async function handleMarkAllRead() {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    } catch {
      // Best-effort — a failed mark-all-read is not worth surfacing an error over; the next load() call reconciles state.
    }
  }

  const hasUnread = items.some(n => !n.isRead);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Notifications", headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.orange} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(1, "initial")}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
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
          ListHeaderComponent={hasUnread ? (
            <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark All Read</Text>
            </Pressable>
          ) : null}
          ListEmptyComponent={<EmptyState title="No notifications yet" message="Order, reward, and offer updates will appear here." />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.orange} /> : null}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, !item.isRead && styles.cardUnread]} onPress={() => handlePress(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              {!item.isRead && <View style={styles.dot} />}
            </Pressable>
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
  markAllBtn: { alignSelf: "flex-end", marginBottom: 10 },
  markAllText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  card: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    backgroundColor: "#ffffff", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#eee3da",
  },
  cardUnread: { backgroundColor: "#fff7ed" },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 2 },
  message: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#756860", marginBottom: 4 },
  date: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginLeft: 8, marginTop: 4 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
});
