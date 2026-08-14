import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import { get, post, ApiRequestError } from "@/lib/api";
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



  const syncedCartRef = useRef<CartItem[]>([]);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const hasPendingChangesRef = useRef(false);
  const cartRef = useRef<CartItem[]>([]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const syncCart = useCallback(async () => {
    if (!user) return;
    const data = await get<{ items: CartItem[] }>("/api/cart");
    const items = data.items ?? [];
    setCart(items);
    syncedCartRef.current = items;
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await get<{ user: User }>("/api/user/me");
      setUserState(data.user);
    } catch (error) {
      // Only a real 401 means "not logged in" — a network blip, timeout, or
      // 5xx is a transient failure, not a logout, so the last-known user
      // state is left alone rather than silently signing them out.
      const isUnauthorized = error instanceof ApiRequestError && error.status === 401;
      if (isUnauthorized) {
        setUserState(null);
      } else if (__DEV__) {
        console.warn("[AppProvider] refreshUser failed (keeping current session):", error);
      }
    }
  }, []);

  useEffect(() => {
    const start = Date.now();
    
    // Fetch user session in the background without blocking the initial App mount
    refreshUser().finally(() => {
      if (__DEV__) {
        console.info(`[Startup] Background session restore finished in ${(Date.now() - start).toFixed(2)}ms`);
      }
    });

    // Only block initial mount on restoring the local guest cart from AsyncStorage (which is local and fast)
    AsyncStorage.getItem(GUEST_CART).then((raw) => {
      if (raw) {
        try {
          setCart(JSON.parse(raw));
        } catch (error) {
          if (__DEV__) {
            console.error("Failed to parse guest cart from AsyncStorage:", error);
          }
          AsyncStorage.removeItem(GUEST_CART).catch(() => undefined);
          setCart([]);
        }
      }
      if (__DEV__) {
        console.info(`[Startup] Guest cart restored in ${(Date.now() - start).toFixed(2)}ms`);
      }
    }).finally(() => {
      setReady(true);
      if (__DEV__) {
        console.info(`[Startup] AppProvider initialized (ready) in ${(Date.now() - start).toFixed(2)}ms`);
      }
    });
  }, [refreshUser]);

  useEffect(() => {
    if (user) syncCart().catch(() => undefined);
  }, [user, syncCart]);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    // Clear user-specific cache on login/logout to prevent private data leakage
    queryClient.clear();

    if (!next) {
      AsyncStorage.getItem(GUEST_CART).then((raw) => {
        if (raw) {
          try {
            const items = JSON.parse(raw);
            setCart(items);
            syncedCartRef.current = items;
          } catch (error) {
            if (__DEV__) {
              console.error("Failed to parse guest cart from AsyncStorage on logout:", error);
            }
            AsyncStorage.removeItem(GUEST_CART).catch(() => undefined);
            setCart([]);
            syncedCartRef.current = [];
          }
        } else {
          setCart([]);
        }
      });
    }
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(async () => {
      syncTimeoutRef.current = null;
      if (isSyncingRef.current) {
        hasPendingChangesRef.current = true;
        return;
      }
      await runSync();
    }, 500);
  }, []);

  const runSync = async () => {
    if (!user) return;
    isSyncingRef.current = true;
    hasPendingChangesRef.current = false;

    const targetCart = [...cartRef.current];
    const syncedCart = syncedCartRef.current;

    try {
      // Find diffs
      const toDelete = syncedCart.filter(
        (s) => !targetCart.some((t) => t.menuItemId === s.menuItemId && t.custom === s.custom)
      );
      const toAdd = targetCart.filter(
        (t) => !syncedCart.some((s) => s.menuItemId === t.menuItemId && s.custom === t.custom)
      );
      const toUpdate = targetCart.filter((t) => {
        const s = syncedCart.find((x) => x.menuItemId === t.menuItemId && x.custom === t.custom);
        return s && s.qty !== t.qty;
      });

      if (toDelete.length === 0 && toAdd.length === 0 && toUpdate.length === 0) {
        isSyncingRef.current = false;
        return;
      }

      let finalCartItems = [...syncedCart];

      for (const item of toDelete) {
        const { del } = await import("@/lib/api");
        const data = await del<{ items: CartItem[] }>("/api/cart/item", {
          menuItemId: item.menuItemId,
          custom: item.custom,
        });
        finalCartItems = data.items || [];
      }

      for (const item of toAdd) {
        const data = await post<{ items: CartItem[] }>("/api/cart/item", {
          menuItemId: item.menuItemId,
          custom: item.custom,
          price: item.price,
          qty: item.qty,
        });
        finalCartItems = data.items || [];
      }

      for (const item of toUpdate) {
        const { patch } = await import("@/lib/api");
        const data = await patch<{ items: CartItem[] }>("/api/cart/item", {
          menuItemId: item.menuItemId,
          custom: item.custom,
          qty: item.qty,
        });
        finalCartItems = data.items || [];
      }

      syncedCartRef.current = finalCartItems;

      const currentLocalCart = cartRef.current;
      const isAligned = currentLocalCart.length === finalCartItems.length &&
        currentLocalCart.every((item) => {
          const matched = finalCartItems.find((f) => f.menuItemId === item.menuItemId && f.custom === item.custom);
          return matched && matched.qty === item.qty;
        });

      if (!isAligned) {
        hasPendingChangesRef.current = true;
      }
    } catch (error) {
      if (__DEV__) {
        console.error("Cart sync failed:", error);
      }
      setCart(syncedCartRef.current);
      const { Alert } = await import("react-native");
      Alert.alert("Connection Error", "Failed to update your cart. Please try again.");
    } finally {
      isSyncingRef.current = false;
      if (hasPendingChangesRef.current) {
        hasPendingChangesRef.current = false;
        await runSync();
      }
    }
  };

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
      setCart((prevCart) => {
        const index = prevCart.findIndex((entry) => entry.menuItemId === item._id && entry.custom === cartItem.custom);
        const next = [...prevCart];
        if (index >= 0) next[index] = { ...next[index], qty: next[index].qty + 1 };
        else next.push(cartItem);
        return next;
      });
      scheduleSync();
      return;
    }
    setCart((prevCart) => {
      const index = prevCart.findIndex((entry) => entry.menuItemId === item._id && entry.custom === cartItem.custom);
      const next = [...prevCart];
      if (index >= 0) next[index] = { ...next[index], qty: next[index].qty + 1 };
      else next.push(cartItem);
      AsyncStorage.setItem(GUEST_CART, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [user, scheduleSync]);

  const setQuantity = useCallback(async (item: CartItem, qty: number) => {
    if (user) {
      setCart((prevCart) => {
        const next = prevCart.flatMap((entry) =>
          entry.menuItemId === item.menuItemId && entry.custom === item.custom
            ? qty > 0 ? [{ ...entry, qty }] : []
            : [entry],
        );
        return next;
      });
      scheduleSync();
      return;
    }
    setCart((prevCart) => {
      const next = prevCart.flatMap((entry) =>
        entry.menuItemId === item.menuItemId && entry.custom === item.custom
          ? qty > 0 ? [{ ...entry, qty }] : []
          : [entry],
      );
      AsyncStorage.setItem(GUEST_CART, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [user, scheduleSync]);

  const clearCart = useCallback(async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setCart([]);
    syncedCartRef.current = [];
    if (user) {
      const { del } = await import("@/lib/api");
      await del("/api/cart").catch(() => undefined);
    } else {
      await AsyncStorage.removeItem(GUEST_CART).catch(() => undefined);
    }
  }, [user]);

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
