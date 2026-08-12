import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Address, Order, Coupon } from "@/types";
import { useApp } from "@/providers/AppProvider";
import { queryKeys } from "../lib/queryClient";

export function useProfile() {
  const { user, refreshUser } = useApp();

  // Load addresses
  const addressesQuery = useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: () => get<{ addresses: Address[] }>("/api/address"),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data) => data.addresses ?? [],
  });

  // Load orders
  const ordersQuery = useQuery({
    queryKey: queryKeys.profile.orders(),
    queryFn: () => get<{ orders: Order[] }>("/api/orders"),
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => data.orders ?? [],
  });

  // Load coupons
  const couponsQuery = useQuery({
    queryKey: queryKeys.profile.coupons(),
    queryFn: () => get<{ coupons: Coupon[] }>("/api/coupons"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.coupons ?? [],
  });

  const addresses = addressesQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const coupons = couponsQuery.data ?? [];

  const loading =
    addressesQuery.isLoading ||
    ordersQuery.isLoading ||
    couponsQuery.isLoading;

  const refreshing =
    addressesQuery.isRefetching ||
    ordersQuery.isRefetching ||
    couponsQuery.isRefetching;

  const error =
    (addressesQuery.error instanceof Error ? addressesQuery.error.message : null) ||
    (ordersQuery.error instanceof Error ? ordersQuery.error.message : null) ||
    (couponsQuery.error instanceof Error ? couponsQuery.error.message : null);

  const refreshData = useCallback(async () => {
    // Invalidate everything to force refetch
    await Promise.all([
      addressesQuery.refetch(),
      ordersQuery.refetch(),
      couponsQuery.refetch(),
      refreshUser(),
    ]);
  }, [addressesQuery, ordersQuery, couponsQuery, refreshUser]);

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
