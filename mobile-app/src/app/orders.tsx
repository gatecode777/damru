import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { get } from "@/lib/api";
import { colors } from "@/config";
import type { Order } from "@/types";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { CancelOrderSheet } from "@/components/orders/CancelOrderSheet";
import { useCancelOrder } from "@/hooks/useCancelOrder";
import { CANCELLABLE_STATUSES, PAYMENT_STATUS_DISPLAY, getStatusColor, getStatusBg } from "@/constants/orderStatus";

function OrderCardSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHead}>
        <Skeleton width={90} height={14} />
        <Skeleton width={70} height={18} radius={6} />
      </View>
      <Skeleton width="85%" height={13} style={{ marginBottom: 12 }} />
      <View style={[styles.orderFoot, { borderTopWidth: 0, paddingTop: 0 }]}>
        <Skeleton width={80} height={12} />
        <Skeleton width={54} height={14} />
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const cancelOrder = useCancelOrder();

  const { data, isLoading, isRefetching, error: queryError, refetch } = useQuery({
    queryKey: queryKeys.profile.orders(),
    queryFn: () => get<{ orders: Order[] }>("/api/orders"),
    staleTime: 30 * 1000, // 30 seconds stale time
    select: (res) => res.orders ?? [],
  });

  // Payment/refund status can change server-side (webhook, admin refund)
  // while this screen isn't focused — always pull fresh state on return.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const orders = data ?? [];
  const loading = isLoading;
  const refreshing = isRefetching;
  const error = queryError instanceof Error ? queryError.message : (queryError ? String(queryError) : null);

  const fetchOrders = (_isRefresh?: boolean) => {
    refetch();
  };

  function handleCancelSubmit(reason: string) {
    const id = cancelTargetId;
    setCancelTargetId(null);
    if (!id) return;
    Alert.alert(
      "Cancel this order?",
      "We'll cancel your order and process any applicable refund. This cannot be undone.",
      [
        { text: "Keep Order", style: "cancel" },
        { text: "Yes, Cancel It", style: "destructive", onPress: () => cancelOrder.mutate({ id, reason }) },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "My Orders", headerShown: true }} />

      {loading && !refreshing ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchOrders()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          refreshControl={
            React.createElement(RefreshControl as any, {
              refreshing: refreshing,
              onRefresh: () => fetchOrders(true),
              colors: [colors.orange],
            })
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="No orders yet"
              message="Your delicious history will appear here."
            />
          }
          renderItem={({ item }) => {
            const isCancellable = CANCELLABLE_STATUSES.includes(item.status);
            return (
              <Pressable style={styles.orderCard} onPress={() => router.push({ pathname: "/order/[id]", params: { id: item._id } })}>
                <View style={styles.orderHead}>
                  <Text style={styles.orderNo}>
                    #{item.orderNumber || item._id.slice(-6).toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBg(item.status) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.orderItems} numberOfLines={2}>
                  {item.items?.map((entry) => `${entry.qty}× ${entry.name}`).join(", ") ||
                    "Delicious meal"}
                </Text>

                {item.paymentMethod !== "cod" && item.paymentStatus && PAYMENT_STATUS_DISPLAY[item.paymentStatus] && (
                  <View
                    style={[
                      styles.statusBadge,
                      { alignSelf: "flex-start", marginBottom: 10, backgroundColor: PAYMENT_STATUS_DISPLAY[item.paymentStatus].bg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: PAYMENT_STATUS_DISPLAY[item.paymentStatus].color }]}>
                      {PAYMENT_STATUS_DISPLAY[item.paymentStatus].label.toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.orderFoot}>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                  <Text style={styles.total}>₹{item.total}</Text>
                </View>

                {isCancellable && (
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={(e) => { e.stopPropagation(); setCancelTargetId(item._id); }}
                    disabled={cancelOrder.isPending}
                  >
                    <Ionicons name="close-circle-outline" size={15} color={colors.danger} style={{ marginRight: 5 }} />
                    <Text style={styles.cancelBtnText}>Cancel Order</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <CancelOrderSheet
        visible={!!cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        onSubmit={handleCancelSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee3da",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  orderHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNo: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
  },
  orderItems: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#756860",
    lineHeight: 18,
    marginBottom: 12,
  },
  orderFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3ece6",
    paddingTop: 10,
  },
  date: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#a99c94",
  },
  total: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: colors.ink,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  cancelBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12.5,
    color: colors.danger,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },
});
