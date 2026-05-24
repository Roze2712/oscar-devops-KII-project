"use client";

import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { useLanguage } from "@/context/LanguageContext";
import { useWishlist } from "@/lib/context/WishlistContext";

export default function WishlistPage() {
  const { items, hydrated } = useWishlist();
  const { t } = useLanguage();

  if (!hydrated) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">{t("wishlistPage.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("wishlistPage.title")}
        </h1>

        {items.length === 0 ? (
          <div className="mt-12 rounded-lg border border-border bg-card p-10 text-center shadow-sm">
            <p className="text-muted-foreground">{t("wishlistPage.empty")}</p>
            <Link
              href="/market"
              className="mt-6 inline-flex border border-transparent bg-black px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-black/90"
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  id: item.id,
                  name: item.name,
                  name_en: item.name_en,
                  price: item.price,
                  image: item.image,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
