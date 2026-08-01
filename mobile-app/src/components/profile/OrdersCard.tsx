import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import type { Order } from "@/types";
import { useRouter } from "expo-router";

interface OrdersCardProps {
  orders: Order[];
}

export function OrdersCard({ orders }: OrdersCardProps) {
  const router = useRouter();
  const recentOrder = orders[0];

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
        return "#e8f5e9";
      case "cancelled":
        return "#fef2f2";
      case "pending":
        return "#fffbeb";
      default:
        return "rgba(229, 121, 34, 0.1)";
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="bag-handle-outline" size={18} color={colors.orange} />
          <Text style={styles.title}>Recent Order</Text>
        </View>
        {orders.length > 0 ? (
          <Pressable onPress={() => router.push("/orders")} style={styles.manageBtn}>
            <View style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>History</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.orange} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {recentOrder ? (
        <View style={styles.orderContainer}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNo}>
              #{recentOrder.orderNumber || recentOrder._id.slice(-6).toUpperCase()}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: getStatusBg(recentOrder.status),
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: getStatusColor(recentOrder.status),
                  },
                ]}
              >
                {recentOrder.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.itemsText} numberOfLines={2}>
            {recentOrder.items?.map((item) => `${item.qty} × ${item.name}`).join(" • ") ||
              "Delicious meal"}
          </Text>

          <View style={styles.orderFooter}>
            <Text style={styles.dateText}>
              {new Date(recentOrder.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
            <Text style={styles.totalText}>₹{recentOrder.total}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="cart-outline" size={24} color="#a99c94" style={{ marginBottom: 6 }} />
          <Text style={styles.emptyText}>You haven't placed any orders yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#e67e22",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: colors.ink,
  },
  manageBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
    marginRight: 1,
  },
  orderContainer: {
    backgroundColor: "#fffdfb",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fcf0e4",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNo: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 9,
  },
  itemsText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#756860",
    lineHeight: 18,
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#fcf0e4",
    paddingTop: 10,
  },
  dateText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#a99c94",
  },
  totalText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: colors.ink,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf9f6",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#a99c94",
  },
});
