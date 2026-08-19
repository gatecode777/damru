import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field } from "../components/ui";
import { colors, assetUrl } from "../config";
import { get, post, ApiRequestError } from "../lib/api";
import { useApp } from "../providers/AppProvider";
import type { Address } from "../types";
import { getRewardsDashboard } from "../services/rewardsApi";
import { createRazorpayOrder, verifyRazorpayPayment, reportRazorpayPaymentFailed } from "../services/paymentApi";
import { trackRewardEvent } from "../lib/rewardsAnalytics";
import type { RazorpayCheckoutOptions, RazorpaySuccessResponse } from "react-native-razorpay";

// Lazily loaded (not a static top-level import) because this native module
// isn't compiled into Expo Go — a static import would crash the ENTIRE app on
// launch, not just checkout, since Expo Go can't resolve it at bundle-eval
// time. Deferring the import to the moment payment is actually attempted lets
// every other screen work fine in Expo Go; only "Pay Online" itself needs a
// development build (see eas.json's `development` profile). COD is unaffected.
async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResponse> {
  let RazorpayCheckout: { open: (options: RazorpayCheckoutOptions) => Promise<RazorpaySuccessResponse> };
  try {
    RazorpayCheckout = (await import("react-native-razorpay")).default;
  } catch {
    throw new Error("Online payment isn't available in this Expo Go preview — install a development build to test payments. Cash on Delivery still works here.");
  }
  return RazorpayCheckout.open(options);
}

const emptyAddress: Address = {
  label: "Home",
  fullName: "",
  phone: "",
  house: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coupon } = useLocalSearchParams<{
    coupon?: string;
  }>();

  const { user, cart, clearCart, flushCartSync } = useApp();

  const queryClient = useQueryClient();

  const { data: rewardsDashboard } = useQuery({
    queryKey: queryKeys.rewards.dashboard(),
    queryFn: getRewardsDashboard,
    enabled: !!user,
    staleTime: 30 * 1000,
  });
  const [requestedDamru, setRequestedDamru] = useState("");

  const { data: addressesData } = useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: () => get<{ addresses: Address[] }>("/api/address"),
    staleTime: 2 * 60 * 1000,
  });

  const addresses = addressesData?.addresses ?? [];

  const [selectedAddr, setSelectedAddr] = useState("");
  const [editingAddr, setEditingAddr] = useState(false);
  const [newAddr, setNewAddr] = useState<Address>(emptyAddress);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddr) {
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (defaultAddr?._id) {
        setSelectedAddr(defaultAddr._id);
      }
    }
  }, [addresses, selectedAddr]);

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: quoteData, isFetching: quoteLoading, error: quoteQueryError } = useQuery({
    queryKey: ["checkout", "quote", selectedAddr, coupon || "", requestedDamru, cart.map(item => `${item.menuItemId}:${item.custom}:${item.qty}`).join("|")],
    queryFn: async () => {
      await flushCartSync();
      return post<{ totals: { subtotal: number; couponDiscount: number; deliveryFee: number; taxAmount: number; damruDiscount: number; finalAmount: number; taxName: string } }>("/api/checkout/quote", {
        addressId: selectedAddr,
        couponCode: coupon || undefined,
        requestedDamru: Number(requestedDamru || 0),
      });
    },
    enabled: Boolean(user && selectedAddr && cart.length),
    staleTime: 10 * 1000,
    retry: false,
  });
  const quote = quoteData?.totals;
  const subtotal = quote?.subtotal ?? 0;
  const discount = quote?.couponDiscount ?? 0;
  const deliveryFee = quote?.deliveryFee ?? 0;
  const tax = quote?.taxAmount ?? 0;
  const total = quote?.finalAmount;

  // UI States
  const [billExpanded, setBillExpanded] = useState(false);
  const [payMethod, setPayMethod] = useState<"razorpay" | "cod" | null>(null);
  
  // UPI ID client-side format-check states.
  // NOTE: This validates only the local-part@provider format.
  // It does NOT confirm that the UPI account exists or that the bank will
  // authorise a debit. Final payment validation must occur through the
  // payment provider (e.g. Razorpay, PhonePe) during payment processing.

  // Address loading handled by useQuery query key caching above.

  const updateNewAddr = (key: keyof Address) => (value: string) =>
    setNewAddr((state) => ({ ...state, [key]: value }));

  async function saveAddress() {
    if (
      !newAddr.fullName ||
      !newAddr.phone ||
      !newAddr.house ||
      !newAddr.city ||
      !newAddr.pincode
    ) {
      Alert.alert("Address", "Please fill in all required fields.");
      return;
    }

    try {
      const data = await post<{ address: Address }>("/api/address", newAddr);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
      setSelectedAddr(data.address._id!);
      setEditingAddr(false);
      setNewAddr(emptyAddress);
    } catch (e: any) {
      Alert.alert("Address", e?.message ?? "Could not save address.");
    }
  }

  async function placeOrder() {
    if (!selectedAddr) {
      Alert.alert("Delivery address", "Please select or add an address.");
      return;
    }
    if (!payMethod) {
      Alert.alert("Payment method", "Please select Cash on Delivery or Pay Online.");
      return;
    }
    if (payMethod !== "cod" && !user) {
      Alert.alert("Login required", "Online payment requires login. Please log in, or choose Cash on Delivery.");
      return;
    }
    if (!quote || quoteLoading) {
      Alert.alert("Order total unavailable", quoteQueryError instanceof Error ? quoteQueryError.message : "Please wait while we calculate your order total.");
      return;
    }

    setBusy(true);
    try {
      // Map "upi" and "card" selection securely to backend order creation
      const response = await post<{
        order: { orderId: string; _id: string; total: number };
        redemption?: { success: boolean; amount?: number; discount?: number; error?: string };
      }>("/api/orders", {
        addressId: selectedAddr,
        paymentMethod: payMethod,
        couponCode: coupon || undefined,
        notes: notes.trim(),
        requestedDamru: Number(requestedDamru || 0),
      });

      // Damru redemption is chained after order creation — the backend
      // requires an existing, owned orderId to redeem against. This must run
      // BEFORE Razorpay order creation below, since the payable amount sent
      // to Razorpay is computed net of any Damru redeemed for this order.
      let redeemMessage = "";
      const result = response.redemption;
      const damruAmount = Number(result?.amount || 0);
      if (result) {
        trackRewardEvent("damru_redemption_started");
        if (result.success) {
          trackRewardEvent("damru_redemption_succeeded");
          redeemMessage = `\n\n🪙 ${damruAmount} Damru redeemed → ₹${result.discount} discount recorded.`;
          queryClient.invalidateQueries({ queryKey: queryKeys.rewards.dashboard() });
        } else {
          trackRewardEvent("damru_redemption_failed");
          redeemMessage = `\n\nDamru redemption didn't go through: ${result.error} Your balance wasn't affected.`;
        }
      }

      await clearCart();

      const orderLabel = response.order.orderId;

      if (payMethod === "cod") {
        Alert.alert(
          "Order Confirmed! 🎉",
          `Your order #${orderLabel} has been successfully placed.${redeemMessage}`,
          [{ text: "View Orders", onPress: () => router.replace("/(tabs)/profile") }]
        );
        return;
      }

      await payWithRazorpay(response.order._id, orderLabel, redeemMessage);
    } catch (e: any) {
      Alert.alert(
        "Could not place order",
        e?.message ?? "An unexpected error occurred. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  // Backend determines and freezes the payable amount (order.total net of any
  // Damru already redeemed for this order) — this only ever opens Razorpay's
  // native checkout for that server-returned amount, never one computed here.
  async function payWithRazorpay(internalOrderId: string, orderLabel: string, redeemMessage: string) {
    let gatewayOrderId = "";
    try {
      const orderData = await createRazorpayOrder(internalOrderId);
      gatewayOrderId = orderData.razorpayOrderId ?? "";

      if (orderData.zeroPayable) {
        Alert.alert(
          "Order Confirmed! 🎉",
          `Your order #${orderLabel} has been successfully placed.${redeemMessage}`,
          [{ text: "View Orders", onPress: () => router.replace("/(tabs)/profile") }]
        );
        return;
      }

      if (!orderData.razorpayOrderId || !orderData.amount || !orderData.keyId) {
        throw new Error("Payment could not be started.");
      }

      const paymentResult = await openRazorpayCheckout({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency ?? "INR",
        name: "Damru By Namo",
        description: `Order #${orderLabel}`,
        order_id: orderData.razorpayOrderId,
        prefill: user ? { email: user.email, name: user.name } : undefined,
        theme: { color: "#e67e22" },
      });

      const verifyResult = await verifyRazorpayPayment({
        orderId: internalOrderId,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_order_id: paymentResult.razorpay_order_id,
        razorpay_signature: paymentResult.razorpay_signature,
      });

      if (verifyResult.success) {
        Alert.alert(
          "Payment Successful! 🎉",
          `Your order #${orderLabel} is confirmed and paid.${redeemMessage}`,
          [{ text: "View Orders", onPress: () => router.replace("/(tabs)/profile") }]
        );
      } else {
        offerPaymentRetry(internalOrderId, orderLabel, redeemMessage, "We couldn't verify your payment.");
      }
    } catch (e: unknown) {
      if (gatewayOrderId) {
        reportRazorpayPaymentFailed({ orderId: internalOrderId, razorpayOrderId: gatewayOrderId }).catch(() => undefined);
      }
      // RazorpayCheckout.open() rejects on user cancellation or a failed
      // payment attempt — either way, the order is saved and retryable, it
      // is never silently marked paid from this catch block alone.
      if (e instanceof ApiRequestError) {
        offerPaymentRetry(internalOrderId, orderLabel, redeemMessage, e.message);
      } else if (e instanceof Error) {
        // Razorpay's own cancellation/failure rejection is a plain object, not
        // an Error instance, so this branch only ever catches errors WE threw
        // ourselves (e.g. openRazorpayCheckout's Expo-Go guard above) — real
        // user-cancelled payments still fall through to the generic message below.
        offerPaymentRetry(internalOrderId, orderLabel, redeemMessage, e.message);
      } else {
        offerPaymentRetry(internalOrderId, orderLabel, redeemMessage, "Payment was cancelled or didn't complete.");
      }
    }
  }

  function offerPaymentRetry(internalOrderId: string, orderLabel: string, redeemMessage: string, reason: string) {
    Alert.alert(
      "Payment Not Completed",
      `Order #${orderLabel} was saved, but payment didn't go through: ${reason}\n\nYour Damru balance wasn't affected.${redeemMessage}`,
      [
        { text: "Retry Payment", onPress: () => { setBusy(true); payWithRazorpay(internalOrderId, orderLabel, redeemMessage).finally(() => setBusy(false)); } },
        { text: "View Orders", style: "cancel", onPress: () => router.replace("/(tabs)/profile") },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Custom Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRight}>
          <Ionicons name="lock-closed" size={14} color="#198754" />
          <Text style={styles.headerSecureText}>SECURE</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Payable Amount Card ── */}
        <View style={styles.payableCard}>
          <View style={styles.payableMainRow}>
            <View>
              <Text style={styles.payableSubLabel}>PAYABLE AMOUNT</Text>
              <Text style={styles.payablePrice}>{total === undefined ? "Calculating…" : `₹${total.toFixed(2)}`}</Text>
            </View>
            <Pressable
              onPress={() => setBillExpanded(!billExpanded)}
              style={styles.detailsToggle}
            >
              <Text style={styles.detailsToggleText}>
                {billExpanded ? "Hide Details" : "View Details"}
              </Text>
              <Ionicons
                name={billExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.orange}
              />
            </Pressable>
          </View>

          {billExpanded && (
            <View style={styles.billDetails}>
              <View style={styles.billDetailRow}>
                <Text style={styles.billDetailLabel}>Item Total</Text>
                <Text style={styles.billDetailVal}>₹{subtotal.toFixed(2)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.billDetailRow}>
                  <Text style={[styles.billDetailLabel, { color: colors.green }]}>
                    Discount
                  </Text>
                  <Text style={[styles.billDetailVal, { color: colors.green }]}>
                    −₹{discount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.billDetailRow}>
                <Text style={styles.billDetailLabel}>Delivery Fee</Text>
                {deliveryFee === 0 ? (
                  <Text style={[styles.billDetailVal, { color: colors.green }]}>FREE</Text>
                ) : (
                  <Text style={styles.billDetailVal}>₹{deliveryFee.toFixed(2)}</Text>
                )}
              </View>
              <View style={styles.billDetailRow}>
                <Text style={styles.billDetailLabel}>{quote?.taxName || "Tax"}</Text>
                <Text style={styles.billDetailVal}>₹{tax.toFixed(2)}</Text>
              </View>
              {(quote?.damruDiscount || 0) > 0 && (
                <View style={styles.billDetailRow}>
                  <Text style={[styles.billDetailLabel, { color: colors.green }]}>Damru</Text>
                  <Text style={[styles.billDetailVal, { color: colors.green }]}>−₹{quote!.damruDiscount.toFixed(2)}</Text>
                </View>
              )}
            </View>
          )}
          {quoteQueryError && <Text style={{ color: colors.danger, marginTop: 8, fontSize: 12 }}>{quoteQueryError instanceof Error ? quoteQueryError.message : "Unable to calculate order total."}</Text>}
        </View>

        {/* ── Delivery Address Section ── */}
        <Text style={styles.sectionHeader}>Delivery Address</Text>
        <View style={styles.sectionCard}>
          {addresses.map((item) => (
            <Pressable
              key={item._id}
              onPress={() => setSelectedAddr(item._id!)}
              style={[
                styles.addressOption,
                selectedAddr === item._id && styles.selectedAddressOption,
              ]}
            >
              <Ionicons
                name={
                  selectedAddr === item._id
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={colors.orange}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.addressName}>
                  {item.fullName} <Text style={styles.addressTag}>({item.label})</Text>
                </Text>
                <Text style={styles.addressCopy}>
                  {item.house}, {item.area}, {item.city} {item.pincode}
                </Text>
                <Text style={styles.addressPhone}>Phone: {item.phone}</Text>
              </View>
            </Pressable>
          ))}

          {editingAddr ? (
            <View style={styles.addressForm}>
              <Field label="Label (e.g. Home, Office)" value={newAddr.label} onChangeText={updateNewAddr("label")} />
              <Field label="Full Name *" value={newAddr.fullName} onChangeText={updateNewAddr("fullName")} />
              <Field label="Phone Number *" value={newAddr.phone} onChangeText={updateNewAddr("phone")} keyboardType="phone-pad" />
              <Field label="House / Flat *" value={newAddr.house} onChangeText={updateNewAddr("house")} />
              <Field label="Area / Landmark" value={newAddr.area} onChangeText={updateNewAddr("area")} />
              <Field label="City *" value={newAddr.city} onChangeText={updateNewAddr("city")} />
              <Field label="State" value={newAddr.state} onChangeText={updateNewAddr("state")} />
              <Field label="Pincode *" value={newAddr.pincode} onChangeText={updateNewAddr("pincode")} keyboardType="number-pad" maxLength={6} />
              
              <View style={styles.formActions}>
                <Button label="Save Address" onPress={saveAddress} />
                <Button label="Cancel" variant="outline" onPress={() => setEditingAddr(false)} />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingAddr(true)}
              style={styles.addAddressBtn}
            >
              <Ionicons name="add" size={18} color={colors.orange} />
              <Text style={styles.addAddressBtnText}>Add a New Address</Text>
            </Pressable>
          )}
        </View>

        {/* ── Order Notes ── */}
        <Text style={styles.sectionHeader}>Order Notes (Optional)</Text>
        <View style={styles.sectionCard}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            placeholder="Special requests, allergies, spice preferences..."
            placeholderTextColor="#a99c94"
            style={styles.notesInput}
          />
        </View>

        {/* ── Redeem Damru ── */}
        {user && rewardsDashboard && rewardsDashboard.damruBalance > 0 && (
          <>
            <Text style={styles.sectionHeader}>Redeem Damru</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.redeemAvailableText}>🪙 Available: {rewardsDashboard.damruBalance} Damru</Text>
              <TextInput
                value={requestedDamru}
                onChangeText={setRequestedDamru}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#a99c94"
                style={styles.notesInput}
              />
              <Text style={styles.redeemNoteText}>The exact discount is confirmed once your order is placed.</Text>
            </View>
          </>
        )}

        {/* ── Payment Methods Title ── */}
        <Text style={styles.sectionHeader}>Payment Method</Text>

        <View style={[styles.sectionCard, payMethod === "razorpay" && styles.selectedPaymentCard]}>
          <Pressable
            onPress={() => setPayMethod("razorpay")}
            style={styles.paymentMethodRow}
            accessibilityRole="radio"
            accessibilityState={{ selected: payMethod === "razorpay" }}
            accessibilityLabel="Pay online securely with Razorpay"
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.ink} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paymentMethodTitle}>Pay Online with Razorpay</Text>
              <Text style={styles.paymentMethodSubtitle}>UPI · Credit/Debit Cards · Net Banking · Wallets</Text>
            </View>
            {payMethod === "razorpay" ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            )}
          </Pressable>
          {payMethod === "razorpay" && (
            <View style={styles.paymentSubPanel}>
              <Text style={styles.amountToPayLabel}>AMOUNT TO PAY</Text>
              <Text style={styles.amountToPayVal}>{total === undefined ? "Calculating…" : `₹${total.toFixed(2)}`}</Text>
              <Text style={styles.onlineSecurityText}>Payments are securely processed by Razorpay. Damru does not store your card, CVV, or UPI credentials.</Text>
            </View>
          )}
        </View>

        {/* Cash on Delivery (COD) Option */}
        <View style={[styles.sectionCard, payMethod === "cod" && styles.selectedPaymentCard]}>
          <Pressable
            onPress={() => setPayMethod("cod")}
            style={styles.paymentMethodRow}
            accessibilityRole="radio"
            accessibilityState={{ selected: payMethod === "cod" }}
            accessibilityLabel="Cash on delivery"
          >
            <Ionicons name="cash-outline" size={24} color={colors.ink} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paymentMethodTitle}>Cash on Delivery (COD)</Text>
              <Text style={styles.paymentMethodSubtitle}>Pay with cash when delivered</Text>
            </View>
            {payMethod === "cod" ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            )}
          </Pressable>

          {payMethod === "cod" && (
            <View style={styles.paymentSubPanel}>
              <Text style={styles.codInstructions}>
                Please keep exact change ready. You can pay our delivery partner via Cash or UPI at your doorstep.
              </Text>
            </View>
          )}
        </View>

        {/* ── Cart Summary Row ── */}
        <View style={styles.cartSummaryRow}>
          <View style={styles.avatarRow}>
            {cart.slice(0, 3).map((item, idx) => (
              <Image
                key={item.menuItemId}
                source={{ uri: assetUrl("menu-items", item.image) + "?tr=w-100,h-100,fo-auto" }}
                style={[styles.summaryAvatar, { marginLeft: idx > 0 ? -12 : 0 }]}
              />
            ))}
            {cart.length > 3 && (
              <View style={[styles.summaryAvatar, styles.avatarMore, { marginLeft: -12 }]}>
                <Text style={styles.avatarMoreText}>+{cart.length - 3}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cartSummaryText}>
            {cart.length} {cart.length === 1 ? "Item" : "Items"} in Cart:{" "}
            <Text style={{ fontWeight: "600", color: colors.ink }}>
              {cart[0]?.name}
              {cart.length > 1 ? " & more..." : ""}
            </Text>
          </Text>
        </View>
      </ScrollView>

      {/* ── Pay Now / Place Order action bar ── */}
      <View style={[styles.bottomBar, { bottom: insets.bottom > 0 ? insets.bottom + 80 : 96 }]}>
        <Pressable
          onPress={placeOrder}
          disabled={busy || quoteLoading || !quote}
          accessibilityRole="button"
          accessibilityLabel={payMethod === "cod" ? "Place order with cash on delivery" : payMethod === "razorpay" && total !== undefined ? `Pay ₹${total.toFixed(2)} securely with Razorpay` : "Select a payment method"}
          style={[
            styles.payBtn,
            (busy || quoteLoading || !quote) && styles.payBtnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.payBtnText}>
                {payMethod === "cod"
                  ? total === undefined ? "Calculating total…" : `Place Order · ₹${total.toFixed(2)}`
                  : payMethod === "razorpay" ? total === undefined ? "Calculating total…" : `Pay ₹${total.toFixed(2)} Securely` : "Select Payment Method"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </>
          )}
        </Pressable>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={13} color={colors.muted} />
          <Text style={styles.securityText}>
            {payMethod === "cod" ? "Cash on delivery" : payMethod === "razorpay" ? "Secure payment powered by Razorpay" : "Choose COD or online payment above"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2faf9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: "#ffffff",
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.ink,
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  headerSecureText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    color: "#198754",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 220,
  },
  payableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  payableMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payableSubLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  payablePrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: colors.ink,
    marginTop: 2,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailsToggleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  billDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
    gap: 8,
  },
  billDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  billDetailLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  billDetailVal: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: colors.ink,
  },
  sectionHeader: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: colors.ink,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  selectedPaymentCard: {
    borderWidth: 1,
    borderColor: colors.orange,
  },
  addressOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    gap: 10,
  },
  selectedAddressOption: {
    borderColor: colors.orange,
    backgroundColor: "#fff9f4",
  },
  addressName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
  },
  addressTag: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
  },
  addressCopy: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  addressPhone: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: colors.ink,
    marginTop: 4,
  },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderStyle: "dashed",
    borderRadius: 12,
    gap: 6,
  },
  addAddressBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.orange,
  },
  addressForm: {
    gap: 10,
    padding: 12,
    backgroundColor: "#fff9f4",
    borderRadius: 12,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  notesInput: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: "top",
    padding: 0,
  },
  redeemAvailableText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.ink,
    marginBottom: 8,
  },
  redeemNoteText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#a99c94",
    marginTop: 8,
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentMethodTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  paymentMethodSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  paymentSubPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  amountToPayLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  amountToPayVal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: colors.orange,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 16,
  },
  onlineSecurityText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 15,
  },
  codInstructions: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  cartSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6efef",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    gap: 12,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#f5f6f8",
  },
  avatarMore: {
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMoreText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    color: "#ffffff",
  },
  cartSummaryText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeDark,
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#ffffff",
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 10,
  },
  securityText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: colors.muted,
  },
});
