import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import type { CartItem, MenuItem, User } from "@/types";

type AppContextValue = {
  user: User | null;
  cart: CartItem[];
  ready: boolean;
  totalItems: number;
  subtotal: number;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  addItem: (item: MenuItem) => Promise<void>;
  setQuantity: (item: CartItem, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  syncCart: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const GUEST_CART = "damru.mobile.guest-cart.v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  const saveGuest = useCallback(async (items: CartItem[]) => {
    setCart(items);
    await AsyncStorage.setItem(GUEST_CART, JSON.stringify(items));
  }, []);

  const syncCart = useCallback(async () => {
    if (!user) return;
    const data = await get<{ items: CartItem[] }>("/api/cart");
    setCart(data.items ?? []);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await get<{ user: User }>("/api/user/me");
      setUserState(data.user);
    } catch {
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      refreshUser(),
      AsyncStorage.getItem(GUEST_CART).then((raw) => {
        if (raw) setCart(JSON.parse(raw));
      }),
    ]).finally(() => setReady(true));
  }, [refreshUser]);

  useEffect(() => {
    if (user) syncCart().catch(() => undefined);
  }, [user, syncCart]);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    if (!next) {
      AsyncStorage.getItem(GUEST_CART).then((raw) => setCart(raw ? JSON.parse(raw) : []));
    }
  }, []);

  const addItem = useCallback(async (item: MenuItem) => {
    const cartItem: CartItem = {
      menuItemId: item._id,
      name: item.name,
      image: item.image,
      custom: item.custom ?? "",
      price: item.price,
      qty: 1,
    };
    if (user) {
      const data = await post<{ items: CartItem[] }>("/api/cart/item", {
        menuItemId: item._id,
        custom: item.custom ?? "",
        price: item.price,
        qty: 1,
      });
      setCart(data.items);
      return;
    }
    const index = cart.findIndex((entry) => entry.menuItemId === item._id && entry.custom === cartItem.custom);
    const next = [...cart];
    if (index >= 0) next[index] = { ...next[index], qty: next[index].qty + 1 };
    else next.push(cartItem);
    await saveGuest(next);
  }, [cart, saveGuest, user]);

  const setQuantity = useCallback(async (item: CartItem, qty: number) => {
    if (user) {
      if (qty <= 0) {
        const { del } = await import("@/lib/api");
        const data = await del<{ items: CartItem[] }>("/api/cart/item", { menuItemId: item.menuItemId, custom: item.custom });
        setCart(data.items);
      } else {
        const { patch } = await import("@/lib/api");
        const data = await patch<{ items: CartItem[] }>("/api/cart/item", { menuItemId: item.menuItemId, custom: item.custom, qty });
        setCart(data.items);
      }
      return;
    }
    await saveGuest(cart.flatMap((entry) =>
      entry.menuItemId === item.menuItemId && entry.custom === item.custom
        ? qty > 0 ? [{ ...entry, qty }] : []
        : [entry],
    ));
  }, [cart, saveGuest, user]);

  const clearCart = useCallback(async () => {
    if (user) {
      const { del } = await import("@/lib/api");
      await del("/api/cart");
      setCart([]);
    } else {
      await saveGuest([]);
    }
  }, [saveGuest, user]);

  const value = useMemo(() => ({
    user, cart, ready, refreshUser, setUser, addItem, setQuantity, clearCart, syncCart,
    totalItems: cart.reduce((sum, item) => sum + item.qty, 0),
    subtotal: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
  }), [user, cart, ready, refreshUser, setUser, addItem, setQuantity, clearCart, syncCart]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
