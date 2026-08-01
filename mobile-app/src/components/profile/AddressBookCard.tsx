import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/config";
import type { Address } from "@/types";
import { useRouter } from "expo-router";

interface AddressBookCardProps {
  addresses: Address[];
}

export function AddressBookCard({ addresses }: AddressBookCardProps) {
  const router = useRouter();
  const primaryAddress = addresses.find((a) => a.isDefault) || addresses[0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="map-outline" size={18} color={colors.orange} />
          <Text style={styles.title}>Saved Addresses</Text>
        </View>
        {addresses.length > 0 ? (
          <Pressable onPress={() => router.push("/address-list")} style={styles.manageBtn}>
            <Text style={styles.viewAllText}>Manage ({addresses.length})</Text>
          </Pressable>
        ) : null}
      </View>

      {primaryAddress ? (
        <View style={styles.addressContainer}>
          <View style={styles.labelRow}>
            <View style={styles.labelWrapper}>
              <Ionicons
                name={
                  primaryAddress.label === "Home"
                    ? "home"
                    : primaryAddress.label === "Office"
                    ? "business"
                    : "location"
                }
                size={12}
                color={colors.orange}
                style={styles.labelIcon}
              />
              <Text style={styles.addressLabel}>{primaryAddress.label}</Text>
            </View>
            {primaryAddress.isDefault ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default Delivery</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.fullName}>{primaryAddress.fullName}</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {primaryAddress.house}
            {primaryAddress.area ? `, ${primaryAddress.area}` : ""}
            {"\n"}
            {primaryAddress.city}, {primaryAddress.state} - {primaryAddress.pincode}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="location-outline" size={24} color="#a99c94" style={{ marginBottom: 6 }} />
          <Text style={styles.emptyText}>No delivery address saved yet.</Text>
        </View>
      )}

      <Pressable
        onPress={() => router.push("/add-address")}
        style={({ pressed }) => [
          styles.addBtn,
          pressed && { backgroundColor: "rgba(229, 121, 34, 0.06)" }
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add New Address"
      >
        <Ionicons name="add-circle-outline" size={16} color={colors.orange} style={styles.addIcon} />
        <Text style={styles.addBtnText}>Add New Address</Text>
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
  addressContainer: {
    backgroundColor: "#fffdfb",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fcf0e4",
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  labelWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(229, 121, 34, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  labelIcon: {
    marginRight: 4,
  },
  addressLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: colors.orange,
  },
  defaultBadge: {
    backgroundColor: "#e8f5e9",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: "#c8e6c9",
  },
  defaultBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: "#15803d",
  },
  fullName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 2,
  },
  addressText: {
    fontFamily: "Poppins_400Regular",
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
