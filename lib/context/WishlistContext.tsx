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

const STORAGE_KEY = "oscar-dt-wishlist";

export type WishlistItem = {
  id: number;
  name: string;
  name_en?: string | null;
  price: string | null;
  image: string | null;
};

type WishlistContextValue = {
  items: WishlistItem[];
  hydrated: boolean;
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: number) => void;
  toggleWishlist: (item: WishlistItem) => void;
  isInWishlist: (productId: number) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function loadStoredItems(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is WishlistItem =>
          row != null &&
          typeof row === "object" &&
          typeof (row as WishlistItem).id === "number" &&
          typeof (row as WishlistItem).name === "string",
      )
      .map((row) => {
        const rec = row as WishlistItem & { name_en?: unknown };
        const name_enRaw = rec.name_en;
        const name_en =
          typeof name_enRaw === "string" || name_enRaw === null ? name_enRaw : undefined;
        return {
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

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
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

  const addToWishlist = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeFromWishlist = useCallback((productId: number) => {
    setItems((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const toggleWishlist = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) {
        return prev.filter((p) => p.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  const isInWishlist = useCallback(
    (productId: number) => items.some((p) => p.id === productId),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      hydrated,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      isInWishlist,
    }),
    [items, hydrated, addToWishlist, removeFromWishlist, toggleWishlist, isInWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return ctx;
}
