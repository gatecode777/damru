import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/config";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { Skeleton } from "@/components/ui/Skeleton";
import { PremiumRefreshControl } from "@/components/ui/PremiumRefreshControl";

export function PaymentMethodsSection() {
  const insets = useSafeAreaInsets();
  const query = usePaymentMethods();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 112 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <PremiumRefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />
      }
    >
      <Text style={styles.title}>Payment Methods</Text>
      <Text style={styles.subtitle}>Manage your saved payment methods for faster and safer checkout.</Text>

      {query.isLoading ? (
        <View style={styles.loadingCard} accessibilityLabel="Loading payment methods">
          <Skeleton width={52} height={32} radius={8} />
          <View style={styles.skeletonLines}>
            <Skeleton height={12} width="58%" />
            <Skeleton height={12} width="38%" />
          </View>
        </View>
      ) : query.isError ? (
        <View style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.muted} />
          <Text style={styles.stateTitle}>Unable to load payment methods.</Text>
          <Text style={styles.stateCopy}>Check your connection and try again.</Text>
          <Pressable style={styles.retryButton} onPress={() => query.refetch()} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : query.data?.methods.length ? (
        <View style={styles.methodList}>
          {query.data.methods.map((method) => (
            <View key={method.id} style={styles.methodCard}>
              <View style={styles.brandMark}><Text style={styles.brandText}>{method.brand.slice(0, 4).toUpperCase()}</Text></View>
              <View style={styles.methodCopy}>
                <Text style={styles.methodNumber}>•••• {method.last4}</Text>
                <Text style={styles.methodMeta}>{method.brand}</Text>
              </View>
              {method.isPrimary ? <View style={styles.primaryBadge}><Text style={styles.primaryText}>Primary</Text></View> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.stateCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="card-outline" size={30} color={colors.orange} />
          </View>
          <Text style={styles.stateTitle}>No payment methods saved</Text>
          <Text style={styles.stateCopy}>Add a payment method when you make your next secure payment.</Text>
          <Pressable
            style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
            onPress={() => router.push("/payment-methods")}
            accessibilityRole="button"
            accessibilityLabel="Add payment method securely with Razorpay"
          >
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={styles.inlineButtonText}>Add Payment Method</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.securityCard}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
        <Text style={styles.securityCopy}>
          Payments are securely processed by Razorpay. Damru does not store your full card number, CVV, UPI PIN, or OTP.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.mainButton, pressed && styles.pressed]}
        onPress={() => router.push("/payment-methods")}
        accessibilityRole="button"
        accessibilityLabel="Add new payment method"
      >
        <Text style={styles.mainButtonText}>+ Add New Payment Method</Text>
      </Pressable>

      <View style={styles.providerRow}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <Text style={styles.providerText}>Secured by Razorpay</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#faf9f6" },
  content: { paddingHorizontal: 18, paddingTop: 22 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 22, color: colors.ink },
  subtitle: { marginTop: 6, fontFamily: "Poppins_400Regular", fontSize: 13, lineHeight: 20, color: colors.muted },
  stateCard: { marginTop: 24, minHeight: 218, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(229,121,34,0.09)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  stateTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 17, color: colors.ink, textAlign: "center" },
  stateCopy: { marginTop: 6, maxWidth: 285, fontFamily: "Poppins_400Regular", fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: "center" },
  inlineButton: { minHeight: 44, marginTop: 18, borderRadius: 12, paddingHorizontal: 18, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange },
  inlineButtonText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#fff" },
  loadingCard: { marginTop: 24, height: 104, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", gap: 16 },
  skeletonLines: { flex: 1, gap: 10 },
  skeleton: { height: 12, borderRadius: 6, backgroundColor: "#f0e9e3" },
  retryButton: { marginTop: 16, paddingHorizontal: 22, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.orange },
  retryText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#fff" },
  methodList: { marginTop: 24, gap: 11 },
  methodCard: { minHeight: 88, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center" },
  brandMark: { width: 52, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
  brandText: { fontFamily: "Poppins_700Bold", fontSize: 10, color: colors.orangeDark },
  methodCopy: { flex: 1, marginLeft: 12 },
  methodNumber: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: colors.ink },
  methodMeta: { marginTop: 2, fontFamily: "Poppins_400Regular", fontSize: 12, color: colors.muted, textTransform: "capitalize" },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.cream, borderWidth: 1, borderColor: "rgba(229,121,34,0.25)" },
  primaryText: { fontFamily: "Poppins_600SemiBold", fontSize: 10, color: colors.orange },
  securityCard: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  securityCopy: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 11.5, lineHeight: 18, color: colors.muted },
  mainButton: { marginTop: 19, minHeight: 52, borderRadius: 14, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  mainButtonText: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  providerRow: { marginTop: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  providerText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: colors.muted },
  pressed: { opacity: 0.86 },
});
