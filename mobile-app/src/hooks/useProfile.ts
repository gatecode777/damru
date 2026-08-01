import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { get } from "@/lib/api";
import type { Address, Order, Coupon, PaymentMethod } from "@/types";
import { useApp } from "@/providers/AppProvider";

const CARDS_STORAGE_KEY = "damru.mobile.payment-methods.v1";
const DEFAULT_CARDS: PaymentMethod[] = [
  { id: "1", brand: "visa", last4: "8475", isDefault: true },
];

export function useProfile() {
  const { user, refreshUser } = useApp();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const activeRequests = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CARDS_STORAGE_KEY);
      if (raw && isMounted.current) {
        setPaymentMethods(JSON.parse(raw));
      } else if (isMounted.current) {
        setPaymentMethods(DEFAULT_CARDS);
        await AsyncStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(DEFAULT_CARDS));
      }
    } catch {
      if (isMounted.current) setPaymentMethods(DEFAULT_CARDS);
    }
  }, []);

  const savePaymentMethods = useCallback(async (cards: PaymentMethod[]) => {
    try {
      await AsyncStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
      if (isMounted.current) setPaymentMethods(cards);
    } catch (err) {
      console.error("Failed to save cards:", err);
    }
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    
    // Prevent duplicate parallel loads
    if (activeRequests.current > 0) return;
    
    const hasData = addresses.length > 0 || orders.length > 0 || coupons.length > 0 || paymentMethods.length > 0;

    if (isRefresh) {
      setRefreshing(true);
    } else if (!hasData) {
      setLoading(true);
    }
    setError(null);
    activeRequests.current += 1;

    try {
      // Perform all requests concurrently (including user profile refresh)
      const [addrRes, orderRes, couponRes] = await Promise.all([
        get<{ addresses: Address[] }>("/api/address"),
        get<{ orders: Order[] }>("/api/orders"),
        get<{ coupons: Coupon[] }>("/api/coupons"),
        loadPaymentMethods(),
        refreshUser()
      ]);

      if (isMounted.current) {
        setAddresses(addrRes.addresses || []);
        setOrders(orderRes.orders || []);
        setCoupons(couponRes.coupons || []);
      }
    } catch (err: any) {
      console.error("Failed to load profile data:", err);
      if (isMounted.current && !hasData) {
        setError(err?.message || "Failed to load profile data. Please try again.");
      }
    } finally {
      activeRequests.current -= 1;
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user, refreshUser, loadPaymentMethods, addresses.length, orders.length, coupons.length, paymentMethods.length]);

  useEffect(() => {
    loadData();
  }, [user]);

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
    refreshData: () => loadData(true),
    addPaymentMethod,
    deletePaymentMethod,
    reload: () => loadData(false)
  };
}
