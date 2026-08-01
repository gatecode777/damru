import React, { useEffect, useState } from "react";
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
import { get, post } from "../lib/api";
import { useApp } from "../providers/AppProvider";
import { StaticAssets } from "../constants/assets";
import type { Address } from "../types";

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
  const { coupon, discount: discountParam } = useLocalSearchParams<{
    coupon?: string;
    discount?: string;
  }>();

  const { cart, subtotal, clearCart } = useApp();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [editingAddr, setEditingAddr] = useState(false);
  const [newAddr, setNewAddr] = useState<Address>(emptyAddress);

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Bill calculations
  const discount = Number(discountParam || 0);
  const deliveryFee = 0; // FREE Delivery
  const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
  const total = Math.max(0, subtotal - discount + tax + deliveryFee);

  // UI States
  const [billExpanded, setBillExpanded] = useState(false);
  const [payMethod, setPayMethod] = useState<"upi" | "card" | "cod">("upi");
  
  // UPI ID validation states
  const [upiId, setUpiId] = useState("");
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifyingUpi, setVerifyingUpi] = useState(false);

  // Card input states
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Fetch Saved Addresses
  useEffect(() => {
    get<{ addresses: Address[] }>("/api/address")
      .then((data) => {
        setAddresses(data.addresses || []);
        const defaultAddr =
          data.addresses.find((a) => a.isDefault) ?? data.addresses[0];
        if (defaultAddr?._id) {
          setSelectedAddr(defaultAddr._id);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to fetch addresses:", err);
      });
  }, []);

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
      setAddresses((items) => [...items, data.address]);
      setSelectedAddr(data.address._id!);
      setEditingAddr(false);
      setNewAddr(emptyAddress);
    } catch (e: any) {
      Alert.alert("Address", e?.message ?? "Could not save address.");
    }
  }

  async function handleVerifyUpi() {
    if (!upiId.trim() || !upiId.includes("@")) {
      Alert.alert("UPI Verification", "Please enter a valid UPI ID (e.g. name@upi)");
      return;
    }
    setVerifyingUpi(true);
    // Mock network call representing API UPI verification
    setTimeout(() => {
      setVerifyingUpi(false);
      setUpiVerified(true);
    }, 1500);
  }

  async function placeOrder() {
    if (!selectedAddr) {
      Alert.alert("Delivery address", "Please select or add an address.");
      return;
    }

    setBusy(true);
    try {
      // Map "upi" and "card" selection securely to backend order creation
      const response = await post<{
        order: { orderNumber?: string; _id: string };
      }>("/api/orders", {
        addressId: selectedAddr,
        paymentMethod: payMethod,
        couponCode: coupon || undefined,
        notes: notes.trim(),
      });

      // Clear the local and database cart
      await clearCart();

      // Show success screen and route back
      Alert.alert(
        "Order Confirmed! 🎉",
        `Your order #${
          response.order.orderNumber ?? response.order._id.slice(-6)
        } has been successfully placed.`,
        [
          {
            text: "View Orders",
            onPress: () => router.replace("/(tabs)/profile"),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert(
        "Could not place order",
        e?.message ?? "An unexpected error occurred. Please try again."
      );
    } finally {
      setBusy(false);
    }
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
              <Text style={styles.payablePrice}>₹{total.toFixed(2)}</Text>
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
                <Text style={[styles.billDetailVal, { color: colors.green }]}>
                  FREE
                </Text>
              </View>
              <View style={styles.billDetailRow}>
                <Text style={styles.billDetailLabel}>Taxes (5%)</Text>
                <Text style={styles.billDetailVal}>₹{tax.toFixed(2)}</Text>
              </View>
            </View>
          )}
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

        {/* ── Payment Methods Title ── */}
        <Text style={styles.sectionHeader}>Payment Method</Text>

        {/* 1. Credit / Debit Card Option */}
        <View style={styles.sectionCard}>
          <Pressable
            onPress={() => setPayMethod("card")}
            style={styles.paymentMethodRow}
          >
            <Ionicons name="card-outline" size={24} color={colors.ink} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paymentMethodTitle}>Credit / Debit Card</Text>
              <Text style={styles.paymentMethodSubtitle}>Visa, Mastercard, RuPay</Text>
            </View>
            <Ionicons
              name={payMethod === "card" ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>

          {payMethod === "card" && (
            <View style={styles.paymentSubPanel}>
              <Text style={styles.paymentWarning}>
                Card checkout sandbox mode. Enter details to simulate.
              </Text>
              <TextInput
                value={cardHolder}
                onChangeText={setCardHolder}
                placeholder="Cardholder Name"
                placeholderTextColor="#a99c94"
                style={styles.subInput}
              />
              <TextInput
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="Card Number"
                placeholderTextColor="#a99c94"
                keyboardType="number-pad"
                style={styles.subInput}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextInput
                  value={cardExp}
                  onChangeText={setCardExp}
                  placeholder="MM/YY"
                  placeholderTextColor="#a99c94"
                  style={[styles.subInput, { flex: 1 }]}
                />
                <TextInput
                  value={cardCvv}
                  onChangeText={setCardCvv}
                  placeholder="CVV"
                  placeholderTextColor="#a99c94"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={3}
                  style={[styles.subInput, { flex: 1 }]}
                />
              </View>
            </View>
          )}
        </View>

        {/* 2. UPI / Scan QR Option */}
        <View style={[styles.sectionCard, payMethod === "upi" && styles.selectedPaymentCard]}>
          <Pressable
            onPress={() => setPayMethod("upi")}
            style={styles.paymentMethodRow}
          >
            <Ionicons name="qr-code-outline" size={24} color={colors.ink} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paymentMethodTitle}>UPI / Scan QR</Text>
              <Text style={styles.paymentMethodSubtitle}>
                Pay via GPay, PhonePe, Paytm
              </Text>
            </View>
            {payMethod === "upi" ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            )}
          </Pressable>

          {payMethod === "upi" && (
            <View style={styles.paymentSubPanel}>
              <Text style={styles.amountToPayLabel}>AMOUNT TO PAY</Text>
              <Text style={styles.amountToPayVal}>₹{total.toFixed(2)}</Text>

              {/* QR Image Box */}
              <View style={styles.qrImageContainer}>
                <Image
                  source={StaticAssets.upiQr}
                  style={styles.qrImage}
                  contentFit="contain"
                />
              </View>

              <Text style={styles.qrInstructions}>
                Scan this QR using any UPI app
              </Text>

              {/* UPI ID input */}
              <Text style={styles.upiLabel}>OR PAY VIA UPI ID</Text>
              <View style={styles.upiInputRow}>
                <TextInput
                  value={upiId}
                  onChangeText={(val) => {
                    setUpiId(val);
                    setUpiVerified(false);
                  }}
                  placeholder="example@upi"
                  placeholderTextColor="#a99c94"
                  autoCapitalize="none"
                  style={styles.upiInput}
                />
                <Pressable
                  onPress={handleVerifyUpi}
                  disabled={verifyingUpi || upiVerified || !upiId.trim()}
                  style={[
                    styles.verifyBtn,
                    (verifyingUpi || upiVerified || !upiId.trim()) &&
                      styles.verifyBtnDisabled,
                  ]}
                >
                  {verifyingUpi ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.verifyBtnText}>
                      {upiVerified ? "VERIFIED ✓" : "VERIFY"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* 3. Cash on Delivery (COD) Option */}
        <View style={[styles.sectionCard, payMethod === "cod" && styles.selectedPaymentCard]}>
          <Pressable
            onPress={() => setPayMethod("cod")}
            style={styles.paymentMethodRow}
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
                source={{ uri: assetUrl("menu-items", item.image) }}
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
          disabled={busy || (payMethod === "upi" && !upiVerified)}
          style={[
            styles.payBtn,
            (busy || (payMethod === "upi" && !upiVerified)) && styles.payBtnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.payBtnText}>
                {payMethod === "cod"
                  ? `Place Order · ₹${total.toFixed(2)}`
                  : `Pay Now ₹${total.toFixed(2)}`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </>
          )}
        </Pressable>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={13} color={colors.muted} />
          <Text style={styles.securityText}>
            Payments are secured by 128-bit encryption
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
  paymentWarning: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginBottom: 10,
  },
  subInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
    marginBottom: 8,
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
  qrImageContainer: {
    alignSelf: "center",
    backgroundColor: "#f5f6f8",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  qrImage: {
    width: 140,
    height: 140,
  },
  qrInstructions: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  upiLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: colors.ink,
    marginBottom: 8,
  },
  upiInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  upiInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.ink,
  },
  verifyBtn: {
    backgroundColor: colors.orangeDark,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  verifyBtnDisabled: {
    backgroundColor: "#198754",
    opacity: 0.8,
  },
  verifyBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 0.5,
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
