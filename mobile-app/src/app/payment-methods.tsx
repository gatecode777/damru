import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/config";
import { get, getApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useApp } from "@/providers/AppProvider";
import type { Address } from "@/types";

const SECURE_METHODS = [
  { icon: "phone-portrait-outline" as const, label: "UPI" },
  { icon: "card-outline" as const, label: "Credit & Debit Cards" },
  { icon: "business-outline" as const, label: "Net Banking" },
  { icon: "wallet-outline" as const, label: "Wallets" },
];

function addressSummary(address: Address) {
  return `${address.house}${address.area ? `, ${address.area}` : ""}\n${address.city}, ${address.state} ${address.pincode}`;
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { totalItems } = useApp();
  const addressesQuery = useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: () => get<{ addresses: Address[] }>("/api/address"),
    select: (data) => data.addresses ?? [],
  });
  const addresses = addressesQuery.data ?? [];
  const defaultAddress = addresses.find((item) => item.isDefault) ?? addresses[0];
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selectedAddress = addresses.find((item) => item._id === selectedId) ?? defaultAddress;

  function selectAddress() {
    if (!addresses.length) {
      router.push("/add-address");
      return;
    }
    Alert.alert(
      "Select Billing Address",
      "Choose an address to use at checkout.",
      [
        ...addresses.map((address) => ({
          text: `${address.label}${address.isDefault ? " (Default)" : ""}`,
          onPress: () => setSelectedId(address._id),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  function continueSecurely() {
    if (totalItems > 0) {
      router.push("/cart");
      return;
    }
    Alert.alert(
      "Add during checkout",
      "Choose your food first. Razorpay will securely present the available payment methods when you check out.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Browse Menu", onPress: () => router.push("/(tabs)/menu") },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 108 }]}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: "Add Payment Method", headerShown: true }} />

      <View style={styles.heroIcon}>
        <Ionicons name="shield-checkmark" size={30} color={colors.orange} />
      </View>
      <Text style={styles.title}>Secure Payment Method</Text>
      <Text style={styles.subtitle}>Payment methods are entered and processed securely through Razorpay.</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Available at checkout</Text>
        <View style={styles.methodGrid}>
          {SECURE_METHODS.map((method) => (
            <View key={method.label} style={styles.methodItem}>
              <View style={styles.methodIcon}><Ionicons name={method.icon} size={19} color={colors.orange} /></View>
              <Text style={styles.methodLabel}>{method.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Billing Address</Text>
        <Text style={styles.panelHint}>Use an address from your Address Book for checkout.</Text>

        {addressesQuery.isLoading ? (
          <View style={styles.addressLoading}><ActivityIndicator color={colors.orange} /></View>
        ) : addressesQuery.isError ? (
          <View style={styles.addressError}>
            <Text style={styles.errorText}>{getApiErrorMessage(addressesQuery.error, "Unable to load addresses.")}</Text>
            <Pressable onPress={() => addressesQuery.refetch()}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : (
          <Pressable style={styles.addressPicker} onPress={selectAddress} accessibilityRole="button">
            <Ionicons name={selectedAddress ? "location-outline" : "add-circle-outline"} size={21} color={colors.orange} />
            <View style={styles.addressCopy}>
              <Text style={styles.addressLabel}>{selectedAddress?.label ?? "Add Billing Address"}</Text>
              <Text style={styles.addressValue}>{selectedAddress ? addressSummary(selectedAddress) : "No saved address"}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.securityNote}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
        <Text style={styles.securityText}>Damru does not collect or store your full card number, CVV, UPI PIN, or OTP.</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.86 }]}
        onPress={continueSecurely}
        accessibilityRole="button"
        accessibilityLabel={totalItems > 0 ? "Continue to secure checkout" : "Browse menu to start checkout"}
      >
        <Text style={styles.ctaText}>{totalItems > 0 ? "Continue to Secure Checkout" : "Browse Menu to Continue"}</Text>
      </Pressable>
      <View style={styles.providerRow}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <Text style={styles.providerText}>Secured by Razorpay</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf9f6" },
  content: { paddingHorizontal: 18, paddingTop: 26 },
  heroIcon: { width: 62, height: 62, borderRadius: 31, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(229,121,34,0.1)" },
  title: { marginTop: 14, fontFamily: "Poppins_700Bold", fontSize: 22, color: colors.ink, textAlign: "center" },
  subtitle: { marginTop: 6, alignSelf: "center", maxWidth: 330, fontFamily: "Poppins_400Regular", fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: "center" },
  panel: { marginTop: 22, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff" },
  panelTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: colors.ink },
  panelHint: { marginTop: 4, fontFamily: "Poppins_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted },
  methodGrid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  methodItem: { width: "48%", minHeight: 58, borderRadius: 13, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line },
  methodIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(229,121,34,0.09)", alignItems: "center", justifyContent: "center" },
  methodLabel: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 11.5, lineHeight: 16, color: colors.ink },
  addressLoading: { height: 76, alignItems: "center", justifyContent: "center" },
  addressError: { minHeight: 70, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#fff4f3", alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: colors.danger, textAlign: "center" },
  retryText: { marginTop: 7, fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  addressPicker: { minHeight: 82, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  addressCopy: { flex: 1 },
  addressLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.ink },
  addressValue: { marginTop: 3, fontFamily: "Poppins_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted },
  securityNote: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  securityText: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 11.5, lineHeight: 18, color: colors.muted },
  cta: { minHeight: 52, marginTop: 19, borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange },
  ctaText: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  providerRow: { marginTop: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  providerText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: colors.muted },
});
