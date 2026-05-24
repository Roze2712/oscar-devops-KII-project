"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderedProducts } from "@/lib/supabase/fetch-products";
import { ProductCard, type ProductCardProduct } from "@/components/product-card";

export function ProductSlider() {
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data, error: fetchError } =
        await fetchOrderedProducts<ProductCardProduct>(supabase, {
          select: "id, name, price, image",
          idAscending: false,
        });
      const limited = (data ?? []).slice(0, 10);

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setProducts(limited);
    };

    void load();
  }, []);

  const scrollBy = (dir: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.75, 320);
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (error) return null;

  return (
    <section
      aria-label="Product slider"
      className="border-t border-border/30 bg-transparent pt-4"
    >
      <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2">
        <button
          type="button"
          onClick={() => scrollBy("left")}
          aria-label="Previous products"
          className="absolute left-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/40 bg-background/20 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-white/80 dark:hover:bg-background/50"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </button>

        <div
          ref={railRef}
          className="flex min-w-0 snap-x snap-mandatory touch-pan-x gap-2 overflow-x-auto scroll-pl-0 scroll-pr-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="w-[calc((100vw-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100vw-1.5rem)/3)] xl:w-[calc((100vw-2.25rem)/4)]"
                >
                  <div className="aspect-[4/5] animate-pulse bg-muted" />
                </div>
              ))
            : products.map((p) => (
                <ProductCard
                  key={`home-related-${p.id}`}
                  product={p}
                  className="w-[calc((100vw-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100vw-1.5rem)/3)] xl:w-[calc((100vw-2.25rem)/4)]"
                  textPaddingClassName="px-3 sm:px-4"
                  showPrice={false}
                  centerText
                />
              ))}
        </div>

        <button
          type="button"
          onClick={() => scrollBy("right")}
          aria-label="Next products"
          className="absolute right-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/40 bg-background/20 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-white/80 dark:hover:bg-background/50"
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}
