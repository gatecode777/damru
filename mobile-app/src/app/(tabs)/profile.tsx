import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  FlatList,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Ionicons } from "@expo/vector-icons";

import { useApp } from "@/providers/AppProvider";
import { useProfile } from "@/hooks/useProfile";
import { colors } from "@/config";
import { del, post } from "@/lib/api";

import { Button, EmptyState, ScreenTitle } from "@/components/ui";
import { HomeHeader } from "@/components/home/HomeHeader";
import { ProfileNavigationTabs, ProfileTab } from "@/components/profile/ProfileNavigationTabs";
import { UserProfileCard } from "@/components/profile/UserProfileCard";
import { AddressBookCard } from "@/components/profile/AddressBookCard";
import { OrdersCard } from "@/components/profile/OrdersCard";
import { PaymentMethodCard } from "@/components/profile/PaymentMethodCard";
import { CouponCard } from "@/components/profile/CouponCard";
import { LoadingSkeleton } from "@/components/profile/LoadingSkeleton";
import { HelpSupportSection } from "@/components/profile/HelpSupportSection";

export default function ProfileScreen() {
  const { user, setUser, ready } = useApp();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [toast, setToast] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const {
    addresses,
    orders,
    coupons,
    paymentMethods,
    loading,
    refreshing,
    error,
    refreshData,
    deletePaymentMethod,
    reload,
  } = useProfile();

  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refreshData();
    } finally {
      setManualRefreshing(false);
    }
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        reload();
      }
    }, [user])
  );

  const handleDeleteAddress = (addressId: string) => {
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
              await del("/api/address", { id: addressId });
              reload();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to delete address.");
            }
          },
        },
      ]
    );
  };

  const handleCopyCoupon = async (code: string) => {
    if (copying) return;
    setCopying(true);
    try {
      await Clipboard.setStringAsync(code);
      setToast(`Code "${code}" copied!`);
      setTimeout(() => setToast(null), 1000);
    } catch {
      setToast("Could not copy. Please try manually.");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setCopying(false);
    }
  };

  if (!ready) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeHeader />

      {!user ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ScreenTitle
            eyebrow="Your Damru"
            title="Sign in to continue"
            subtitle="Track orders, save addresses, reserve tables and manage your profile."
          />
          <View style={styles.loginCard}>
            <Text style={styles.loginIcon}>👋</Text>
            <Text style={styles.loginTitle}>Welcome back</Text>
            <Text style={styles.loginCopy}>Your favourites and order history are waiting.</Text>
            <Button label="Sign in or create account" onPress={() => router.push("/auth")} />
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <ProfileNavigationTabs activeTab={activeTab} onTabPress={setActiveTab} />

          {loading && !refreshing ? (
            <LoadingSkeleton />
          ) : error ? (
            <View style={styles.centerError}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={reload}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {activeTab === "overview" && (
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                >
                  <UserProfileCard user={user} />
                  <AddressBookCard addresses={addresses} />
                  <OrdersCard orders={orders} />
                  <PaymentMethodCard paymentMethods={paymentMethods} />
                  <CouponCard coupons={coupons} />

                  <View style={styles.logoutWrapper}>
                    <Pressable
                      style={styles.logoutBtn}
                      onPress={async () => {
                        await post("/api/user/logout");
                        setUser(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Log Out"
                    >
                      <MaterialIcons name="logout" size={18} color={colors.danger} style={{ marginRight: 6 }} />
                      <Text style={styles.logoutBtnText}>Log Out</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              )}

              {activeTab === "address" && (
                <FlatList
                  data={addresses}
                  keyExtractor={(item) => item._id || ""}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                  ListHeaderComponent={
                    <Text style={styles.sectionTitle}>Address Book</Text>
                  }
                  ListEmptyComponent={
                    <EmptyState title="No addresses saved" message="Add a delivery address to get started." />
                  }
                  ListFooterComponent={
                    <View style={{ marginTop: 12 }}>
                      <Button label="+ Add New Address" onPress={() => router.push("/add-address")} />
                    </View>
                  }
                  renderItem={({ item: a }) => (
                    <View style={styles.listItemCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.labelRow}>
                          <Ionicons
                            name={
                              a.label === "Home"
                                ? "home-outline"
                                : a.label === "Office"
                                ? "business-outline"
                                : "location-outline"
                            }
                            size={16}
                            color={colors.orange}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.cardLabel}>{a.label}</Text>
                          {a.isDefault ? (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: "/add-address", params: { id: a._id } })}
                          >
                            <Ionicons name="pencil-outline" size={16} color="#756860" />
                          </Pressable>
                          <Pressable style={styles.actionBtn} onPress={() => handleDeleteAddress(a._id!)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.cardText}>{a.fullName} - {a.phone}</Text>
                      <Text style={styles.cardSubtext}>
                        {a.house}
                        {a.area ? `, ${a.area}` : ""}
                        {"\n"}
                        {a.city}, {a.state} {a.pincode}
                      </Text>
                    </View>
                  )}
                />
              )}

              {activeTab === "orders" && (
                <FlatList
                  data={orders}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                  ListHeaderComponent={
                    <Text style={styles.sectionTitle}>My Orders</Text>
                  }
                  ListEmptyComponent={
                    <EmptyState title="No orders yet" message="Your delicious history will appear here." />
                  }
                  renderItem={({ item: o }) => (
                    <View style={styles.listItemCard}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardLabel}>
                          #{o.orderNumber || o._id.slice(-6).toUpperCase()}
                        </Text>
                        <Text style={styles.statusText}>{o.status.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.cardText}>
                        {o.items?.map((i) => `${i.qty}× ${i.name}`).join(", ") || "Meal"}
                      </Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardDate}>
                          {new Date(o.createdAt).toLocaleDateString()}
                        </Text>
                        <Text style={styles.cardTotal}>₹{o.total}</Text>
                      </View>
                    </View>
                  )}
                />
              )}

              {activeTab === "payment" && (
                <FlatList
                  data={paymentMethods}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                  ListHeaderComponent={
                    <Text style={styles.sectionTitle}>Payment Methods</Text>
                  }
                  ListEmptyComponent={
                    <EmptyState title="No payment methods saved" message="Save a credit or debit card." />
                  }
                  ListFooterComponent={
                    <View style={{ marginTop: 12 }}>
                      <Button label="+ Add New Card" onPress={() => router.push("/payment-methods")} />
                    </View>
                  }
                  renderItem={({ item: c }) => (
                    <View style={[styles.listItemCard, { backgroundColor: "#20272c" }]}>
                      <View style={styles.cardHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View style={styles.chipPlaceholder} />
                          <Text style={[styles.cardLabel, { color: "#ffffff", letterSpacing: 1.5 }]}>
                            •••• {c.last4}
                          </Text>
                        </View>
                        <Pressable style={styles.actionBtn} onPress={() => deletePaymentMethod(c.id)}>
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                      <Text style={{ color: "#a99c94", fontSize: 11, fontFamily: "Poppins_500Medium" }}>
                        {c.brand.toUpperCase()}
                      </Text>
                    </View>
                  )}
                />
              )}

              {activeTab === "coupons" && (
                <FlatList
                  data={coupons}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                  ListHeaderComponent={
                    <Text style={styles.sectionTitle}>Offers & Coupons</Text>
                  }
                  ListEmptyComponent={
                    <EmptyState title="No coupons yet" message="Check back later for exciting offers." />
                  }
                  renderItem={({ item: c }) => (
                    <View style={styles.listItemCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeText}>{c.code}</Text>
                        </View>
                        <Pressable onPress={() => handleCopyCoupon(c.code)} style={styles.copyLink}>
                          <Text style={styles.copyLinkText}>Copy</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.cardSubtext}>{c.description || `${c.value}% OFF`}</Text>
                    </View>
                  )}
                />
              )}

              {activeTab === "help" && (
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  refreshControl={
                    React.createElement(RefreshControl as any, {
                      refreshing: manualRefreshing,
                      onRefresh: handleRefresh,
                      colors: [colors.orange],
                    })
                  }
                >
                  <HelpSupportSection showToast={setToast} />
                </ScrollView>
              )}
            </>
          )}
        </View>
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
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 150, // Account for global bottom bar floating and short content scrolling
  },
  loginCard: {
    margin: 20,
    padding: 28,
    gap: 11,
    borderRadius: 24,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
  },
  loginIcon: {
    fontSize: 42,
  },
  loginTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: colors.ink,
    fontFamily: "Poppins_700Bold",
  },
  loginCopy: {
    color: colors.muted,
    lineHeight: 21,
    marginBottom: 10,
    fontFamily: "Poppins_400Regular",
  },
  logoutWrapper: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoutBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.danger,
  },
  inlineSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: colors.ink,
    marginBottom: 6,
  },
  listItemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee3da",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.ink,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  actionBtn: {
    padding: 2,
  },
  cardText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#756860",
    marginBottom: 4,
  },
  cardSubtext: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#a99c94",
    lineHeight: 16,
  },
  statusText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: colors.orangeDark,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3ece6",
    paddingTop: 8,
    marginTop: 8,
  },
  cardDate: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#a99c94",
  },
  cardTotal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: colors.ink,
  },
  chipPlaceholder: {
    width: 28,
    height: 18,
    borderRadius: 3,
    backgroundColor: "#3a4650",
    marginRight: 10,
  },
  codeBadge: {
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 121, 34, 0.25)",
    borderStyle: "dashed",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  copyLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  copyLinkText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: colors.orange,
  },
  toast: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "#111111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    zIndex: 999,
  },
  toastText: {
    color: "#ffffff",
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  defaultBadge: {
    marginLeft: 6,
    backgroundColor: "rgba(229, 121, 34, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(229, 121, 34, 0.2)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 0.5,
  },
  defaultBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 9,
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
  retryBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#ffffff",
  },
});
