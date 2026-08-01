import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Clipboard } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { get } from "@/lib/api";
import { colors } from "@/config";
import type { Coupon } from "@/types";
import { EmptyState } from "@/components/ui";

export default function OffersScreen() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchCoupons = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await get<{ coupons: Coupon[] }>("/api/coupons");
      setCoupons(data.coupons || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load offers. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCoupons();
    }, [fetchCoupons])
  );

  const handleCopy = (code: string) => {
    Clipboard.setString(code);
    setToast(`Code "${code}" copied to clipboard!`);
    setTimeout(() => setToast(null), 1500);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Offers & Coupons", headerShown: true }} />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.orange} />
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

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
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
  toast: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#111111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  toastText: {
    color: "#ffffff",
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
