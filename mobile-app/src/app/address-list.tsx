import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { get, del } from "@/lib/api";
import { colors } from "@/config";
import type { Address } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { PremiumRefreshControl } from "@/components/ui/PremiumRefreshControl";

function AddressCardSkeleton() {
  return (
    <View style={styles.addressCard}>
      <View style={styles.cardHeader}>
        <View style={styles.labelRow}>
          <Skeleton width={16} height={16} radius={4} style={styles.labelIcon} />
          <Skeleton width={70} height={14} />
        </View>
        <View style={styles.actionRow}>
          <Skeleton width={16} height={16} radius={4} />
          <Skeleton width={16} height={16} radius={4} />
        </View>
      </View>
      <Skeleton width="45%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="55%" height={12.5} style={{ marginBottom: 8 }} />
      <Skeleton width="90%" height={13} style={{ marginBottom: 4 }} />
      <Skeleton width="70%" height={13} />
    </View>
  );
}

export default function AddressListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, error: queryError, refetch } = useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: () => get<{ addresses: Address[] }>("/api/address"),
    staleTime: 2 * 60 * 1000, // 2 minutes stale time
    select: (res) => res.addresses ?? [],
  });

  const addresses = data ?? [];
  const loading = isLoading;
  const refreshing = isRefetching;
  const error = queryError instanceof Error ? queryError.message : (queryError ? String(queryError) : null);

  const fetchAddresses = (_isRefresh?: boolean) => {
    refetch();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await del("/api/address", { id });
              queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to delete address.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Address Book",
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/add-address")}
              style={styles.headerAddBtn}
            >
              <Ionicons name="add" size={24} color={colors.orange} />
            </Pressable>
          ),
        }}
      />

      {loading && !refreshing ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <AddressCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchAddresses()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item._id || ""}
          refreshControl={
            React.createElement(PremiumRefreshControl, {
              refreshing: refreshing,
              onRefresh: () => fetchAddresses(true),
              colors: [colors.orange],
            })
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="No addresses saved"
              message="Add a delivery address to get started."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.addressCard}>
              <View style={styles.cardHeader}>
                <View style={styles.labelRow}>
                  <Ionicons
                    name={
                      item.label === "Home"
                        ? "home-outline"
                        : item.label === "Office"
                        ? "business-outline"
                        : "location-outline"
                    }
                    size={16}
                    color={colors.orange}
                    style={styles.labelIcon}
                  />
                  <Text style={styles.label}>{item.label}</Text>
                  {item.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/add-address",
                        params: { id: item._id },
                      })
                    }
                    style={styles.actionBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#756860" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item._id || "")}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.fullName}>{item.fullName}</Text>
              <Text style={styles.phone}>Phone: {item.phone}</Text>
              <Text style={styles.addressDetail}>
                {item.house}
                {item.area ? `, ${item.area}` : ""}
                {"\n"}
                {item.city}, {item.state} - {item.pincode}
              </Text>
            </View>
          )}
        />
      )}

      <View style={styles.footerBtn}>
        <Pressable
          onPress={() => router.push("/add-address")}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={20} color="#ffffff" style={styles.btnIcon} />
          <Text style={styles.addBtnText}>Add New Address</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  headerAddBtn: {
    padding: 4,
    marginRight: -4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Make room for footer button
  },
  addressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee3da",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelIcon: {
    marginRight: 6,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  defaultBadge: {
    marginLeft: 8,
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 121, 34, 0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: colors.orange,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  fullName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#756860",
    marginBottom: 2,
  },
  phone: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12.5,
    color: "#756860",
    marginBottom: 6,
  },
  addressDetail: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#756860",
    lineHeight: 18,
  },
  errorText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },
  footerBtn: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3ece6",
  },
  addBtn: {
    backgroundColor: colors.orange,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnIcon: {
    marginRight: 4,
  },
  addBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#ffffff",
  },
});
