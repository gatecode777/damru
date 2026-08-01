import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import type { Coupon } from "@/types";
import { useRouter } from "expo-router";

interface CouponCardProps {
  coupons: Coupon[];
}

export function CouponCard({ coupons }: CouponCardProps) {
  const router = useRouter();
  const displayedCoupons = coupons.slice(0, 2);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="pricetag-outline" size={18} color={colors.orange} />
          <Text style={styles.title}>Offers & Coupons</Text>
        </View>
        {coupons.length > 0 ? (
          <Pressable onPress={() => router.push("/offers")} style={styles.manageBtn}>
            <View style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.orange} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {displayedCoupons.length > 0 ? (
        <View style={styles.couponsContainer}>
          {displayedCoupons.map((coupon, index) => (
            <View
              key={coupon._id}
              style={[
                styles.couponItem,
                index > 0 && styles.couponItemSeparator,
              ]}
            >
              {/* Ticket stub left and right circle punch-outs */}
              <View style={[styles.punchout, styles.punchoutLeft]} />
              <View style={[styles.punchout, styles.punchoutRight]} />

              <View style={styles.couponHeader}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{coupon.code}</Text>
                </View>
                {coupon.expiryDate ? (
                  <Text style={styles.expiryText}>
                    Till {new Date(coupon.expiryDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.description}>
                {coupon.description ||
                  (coupon.type === "flat"
                    ? `₹${coupon.value} OFF on your order`
                    : `${coupon.value}% OFF on your order`)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="pricetags-outline" size={24} color="#a99c94" style={{ marginBottom: 6 }} />
          <Text style={styles.emptyText}>No offers available right now.</Text>
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
  couponsContainer: {
    gap: 12,
  },
  couponItem: {
    backgroundColor: "#fffdfb",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#fcf0e4",
    position: "relative",
    overflow: "hidden", // Keep punchouts clipping clean
  },
  couponItemSeparator: {
    // Keep them separated cleanly
  },
  punchout: {
    position: "absolute",
    top: "50%",
    marginTop: -8, // Center vertically (height is 16)
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff", // Match card background to cut out
    borderWidth: 1,
    borderColor: "#fcf0e4",
    zIndex: 2,
  },
  punchoutLeft: {
    left: -9,
  },
  punchoutRight: {
    right: -9,
  },
  couponHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: "rgba(229, 121, 34, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(229, 121, 34, 0.2)",
    borderStyle: "dashed",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  codeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 0.5,
  },
  expiryText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: "#a99c94",
  },
  description: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12.5,
    color: "#756860",
    lineHeight: 18,
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
