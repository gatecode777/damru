"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  // For DB-backed cart: menuItemId is the MongoDB _id of the MenuItem
  // For guest cart: id is a local key like "name-variant"
  id:          string;   // local key = `${menuItemId}-${custom || "plain"}`
  menuItemId?: string;   // MongoDB MenuItem._id (present when logged in)
  name:        string;
  custom:      string;
  price:       number;
  qty:         number;
  image?:      string;
  variantType: string;
}

interface CartContextType {
  items:       CartItem[];
  isLoggedIn:  boolean;
  loading:     boolean;
  addItem:     (item: Omit<CartItem, "qty">, qty?: number) => Promise<void>;
  removeItem:  (item: CartItem) => Promise<void>;
  updateQty:   (item: CartItem, qty: number) => Promise<void>;
  clearCart:   () => Promise<void>;
  replaceCart: (items: Array<Omit<CartItem, "qty"> & { qty?: number }>) => Promise<void>;
  syncCart:    () => Promise<void>;
  totalItems:  number;
  totalPrice:  number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items,      setItems]      = useState<CartItem[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading,    setLoading]    = useState(true);

  // ── Refresh cart status & login status ──────────────────────
  const refreshCartState = useCallback(async () => {
    try {
      // Check if user is logged in
      const meRes = await fetch("/api/user/me");
      const meData = await meRes.json();
      const loggedIn = !!meData.user;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        // Load cart from DB
        const cartRes = await fetch("/api/cart");
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          // Map DB items to CartItem shape
          const mapped: CartItem[] = (cartData.items || []).map((i: {
            menuItemId: string; name: string; custom: string;
            price: number; qty: number; image?: string; variantType: string;
          }) => ({
            id:          `${i.menuItemId}-${i.custom || "plain"}`,
            menuItemId:  i.menuItemId,
            name:        i.name,
            custom:      i.custom,
            price:       i.price,
            qty:         i.qty,
            image:       i.image,
            variantType: i.variantType,
          }));
          setItems(mapped);
        }
      } else {
        // Guest: load from localStorage
        try {
          const saved = localStorage.getItem("damru_cart");
          if (saved) setItems(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    } catch {
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem("damru_cart");
        if (saved) setItems(JSON.parse(saved));
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCartState();

    window.addEventListener("user-profile-updated", refreshCartState);
    window.addEventListener("auth-state-changed", refreshCartState);

    return () => {
      window.removeEventListener("user-profile-updated", refreshCartState);
      window.removeEventListener("auth-state-changed", refreshCartState);
    };
  }, [refreshCartState]);

  // ── Guest: persist to localStorage ─────────────────────────
  useEffect(() => {
    if (!isLoggedIn && !loading) {
      try { localStorage.setItem("damru_cart", JSON.stringify(items)); }
      catch { /* ignore */ }
    }
  }, [items, isLoggedIn, loading]);

  // ── ADD ITEM ────────────────────────────────────────────────
  const addItem = useCallback(async (newItem: Omit<CartItem, "qty">, qty: number = 1) => {
    if (isLoggedIn && newItem.menuItemId) {
      // DB-backed
      const res = await fetch("/api/cart/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId:  newItem.menuItemId,
          variantType: newItem.variantType,
          custom:      newItem.custom,
          price:       newItem.price,
          qty,
        }),
      });
      if (!res.ok) throw new Error("Unable to add this item to your cart.");

      const data = await res.json();
      const mapped: CartItem[] = (data.items || []).map((i: {
        menuItemId: string; name: string; custom: string;
        price: number; qty: number; image?: string; variantType: string;
      }) => ({
        id: `${i.menuItemId}-${i.custom || "plain"}`,
        menuItemId: i.menuItemId, name: i.name, custom: i.custom,
        price: i.price, qty: i.qty, image: i.image, variantType: i.variantType,
      }));
      setItems(mapped);
    } else {
      // Guest: local state
      setItems(prev => {
        const exists = prev.find(i => i.id === newItem.id);
        if (exists) return prev.map(i => i.id === newItem.id ? { ...i, qty: i.qty + qty } : i);
        return [...prev, { ...newItem, qty }];
      });
    }
  }, [isLoggedIn]);

  // ── REMOVE ITEM ─────────────────────────────────────────────
  const removeItem = useCallback(async (item: CartItem) => {
    if (isLoggedIn && item.menuItemId) {
      const response = await fetch("/api/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: item.menuItemId, custom: item.custom }),
      });
      if (!response.ok) throw new Error("Unable to remove this item from your cart.");
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
  }, [isLoggedIn]);

  // ── UPDATE QTY ──────────────────────────────────────────────
  const updateQty = useCallback(async (item: CartItem, qty: number) => {
    if (isLoggedIn && item.menuItemId) {
      const response = await fetch("/api/cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: item.menuItemId, custom: item.custom, qty }),
      });
      if (!response.ok) throw new Error("Unable to update this cart item.");
    }
    if (qty < 1) {
      setItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty } : i));
    }
  }, [isLoggedIn]);

  // ── CLEAR CART ──────────────────────────────────────────────
  const clearCart = useCallback(async () => {
    if (isLoggedIn) {
      const response = await fetch("/api/cart", { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to clear your cart.");
    } else {
      try { localStorage.removeItem("damru_cart"); } catch { /* ignore */ }
    }
    setItems([]);
  }, [isLoggedIn]);

  const replaceCart = useCallback(async (nextItems: Array<Omit<CartItem, "qty"> & { qty?: number }>) => {
    if (!isLoggedIn) throw new Error("Login required to replace the cart.");
    const response = await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: nextItems.map(item => ({
        menuItemId: item.menuItemId,
        custom: item.custom,
        qty: item.qty ?? 1,
      })) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to prepare your cart.");
    setItems((data.items || []).map((item: CartItem) => ({
      ...item,
      id: `${item.menuItemId}-${item.custom || "plain"}`,
    })));
  }, [isLoggedIn]);

  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, isLoggedIn, loading, addItem, removeItem, updateQty, clearCart, replaceCart, syncCart: refreshCartState, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
