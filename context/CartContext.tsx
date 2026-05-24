"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "oscar-dt-cart";

export type CartItem = {
  id: number;
  name: string;
  /** English display name when the catalog row has `name_en`. */
  name_en?: string | null;
  price: string | null;
  image: string | null;
};

export type CartLine = CartItem & { lineId: string };

type CartContextValue = {
  items: CartLine[];
  hydrated: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadStoredItems(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is CartLine =>
          row != null &&
          typeof row === "object" &&
          typeof (row as CartLine).lineId === "string" &&
          typeof (row as CartLine).id === "number" &&
          typeof (row as CartLine).name === "string",
      )
      .map((row) => {
        const rec = row as CartLine & { name_en?: unknown };
        const name_enRaw = rec.name_en;
        const name_en =
          typeof name_enRaw === "string" || name_enRaw === null ? name_enRaw : undefined;
        return {
          lineId: rec.lineId,
          id: rec.id,
          name: rec.name,
          name_en,
          price: typeof rec.price === "string" || rec.price === null ? rec.price : null,
          image: typeof rec.image === "string" || rec.image === null ? rec.image : null,
        };
      });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadStoredItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota / private mode */
    }
  }, [items, hydrated]);

  const addToCart = useCallback((item: CartItem) => {
    const lineId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [...prev, { ...item, lineId }]);
  }, []);

  const removeFromCart = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((line) => line.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      hydrated,
      addToCart,
      removeFromCart,
      clearCart,
    }),
    [items, hydrated, addToCart, removeFromCart, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
