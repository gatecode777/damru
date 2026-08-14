import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { colors } from "@/config";
import type { Order } from "@/types";
import { queryKeys } from "@/lib/queryClient";
import { OrderStepper } from "@/components/orders/OrderStepper";
import { CancelOrderSheet } from "@/components/orders/CancelOrderSheet";
import { useCancelOrder } from "@/hooks/useCancelOrder";
import { CANCELLABLE_STATUSES, PAYMENT_STATUS_DISPLAY, getStatusColor, getStatusBg } from "@/constants/orderStatus";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const cancelOrder = useCancelOrder();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.profile.orders(),
    queryFn: () => get<{ orders: Order[] }>("/api/orders"),
    select: (res) => res.orders ?? [],
  });

  const order = data?.find((o) => o._id === id);

  function handleCancelSubmit(reason: string) {
    setSheetOpen(false);
    Alert.alert(
      "Cancel this order?",
      "We'll cancel your order and process any applicable refund. This cannot be undone.",
      [
        { text: "Keep Order", style: "cancel" },
        { text: "Yes, Cancel It", style: "destructive", onPress: () => cancelOrder.mutate({ id: id!, reason }) },
      ]
    );
  }

  if (isLoading && !order) {
    return (
      <View style={{ flex: 1, backgroundColor: "#faf9f6" }}>
        <Stack.Screen options={{ title: "Order Details", headerShown: true }} />
        <View style={styles.content}>
          <View style={styles.headRow}>
            <Skeleton width={100} height={13} />
            <Skeleton width={80} height={22} radius={6} />
          </View>
          <View style={styles.card}>
            <Skeleton height={60} radius={10} />
          </View>
          <View style={styles.card}>
            <Skeleton width={60} height={14} style={{ marginBottom: 12 }} />
            <Skeleton width="90%" height={13} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={13} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={13} />
          </View>
        </View>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Order Details", headerShown: true }} />
        <Text style={styles.errorText}>We couldn't find this order.</Text>
      </View>
    );
  }

  const isDineIn = !!order.tableNumber;
  const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
  const paymentDisplay = order.paymentMethod !== "cod" && order.paymentStatus ? PAYMENT_STATUS_DISPLAY[order.paymentStatus] : null;
  const items = order.items ?? [];
  const subtotal = order.subtotal ?? 0;
  const discount = order.discount ?? 0;
  const tax = order.tax ?? 0;
  const shipping = order.shipping ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#faf9f6" }}>
      <Stack.Screen options={{ title: `#${order.orderNumber || order._id.slice(-6).toUpperCase()}`, headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <Text style={styles.dateText}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </Text>
          <View style={[styles.badge, { backgroundColor: getStatusBg(order.status) }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(order.status) }]}>
              {order.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <OrderStepper status={order.status} isDineIn={isDineIn} />
        </View>

        {isCancellable && (
          <Pressable style={styles.cancelBtn} onPress={() => setSheetOpen(true)} disabled={cancelOrder.isPending}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>{cancelOrder.isPending ? "Cancelling…" : "Cancel Order"}</Text>
          </Pressable>
        )}

        {order.status === "cancelled" && order.cancellationReason && (
          <View style={[styles.card, styles.cancelledCard]}>
            <Text style={styles.sectionTitle}>Cancellation Details</Text>
            <Text style={styles.cardText}>{order.cancellationReason}</Text>
            {order.cancelledAt && (
              <Text style={styles.mutedText}>
                Cancelled on {new Date(order.cancelledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </Text>
            )}
          </View>
        )}

        {paymentDisplay && (
          <View style={[styles.badge, styles.paymentBadge, { backgroundColor: paymentDisplay.bg }]}>
            <Text style={[styles.badgeText, { color: paymentDisplay.color }]}>{paymentDisplay.label.toUpperCase()}</Text>
          </View>
        )}
        {order.paymentMethod !== "cod" && (order.paymentStatus === "refund_pending" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded") && (
          <Text style={styles.refundText}>
            {order.paymentStatus === "refund_pending"
              ? "A refund has been initiated for this order."
              : `₹${order.refundedAmount || 0} refunded${(order.paymentAmount ?? 0) > (order.refundedAmount ?? 0) ? ` of ₹${order.paymentAmount}` : ""}.`}
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>{item.qty}× {item.name}</Text>
              {item.price !== undefined && <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isDineIn ? "Table" : "Delivery Address"}</Text>
          {isDineIn ? (
            <Text style={styles.cardText}>Table {order.tableNumber}{order.tableName ? ` · ${order.tableName}` : ""}</Text>
          ) : order.deliveryAddress ? (
            <>
              <Text style={styles.cardText}>{order.deliveryAddress.fullName} · {order.deliveryAddress.phone}</Text>
              <Text style={styles.mutedText}>
                {order.deliveryAddress.house}{order.deliveryAddress.area ? `, ${order.deliveryAddress.area}` : ""}{"\n"}
                {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.pincode}
              </Text>
            </>
          ) : (
            <Text style={styles.mutedText}>No address on file.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <BillRow label="Subtotal" value={subtotal} />
          {discount > 0 && <BillRow label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"} value={-discount} />}
          {tax > 0 && <BillRow label="Tax" value={tax} />}
          {shipping > 0 && <BillRow label="Delivery Fee" value={shipping} />}
          <View style={styles.divider} />
          <BillRow label="Total" value={order.total} bold />
        </View>
      </ScrollView>

      <CancelOrderSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onSubmit={handleCancelSubmit} />
    </View>
  );
}

function BillRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billLabel, bold && styles.billLabelBold]}>{label}</Text>
      <Text style={[styles.billValue, bold && styles.billLabelBold]}>{value < 0 ? "-" : ""}₹{Math.abs(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#faf9f6" },
  errorText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: colors.danger, textAlign: "center" },
  content: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  dateText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#a99c94" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontFamily: "Poppins_700Bold", fontSize: 11 },
  paymentBadge: { alignSelf: "flex-start", marginBottom: 8 },
  refundText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#756860", marginBottom: 12 },
  card: {
    backgroundColor: "#ffffff", borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "#eee3da",
  },
  cancelledCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14, height: 48, marginBottom: 14,
  },
  cancelBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: colors.danger },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: colors.ink, marginBottom: 10 },
  cardText: { fontFamily: "Poppins_500Medium", fontSize: 13.5, color: colors.ink, marginBottom: 2 },
  mutedText: { fontFamily: "Poppins_400Regular", fontSize: 12.5, color: "#a99c94", lineHeight: 18 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 10 },
  itemName: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 13.5, color: colors.ink },
  itemPrice: { fontFamily: "Poppins_500Medium", fontSize: 13.5, color: colors.ink },
  divider: { height: 1, backgroundColor: "#f3ece6", marginVertical: 8 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  billLabel: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#756860" },
  billLabelBold: { fontFamily: "Poppins_700Bold", fontSize: 15, color: colors.ink },
  billValue: { fontFamily: "Poppins_500Medium", fontSize: 13, color: colors.ink },
});
