import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors } from "@/config";

export function PaymentMethodCard() {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="card-outline" size={18} color={colors.orange} />
          <Text style={styles.title}>Payment Methods</Text>
        </View>
        <Pressable onPress={() => router.push("/payment-methods")} style={styles.manageBtn}>
          <Text style={styles.viewText}>View</Text>
        </Pressable>
      </View>

      <View style={styles.secureCard}>
        <Ionicons name="shield-checkmark-outline" size={25} color={colors.orange} />
        <Text style={styles.secureText}>Payment details are securely handled by Razorpay at checkout.</Text>
      </View>

      <Pressable
        onPress={() => router.push("/payment-methods")}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.84 }]}
        accessibilityRole="button"
        accessibilityLabel="Open payment methods"
      >
        <Ionicons name="add-circle-outline" size={17} color={colors.orange} />
        <Text style={styles.actionText}>Payment Methods</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginHorizontal: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: colors.line },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: colors.ink },
  manageBtn: { paddingVertical: 3, paddingHorizontal: 4 },
  viewText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: colors.orange },
  secureCard: { padding: 16, borderRadius: 16, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 11 },
  secureText: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted },
  action: { height: 44, marginTop: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.orange, borderStyle: "dashed", flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: colors.orange },
});
