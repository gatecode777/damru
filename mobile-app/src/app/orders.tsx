import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { get } from "@/lib/api";
import { colors } from "@/config";
import type { Order } from "@/types";
import { EmptyState } from "@/components/ui";

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await get<{ orders: Order[] }>("/api/orders");
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "#15803d";
      case "cancelled":
        return "#b91c1c";
      case "pending":
        return "#b45309";
      default:
        return colors.orange;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "#f0fdf4";
      case "cancelled":
        return "#fef2f2";
      case "pending":
        return "#fffbeb";
      default:
        return "rgba(229, 121, 34, 0.1)";
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "My Orders", headerShown: true }} />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.orange} />
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
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
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
            </View>
          )}
        />
      )}
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
