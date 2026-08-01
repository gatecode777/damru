import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { Address, Order, Coupon, PaymentMethod } from "@/types";
import { useApp } from "@/providers/AppProvider";
import { queryKeys } from "../lib/queryClient";

const CARDS_STORAGE_KEY = "damru.mobile.payment-methods.v1";
const DEFAULT_CARDS: PaymentMethod[] = [
  { id: "1", brand: "visa", last4: "8475", isDefault: true },
];

export function useProfile() {
  const { user, refreshUser } = useApp();
  const queryClient = useQueryClient();

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

  // Load payment methods
  const paymentMethodsQuery = useQuery({
    queryKey: queryKeys.profile.paymentMethods(),
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(CARDS_STORAGE_KEY);
        if (raw) return JSON.parse(raw) as PaymentMethod[];
        await AsyncStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(DEFAULT_CARDS));
        return DEFAULT_CARDS;
      } catch {
        return DEFAULT_CARDS;
      }
    },
    staleTime: 30 * 1000,
  });

  const addresses = addressesQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const coupons = couponsQuery.data ?? [];
  const paymentMethods = paymentMethodsQuery.data ?? [];

  const loading =
    addressesQuery.isLoading ||
    ordersQuery.isLoading ||
    couponsQuery.isLoading ||
    paymentMethodsQuery.isLoading;

  const refreshing =
    addressesQuery.isRefetching ||
    ordersQuery.isRefetching ||
    couponsQuery.isRefetching ||
    paymentMethodsQuery.isRefetching;

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
      paymentMethodsQuery.refetch(),
      refreshUser(),
    ]);
  }, [addressesQuery, ordersQuery, couponsQuery, paymentMethodsQuery, refreshUser]);

  const savePaymentMethods = useCallback(async (cards: PaymentMethod[]) => {
    try {
      await AsyncStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
      queryClient.setQueryData(queryKeys.profile.paymentMethods(), cards);
    } catch (err) {
      console.error("Failed to save cards:", err);
    }
  }, [queryClient]);

  const addPaymentMethod = useCallback(async (brand: string, last4: string) => {
    const newCard: PaymentMethod = {
      id: Date.now().toString(),
      brand: brand.toLowerCase(),
      last4,
      isDefault: paymentMethods.length === 0,
    };
    const updated = [...paymentMethods, newCard];
    await savePaymentMethods(updated);
  }, [paymentMethods, savePaymentMethods]);

  const deletePaymentMethod = useCallback(async (cardId: string) => {
    const updated = paymentMethods.filter(c => c.id !== cardId);
    if (updated.length > 0 && !updated.some(c => c.isDefault)) {
      updated[0].isDefault = true;
    }
    await savePaymentMethods(updated);
  }, [paymentMethods, savePaymentMethods]);

  return {
    user,
    addresses,
    orders,
    coupons,
    paymentMethods,
    loading,
    refreshing,
    error,
    refreshData,
    addPaymentMethod,
    deletePaymentMethod,
    reload: refreshData,
  };
}
