import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Address, Order, Coupon } from "@/types";
import { useApp } from "@/providers/AppProvider";
import { queryKeys } from "../lib/queryClient";

type ProfileDataTab = "overview" | "rewards" | "address" | "orders" | "payment" | "coupons" | "help" | "settings";

export function useProfile(activeTab: ProfileDataTab) {
  const { user } = useApp();

  // Load addresses
  const addressesQuery = useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: () => get<{ addresses: Address[] }>("/api/address"),
    enabled: !!user && activeTab === "address",
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data) => data.addresses ?? [],
  });

  // Load orders
  const ordersQuery = useQuery({
    queryKey: queryKeys.profile.orders(),
    queryFn: () => get<{ orders: Order[] }>("/api/orders"),
    enabled: !!user && activeTab === "orders",
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => data.orders ?? [],
  });

  // Load coupons
  const couponsQuery = useQuery({
    queryKey: queryKeys.profile.coupons(),
    queryFn: () => get<{ coupons: Coupon[] }>("/api/coupons"),
    enabled: !!user && activeTab === "coupons",
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.coupons ?? [],
  });

  const addresses = addressesQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const coupons = couponsQuery.data ?? [];

  const loading =
    (activeTab === "address" && addressesQuery.isLoading) ||
    (activeTab === "orders" && ordersQuery.isLoading) ||
    (activeTab === "coupons" && couponsQuery.isLoading);

  const refreshing =
    (activeTab === "address" && addressesQuery.isRefetching) ||
    (activeTab === "orders" && ordersQuery.isRefetching) ||
    (activeTab === "coupons" && couponsQuery.isRefetching);

  const error =
    (activeTab === "address" && addressesQuery.error instanceof Error ? addressesQuery.error.message : null) ||
    (activeTab === "orders" && ordersQuery.error instanceof Error ? ordersQuery.error.message : null) ||
    (activeTab === "coupons" && couponsQuery.error instanceof Error ? couponsQuery.error.message : null);

  // Depending on the complete query result objects makes this callback change
  // after every query state update. ProfileScreen uses it in useFocusEffect, so
  // that previously caused a refetch loop while the screen stayed focused.
  const refetchAddresses = addressesQuery.refetch;
  const refetchOrders = ordersQuery.refetch;
  const refetchCoupons = couponsQuery.refetch;

  const refreshData = useCallback(async () => {
    if (activeTab === "address") await refetchAddresses();
    else if (activeTab === "orders") await refetchOrders();
    else if (activeTab === "coupons") await refetchCoupons();
  }, [activeTab, refetchAddresses, refetchOrders, refetchCoupons]);

  return {
    user,
    addresses,
    orders,
    coupons,
    loading,
    refreshing,
    error,
    refreshData,
    reload: refreshData,
  };
}
