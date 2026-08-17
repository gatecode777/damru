import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { get } from "@/lib/api";
import { colors } from "@/config";
import type { Coupon } from "@/types";
import { EmptyState } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";

function CouponCardSkeleton() {
  return (
    <View style={styles.couponCard}>
      <View style={styles.couponHeader}>
        <Skeleton width={90} height={26} radius={8} />
        <Skeleton width={70} height={26} />
      </View>
      <Skeleton width="80%" height={13} style={{ marginBottom: 6 }} />
      <Skeleton width="60%" height={13} style={{ marginBottom: 14 }} />
      <Skeleton height={40} radius={8} />
    </View>
  );
}

export default function OffersScreen() {
  const { data, isLoading, isRefetching, error: queryError, refetch } = useQuery({
    queryKey: queryKeys.profile.coupons(),
    queryFn: () => get<{ coupons: Coupon[] }>("/api/coupons"),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.coupons ?? [],
  });

  const coupons = data ?? [];
  const loading = isLoading;
  const refreshing = isRefetching;
  const error = queryError instanceof Error ? queryError.message : (queryError ? String(queryError) : null);

  const [copying, setCopying] = useState(false);

  const fetchCoupons = (_isRefresh?: boolean) => {
    refetch();
  };

  const handleCopy = async (code: string) => {
    if (copying) return;
    setCopying(true);
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      // ignore
    } finally {
      setCopying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Offers & Coupons", headerShown: true }} />

      {loading && !refreshing ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <CouponCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchCoupons()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(item) => item._id}
          initialNumToRender={6}
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            React.createElement(RefreshControl as any, {
              refreshing: refreshing,
              onRefresh: () => fetchCoupons(true),
              colors: [colors.orange],
            })
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="No coupons yet"
              message="Check back later for exciting offers."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.couponCard}>
              <View style={styles.couponHeader}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>
                {item.expiryDate ? (
                  <Text style={styles.expiryText}>
                    Valid till:{"\n"}
                    {new Date(item.expiryDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.description}>
                {item.description ||
                  (item.type === "flat"
                    ? `Flat ₹${item.value} off on your order.`
                    : `Get ${item.value}% off on your order.`)}
              </Text>

              <Pressable
                onPress={() => handleCopy(item.code)}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>Copy Code</Text>
              </Pressable>
            </View>
          )}
        />
      )}

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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  couponCard: {
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
  couponHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  codeBadge: {
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 121, 34, 0.25)",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  codeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.orange,
  },
  expiryText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#a99c94",
    textAlign: "right",
  },
  description: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#756860",
    lineHeight: 18,
    marginBottom: 14,
  },
  copyBtn: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  copyBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.orange,
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
});
