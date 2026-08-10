import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, EmptyState } from "../components/ui";
import { useApp } from "../providers/AppProvider";
import { assetUrl, colors } from "../config";
import { post } from "../lib/api";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, subtotal, setQuantity, totalItems, user } = useApp();

  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [couponModalOpen, setCouponModalOpen] = useState(false);

  // Taxes are 5% of subtotal after coupon discount
  const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
  const total = Math.max(0, subtotal - discount + tax);

  async function applyCoupon() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const data = await post<{
        valid: boolean;
        discount?: number;
        message?: string;
        coupon?: { code: string };
      }>("/api/coupons", { code, cartTotal: subtotal });

      if (!data.valid) {
        Alert.alert("Coupon", data.message ?? "This coupon is not valid.");
      } else {
        setDiscount(data.discount ?? 0);
        setCoupon(data.coupon?.code ?? code.toUpperCase());
        setCouponModalOpen(false);
      }
    } catch (e: any) {
      Alert.alert("Coupon", e?.message ?? "Could not validate coupon.");
    } finally {
      setBusy(false);
    }
  }

  function removeCoupon() {
    setDiscount(0);
    setCoupon("");
    setCode("");
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Image
        source={
          item.image
            ? { uri: assetUrl("menu-items", item.image) + "?tr=w-130,h-130,fo-auto" }
            : null
        }
        style={styles.cardImage}
      />
      <View style={styles.cardDetails}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.custom ? (
          <Text style={styles.cardCustom} numberOfLines={1}>
            {item.custom}
          </Text>
        ) : (
          <Text style={styles.cardCustom} numberOfLines={1}>
            Classic recipe
          </Text>
        )}
        <Text style={styles.cardPrice}>₹{item.price}</Text>
      </View>

      {/* Stepper design matching orange pill */}
      <View style={styles.stepperPill}>
        <Pressable
          onPress={() => setQuantity(item, item.qty - 1)}
          style={styles.stepperBtn}
          accessibilityLabel="Decrease quantity"
        >
          <Ionicons name="remove" size={16} color="#ffffff" />
        </Pressable>
        <Text style={styles.stepperQty}>{item.qty}</Text>
        <Pressable
          onPress={() => setQuantity(item, item.qty + 1)}
          style={styles.stepperBtn}
          accessibilityLabel="Increase quantity"
        >
          <Ionicons name="add" size={16} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Custom Header matching design ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>My Cart</Text>
        <View style={styles.headerRight}>
          <Ionicons name="bag-handle-outline" size={18} color={colors.muted} />
          <Text style={styles.headerCountText}>{totalItems} Items</Text>
        </View>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title="Your Cart is Empty"
            message="Looks like you haven't added anything to your cart yet."
          />
          <Pressable
            onPress={() => router.navigate("/menu")}
            style={styles.exploreBtn}
          >
            <Text style={styles.exploreBtnText}>Go to Menu</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(item) => `${item.menuItemId}-${item.custom}`}
            renderItem={renderItem}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>Your Selection</Text>
            }
            ListFooterComponent={
              <View style={styles.footerContainer}>
                {/* Apply Coupon Section */}
                {coupon ? (
                  <View style={styles.appliedCouponCard}>
                    <Ionicons name="pricetag" size={20} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appliedCouponTitle}>
                        Coupon Applied: {coupon}
                      </Text>
                      <Text style={styles.appliedCouponDesc}>
                        You saved ₹{discount.toFixed(2)} on this order
                      </Text>
                    </View>
                    <Pressable onPress={removeCoupon}>
                      <Ionicons name="close-circle" size={22} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setCouponModalOpen(true)}
                    style={styles.applyCouponCard}
                  >
                    <Ionicons name="pricetag-outline" size={20} color={colors.orange} />
                    <Text style={styles.applyCouponText}>Apply Coupon</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.orange} />
                  </Pressable>
                )}

                {/* Bill Summary */}
                <View style={styles.billCard}>
                  <Text style={styles.billTitle}>Bill Summary</Text>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Item Total</Text>
                    <Text style={styles.billVal}>₹{subtotal.toFixed(2)}</Text>
                  </View>

                  {discount > 0 && (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: colors.green }]}>
                        Discount ({coupon})
                      </Text>
                      <Text style={[styles.billVal, { color: colors.green }]}>
                        −₹{discount.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.billRow}>
                    <View style={styles.deliveryLabelRow}>
                      <Text style={styles.billLabel}>Delivery Fee</Text>
                      <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
                    </View>
                    <Text style={[styles.billVal, { color: colors.green, fontWeight: "600" }]}>
                      FREE
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Taxes & Charges</Text>
                    <Text style={styles.billVal}>₹{tax.toFixed(2)}</Text>
                  </View>

                  <View style={styles.billDivider} />

                  <View style={[styles.billRow, { marginTop: 4 }]}>
                    <Text style={styles.payLabel}>To Pay</Text>
                    <Text style={styles.payVal}>₹{total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            }
          />

          {/* Proceed to Checkout anchored button */}
          <View style={[styles.bottomBar, { bottom: insets.bottom > 0 ? insets.bottom + 80 : 96 }]}>
            <Pressable
              onPress={() => {
                if (!user) {
                  router.push("/auth");
                  return;
                }
                router.push({
                  pathname: "/checkout",
                  params: { coupon, discount: String(discount) },
                });
              }}
              style={styles.checkoutBtn}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </>
      )}

      {/* Coupon Modal */}
      <Modal
        visible={couponModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCouponModalOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.couponModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Coupon</Text>
              <Pressable onPress={() => setCouponModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>

            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Enter coupon code (e.g. WELCOME50)"
              placeholderTextColor="#a99c94"
              autoCapitalize="characters"
              style={styles.modalInput}
            />

            <Pressable
              onPress={applyCoupon}
              disabled={busy || !code.trim()}
              style={[styles.modalApplyBtn, (busy || !code.trim()) && styles.modalBtnDisabled]}
            >
              <Text style={styles.modalApplyText}>
                {busy ? "Validating..." : "Apply"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#e6efef",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  headerCountText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  exploreBtn: {
    marginTop: 20,
    backgroundColor: colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 220,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.ink,
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#f5f6f8",
  },
  cardDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: colors.ink,
  },
  cardCustom: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  cardPrice: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: colors.orange,
    marginTop: 6,
  },
  stepperPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.orange,
    borderRadius: 18,
    height: 32,
    paddingHorizontal: 8,
    gap: 8,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperQty: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: "#ffffff",
    minWidth: 16,
    textAlign: "center",
  },
  footerContainer: {
    marginTop: 16,
    gap: 16,
  },
  applyCouponCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderStyle: "dashed",
    backgroundColor: "#fff9f4",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  applyCouponText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
    flex: 1,
  },
  appliedCouponCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#a5d6a7",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  appliedCouponTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  appliedCouponDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  billCard: {
    backgroundColor: "#e6efef",
    borderRadius: 20,
    padding: 20,
  },
  billTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.ink,
    marginBottom: 16,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  billLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
  deliveryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  billVal: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: colors.ink,
  },
  billDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    marginVertical: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  payLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: colors.ink,
  },
  payVal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: colors.ink,
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
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange,
    height: 52,
    borderRadius: 12,
    gap: 8,
  },
  checkoutBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  couponModalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.ink,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: colors.ink,
    marginBottom: 16,
  },
  modalApplyBtn: {
    backgroundColor: colors.orange,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalApplyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
});
