import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import type { PaymentMethod } from "@/types";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

interface PaymentMethodCardProps {
  paymentMethods: PaymentMethod[];
}

export function PaymentMethodCard({ paymentMethods }: PaymentMethodCardProps) {
  const router = useRouter();
  const primaryCard = paymentMethods.find((c) => c.isDefault) || paymentMethods[0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="card-outline" size={18} color={colors.orange} />
          <Text style={styles.title}>Payment Method</Text>
        </View>
        {paymentMethods.length > 0 ? (
          <Pressable onPress={() => router.push("/payment-methods")} style={styles.manageBtn}>
            <Text style={styles.viewAllText}>Manage ({paymentMethods.length})</Text>
          </Pressable>
        ) : null}
      </View>

      {primaryCard ? (
        <LinearGradient
          colors={["#2c343b", "#14191c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardContainer}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.chipBorder}>
              <View style={styles.chipBody}>
                <View style={styles.chipLines} />
              </View>
            </View>
            <Text style={styles.cardBrand}>{primaryCard.brand.toUpperCase()}</Text>
          </View>
          
          <View style={styles.cardMiddleRow}>
            <Text style={styles.cardNumber}>••••  ••••  ••••  {primaryCard.last4}</Text>
          </View>

          <View style={styles.cardBottomRow}>
            <View>
              <Text style={styles.cardLabel}>CARDHOLDER</Text>
              <Text style={styles.cardValue}>Saved Member</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.cardLabel}>EXPIRES</Text>
              <Text style={styles.cardValue}>12 / 29</Text>
            </View>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="card-outline" size={24} color="#a99c94" style={{ marginBottom: 6 }} />
          <Text style={styles.emptyText}>No saved cards yet.</Text>
        </View>
      )}

      <Pressable
        onPress={() => router.push("/payment-methods")}
        style={({ pressed }) => [
          styles.addBtn,
          pressed && { backgroundColor: "rgba(229, 121, 34, 0.06)" }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add New Payment Method"
      >
        <Ionicons name="add-circle-outline" size={16} color={colors.orange} style={styles.addIcon} />
        <Text style={styles.addBtnText}>Add New Card</Text>
      </Pressable>
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
  viewAllText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  cardContainer: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    height: 124,
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chipBorder: {
    width: 30,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.4)", // Gold outline
    padding: 1,
  },
  chipBody: {
    flex: 1,
    backgroundColor: "#e5c158", // Gold color
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  chipLines: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  cardNumber: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#ffffff",
    letterSpacing: 2.5,
  },
  cardMiddleRow: {
    marginVertical: 8,
  },
  cardBrand: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    color: "#ffffff",
    opacity: 0.85,
    letterSpacing: 1,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardLabel: {
    fontSize: 7.5,
    fontFamily: "Poppins_600SemiBold",
    color: "#a99c94",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cardValue: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "#ffffff",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf9f6",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eee3da",
    marginBottom: 14,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#a99c94",
  },
  addBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229, 121, 34, 0.01)",
  },
  addIcon: {
    marginRight: 4,
  },
  addBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.orange,
  },
});
