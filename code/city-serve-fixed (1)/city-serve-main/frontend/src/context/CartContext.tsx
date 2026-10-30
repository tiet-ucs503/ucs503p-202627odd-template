"use client";

// Simple client-side cart for products. Cart contents live in this browser
// only (persisted to localStorage) since products are the only things that
// go through a cart — services are booked directly from the service page.
// At checkout, each cart line becomes its own Order via POST /orders.

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import type { CartItem, Offering } from "@/types";

const STORAGE_KEY = "cs_cart";

interface CartContextValue {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  loading: boolean;
  addItem: (offering: Offering, quantity?: number) => Promise<void>;
  updateItem: (offeringId: string, quantity: number) => Promise<void>;
  removeItem: (offeringId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load persisted cart once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt cart data
    } finally {
      setLoading(false);
    }
  }, []);

  // Customers only — clear the cart if a vendor/admin ends up here, or on logout.
  useEffect(() => {
    if (user && user.role !== "CUSTOMER") setItems([]);
  }, [user]);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — cart still works for this session
    }
  }, []);

  async function addItem(offering: Offering, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.offeringId === offering.id);
      const next = existing
        ? prev.map((i) => (i.offeringId === offering.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...prev, { offeringId: offering.id, quantity, offering }];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function updateItem(offeringId: string, quantity: number) {
    setItems((prev) => {
      const next = prev.map((i) => (i.offeringId === offeringId ? { ...i, quantity: Math.max(1, quantity) } : i));
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function removeItem(offeringId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.offeringId !== offeringId);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function clearCart() {
    persist([]);
  }

  const subtotal = items.reduce((sum, i) => sum + Number(i.offering.price ?? 0) * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, subtotal, itemCount, loading, addItem, updateItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
