import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotifications } from "@/services/notificationsApi";
import type { AppNotification } from "@/types/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/api";
import { PremiumRefreshControl } from "@/components/ui/PremiumRefreshControl";

function NotificationCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Skeleton width="55%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width="85%" height={12} style={{ marginBottom: 6 }} />
        <Skeleton width={70} height={11} />
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  function enterSelectMode(id: string) {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function performDelete(ids: string[]) {
    const previous = items;
    setItems(prev => prev.filter(n => !ids.includes(n._id)));
    exitSelectMode();
    try {
      await deleteNotifications(ids);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    } catch (err) {
      setItems(previous);
      Alert.alert("Error", getApiErrorMessage(err, "Failed to delete notification(s)."));
    }
  }

  function handleDeleteSingle(id: string) {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => performDelete([id]) },
      ]
    );
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    Alert.alert(
      "Delete Notifications",
      `Delete ${ids.length} selected notification${ids.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => performDelete(ids) },
      ]
    );
  }

  const hasUnread = items.some(n => !n.isRead);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: selectMode ? `${selectedIds.size} selected` : "Notifications",
          headerShown: true,
          headerRight: () => (
            items.length > 0 ? (
              <Pressable onPress={selectMode ? exitSelectMode : () => setSelectMode(true)} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>{selectMode ? "Cancel" : "Select"}</Text>
              </Pressable>
            ) : null
          ),
        }}
      />

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5].map((i) => (
            <NotificationCardSkeleton key={i} />
          ))}
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
          contentContainerStyle={[styles.listContent, selectMode && selectedIds.size > 0 && styles.listContentWithBar]}
          refreshControl={
            React.createElement(PremiumRefreshControl, {
              refreshing,
              onRefresh: () => load(1, "refresh"),
              colors: [colors.orange],
            })
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleEndReached}
          ListHeaderComponent={!selectMode && hasUnread ? (
            <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark All Read</Text>
            </Pressable>
          ) : null}
          ListEmptyComponent={<EmptyState title="No notifications yet" message="Order, reward, and offer updates will appear here." />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.orange} /> : null}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item._id);
            return (
              <Pressable
                style={[styles.card, !item.isRead && styles.cardUnread, selected && styles.cardSelected]}
                onPress={() => (selectMode ? toggleSelect(item._id) : handlePress(item))}
                onLongPress={() => enterSelectMode(item._id)}
              >
                {selectMode && (
                  <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                    {selected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                {!selectMode && !item.isRead && <View style={styles.dot} />}
                {!selectMode && (
                  <Pressable hitSlop={10} onPress={() => handleDeleteSingle(item._id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {selectMode && selectedIds.size > 0 && (
        <View style={styles.footerBtn}>
          <Pressable onPress={handleDeleteSelected} style={styles.deleteAllBtn}>
            <Ionicons name="trash-outline" size={18} color="#ffffff" style={styles.btnIcon} />
            <Text style={styles.deleteAllText}>Delete ({selectedIds.size})</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  headerBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.orange },
  listContent: { padding: 16, paddingBottom: 40 },
  listContentWithBar: { paddingBottom: 96 },
  markAllBtn: { alignSelf: "flex-end", marginBottom: 10 },
  markAllText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  card: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    backgroundColor: "#ffffff", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#eee3da", gap: 10,
  },
  cardUnread: { backgroundColor: "#fff7ed" },
  cardSelected: { borderColor: colors.orange, backgroundColor: "#fff2e2" },
  checkbox: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#cbbfb5",
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.orange, borderColor: colors.orange },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink, marginBottom: 2 },
  message: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#756860", marginBottom: 4 },
  date: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#a99c94" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, marginLeft: 8, marginTop: 4 },
  deleteBtn: { padding: 4, marginLeft: 4 },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#ffffff" },
  footerBtn: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff",
    padding: 16, borderTopWidth: 1, borderTopColor: "#f3ece6",
  },
  deleteAllBtn: {
    backgroundColor: colors.danger, height: 48, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  btnIcon: { marginRight: 6 },
  deleteAllText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#ffffff" },
});
