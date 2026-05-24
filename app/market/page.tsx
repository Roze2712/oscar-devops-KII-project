"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collectAvailableColorsForProducts,
  categoryFromSearchParam,
  normalizeColorFilterValue,
  productMatchesColorFilter,
  PRODUCT_CATEGORIES,
  productNameMatchesCategoryFilter,
  translateFilterColorLabel,
  type CategoryFilter,
  type ColorFilter,
} from "./_components/category-filter";
import { createClient } from "@/lib/supabase/client";
import { fetchOrderedProducts } from "@/lib/supabase/fetch-products";
import { ProductCard } from "@/components/product-card";
import { useLanguage } from "@/context/LanguageContext";

type Product = {
  id: number;
  name: string;
  name_en: string | null;
  price: string | number | null;
  image: string | null;
  category: string | null;
  /** Labels from Supabase `targetGroup` (e.g. Cyrillic checkboxes); may be multiple per product. */
  targetGroupEntries: string[];
  colors: unknown;
};

type PriceSortOrder = "price-asc" | "price-desc" | "";
type TargetGroupFilter = "all" | "women" | "men" | "kids";

/** Stable empty deps (same reference every render) for mount-only effects. */
const MOUNT_ONLY_DEPS = Object.freeze([] as const);

/** When `name_en` is missing in Supabase, treat English copy as the primary `name`. */
function productNameEnglishOrPrimary(product: Pick<Product, "name" | "name_en">): string {
  const en = product.name_en?.trim();
  return en || product.name;
}

/** Category filter matches against product titles and optional admin `category` text. */
function productCategoryNameHaystack(product: Product): string {
  const primary = product.name.trim();
  const enOrPrimary = productNameEnglishOrPrimary(product).trim();
  const parts = new Set<string>();
  if (primary) parts.add(primary);
  if (enOrPrimary && enOrPrimary !== primary) parts.add(enOrPrimary);
  const cat = product.category?.trim();
  if (cat) parts.add(cat);
  return [...parts].join(" ");
}

/** Lowercased blob for `?search=` — covers `name` and optional `name_en`. */
function productSearchTextLower(product: Product): string {
  const primary = product.name.trim();
  const en = product.name_en?.trim();
  if (en && en !== primary) return `${primary} ${en}`.toLowerCase();
  return primary.toLowerCase();
}

function parseMarketProductRow(row: unknown): Product | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const idRaw = r.id;
  const id =
    typeof idRaw === "number"
      ? idRaw
      : typeof idRaw === "string"
        ? Number(idRaw)
        : Number.NaN;
  if (!Number.isFinite(id)) return null;

  const nameRaw = r.name;
  const name =
    typeof nameRaw === "string"
      ? nameRaw.trim()
      : nameRaw == null
        ? ""
        : String(nameRaw).trim();

  /** Optional until `name_en` exists in Supabase; omitted from `.select()` until then. */
  const nameEnRaw = "name_en" in r ? r.name_en : undefined;
  const name_en: string | null =
    typeof nameEnRaw === "string"
      ? nameEnRaw.trim() || null
      : nameEnRaw == null || nameEnRaw === undefined
        ? null
        : String(nameEnRaw).trim() || null;

  const resolvedName = name || (name_en ?? "");
  if (!resolvedName) return null;

  const priceRaw = r.price;
  let price: Product["price"] = null;
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
    price = priceRaw;
  } else if (typeof priceRaw === "string" && priceRaw.trim()) {
    price = priceRaw.trim();
  } else if (priceRaw != null && priceRaw !== "") {
    price = String(priceRaw).trim() || null;
  }

  const imageRaw = r.image;
  const image = typeof imageRaw === "string" ? imageRaw : null;

  const colors = r.colors;

  const categoryRaw = "category" in r ? r.category : undefined;
  const category: string | null =
    typeof categoryRaw === "string"
      ? categoryRaw.trim() || null
      : categoryRaw == null || categoryRaw === undefined
        ? null
        : String(categoryRaw).trim() || null;

  return {
    id,
    name: resolvedName,
    name_en,
    price,
    image,
    category,
    targetGroupEntries: parseTargetGroupFromRow(r.targetGroup),
    colors,
  };
}

/** Same shape as admin `normalizeTargetGroupArray` — DB often stores `targetGroup` as a JSON array. */
function parseTargetGroupFromRow(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) =>
        typeof entry === "string"
          ? entry.replace(/\u00a0/g, " ").trim()
          : "",
      )
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.replace(/\u00a0/g, " ").trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) =>
              typeof entry === "string"
                ? entry.replace(/\u00a0/g, " ").trim()
                : "",
            )
            .filter(Boolean);
        }
      } catch {
        // single string
      }
    }
    return [trimmed];
  }
  return [];
}

function normalizeTargetGroupSlug(raw: string | null | undefined): string {
  if (!raw) return "";
  const normalized = raw
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .normalize("NFC");

  if (!normalized) return "";

  if (normalized === "жени" || normalized === "women") return "women";
  if (normalized === "мажи" || normalized === "men") return "men";
  if (normalized === "деца" || normalized === "kids") return "kids";

  return normalized;
}

function getNumericPrice(price: Product["price"]): number {
  if (price === null || price === undefined || price === "") {
    return Number.POSITIVE_INFINITY;
  }

  if (typeof price === "number") {
    return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
  }

  if (typeof price !== "string") {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = price.replace(/,/g, ".");
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number.parseFloat(match[0]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function MarketClient() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { t, language } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceSort, setPriceSort] = useState<PriceSortOrder>("");
  // Prevent query-param derived markup from mismatching on first hydration.
  const [mounted, setMounted] = useState(false);

  const categoryParam = searchParams.get("category");
  const targetGroupParam = searchParams.get("targetGroup");
  const colorParam = searchParams.get("color");
  const searchParam = searchParams.get("search");
  const categoryFilter = useMemo(
    () => (mounted ? categoryFromSearchParam(categoryParam) : "all"),
    [categoryParam, mounted],
  );
  const colorFilter = useMemo<ColorFilter>(() => {
    if (!mounted || !colorParam?.trim()) return "all";
    const normalized = normalizeColorFilterValue(colorParam);
    return normalized || "all";
  }, [colorParam, mounted]);
  const targetGroupFilter = useMemo<TargetGroupFilter>(() => {
    if (!mounted) return "all";
    const normalized = normalizeTargetGroupSlug(targetGroupParam);
    if (["women", "men", "kids"].includes(normalized)) {
      return normalized as TargetGroupFilter;
    }
    return "all";
  }, [mounted, targetGroupParam]);
  const searchTerm = useMemo(
    () => (mounted ? (searchParam ?? "").trim().toLowerCase() : ""),
    [mounted, searchParam],
  );

  useEffect(() => {
    setMounted(true);
  }, MOUNT_ONLY_DEPS);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await fetchOrderedProducts(supabase, {
          select: "id, name, name_en, price, image, targetGroup, colors, category",
          idAscending: true,
        });

        if (error) {
          throw new Error(error.message);
        }

        let safeProducts: Product[] = [];
        try {
          safeProducts = Array.isArray(data)
            ? data
                .map(parseMarketProductRow)
                .filter((p): p is Product => p !== null)
            : [];
        } catch (parseErr) {
          throw parseErr instanceof Error
            ? parseErr
            : new Error(tRef.current("marketPage.loadError"));
        }

        setProducts(safeProducts);
      } catch (e) {
        setProducts([]);
        setError(
          e instanceof Error ? e.message : tRef.current("marketPage.loadError"),
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, MOUNT_ONLY_DEPS);

  const displayedProducts = useMemo(() => {
    const term = searchTerm;

    const selectedCategory = categoryFilter; 
    const selectedTargetGroup = targetGroupFilter;
    const localizedCategoryLabel =
      selectedCategory === "all"
        ? ""
        : t(`categories.${selectedCategory}`);

    const activeFilters =
      selectedCategory !== "all" ||
      selectedTargetGroup !== "all" ||
      term.length > 0 ||
      colorFilter !== "all";

    const debugMarketFilter =
      typeof process !== "undefined" && process.env.NODE_ENV === "development";

    const filtered: Product[] = [];
    const excludedForDebug: Array<{
      id: number;
      name: string;
      failed: ("category" | "targetGroup" | "search" | "color")[];
      targetGroupRaw: string[];
      targetGroupNormalized: string[];
      haystackSample: string;
    }> = [];

    for (const product of products) {
      const nameHaystack = productCategoryNameHaystack(product);

      const matchesCategory = productNameMatchesCategoryFilter(
        nameHaystack,
        selectedCategory,
        localizedCategoryLabel,
      );

      const matchesTargetGroup =
        selectedTargetGroup === "all" ||
        product.targetGroupEntries.some(
          (entry) => normalizeTargetGroupSlug(entry) === selectedTargetGroup,
        );

      const matchesSearch =
        term.length === 0 || productSearchTextLower(product).includes(term);

      const matchesColor = productMatchesColorFilter(product.colors, colorFilter);

      const pass =
        matchesCategory && matchesTargetGroup && matchesSearch && matchesColor;

      if (pass) {
        filtered.push(product);
      } else if (debugMarketFilter && activeFilters) {
        const failed: ("category" | "targetGroup" | "search" | "color")[] = [];
        if (!matchesCategory) failed.push("category");
        if (!matchesTargetGroup) failed.push("targetGroup");
        if (!matchesSearch) failed.push("search");
        if (!matchesColor) failed.push("color");
        excludedForDebug.push({
          id: product.id,
          name: product.name,
          failed,
          targetGroupRaw: [...product.targetGroupEntries],
          targetGroupNormalized: product.targetGroupEntries.map((e) =>
            normalizeTargetGroupSlug(e),
          ),
          haystackSample: nameHaystack.slice(0, 160),
        });
      }
    }

    if (debugMarketFilter && activeFilters && products.length > 0) {
      console.log("[market] MarketClient filter", {
        shown: filtered.length,
        total: products.length,
        excludedCount: excludedForDebug.length,
        filters: {
          category: selectedCategory,
          targetGroup: selectedTargetGroup,
          search: term || null,
          color: colorFilter,
        },
        excluded: excludedForDebug,
      });
    }

    if (selectedCategory !== "all" && filtered.length === 0 && products.length > 0) {
      console.log("[market] категорија недостапна", {
        selectedCategory,
        note: "Нема производи за оваа категорија.",
      });
    }

    if (!priceSort) return filtered;

    return [...filtered].sort((a, b) => {
      const left = getNumericPrice(a.price);
      const right = getNumericPrice(b.price);
      return priceSort === "price-asc" ? left - right : right - left;
    });
  }, [products, categoryFilter, targetGroupFilter, searchTerm, priceSort, colorFilter, t]);

  const categoryScopedProducts = useMemo(() => {
    if (categoryFilter === "all") return [];
    const localizedCategoryLabel = t(`categories.${categoryFilter}`);
    return products.filter((product) => {
      const inCategory = productNameMatchesCategoryFilter(
        productCategoryNameHaystack(product),
        categoryFilter,
        localizedCategoryLabel,
      );
      if (!inCategory) return false;
      if (targetGroupFilter === "all") return true;
      return product.targetGroupEntries.some(
        (entry) => normalizeTargetGroupSlug(entry) === targetGroupFilter,
      );
    });
  }, [products, categoryFilter, targetGroupFilter, t]);

  const availableColorsForCategory = useMemo(
    () => collectAvailableColorsForProducts(categoryScopedProducts),
    [categoryScopedProducts],
  );

  const availableColorsFingerprint = useMemo(
    () => availableColorsForCategory.join("\u0001"),
    [availableColorsForCategory],
  );

  const searchParamsString = useMemo(
    () => searchParams.toString(),
    [searchParams],
  );

  /** Single token so this effect’s dependency array is always length 1 (avoids React “deps size changed”). */
  const colorRouteSanitizeToken = useMemo(
    () =>
      [
        mounted ? "1" : "0",
        categoryFilter,
        colorFilter,
        availableColorsFingerprint,
        searchParamsString,
      ].join("\u0002"),
    [
      mounted,
      categoryFilter,
      colorFilter,
      availableColorsFingerprint,
      searchParamsString,
    ],
  );

  useEffect(() => {
    if (!mounted) return;
    if (categoryFilter === "all" && colorFilter !== "all") {
      const params = new URLSearchParams(searchParamsString);
      params.delete("color");
      const query = params.toString();
      routerRef.current.replace(query ? `/market?${query}` : "/market", { scroll: false });
      return;
    }

    if (
      categoryFilter !== "all" &&
      colorFilter !== "all" &&
      !availableColorsForCategory.includes(colorFilter)
    ) {
      const params = new URLSearchParams(searchParamsString);
      params.delete("color");
      const query = params.toString();
      routerRef.current.replace(query ? `/market?${query}` : "/market", { scroll: false });
    }
  }, [colorRouteSanitizeToken]);

  const setCategoryInRoute = (next: CategoryFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("category");
      params.delete("color");
    } else {
      params.set("category", next);
      params.delete("color");
    }
    const query = params.toString();
    router.replace(query ? `/market?${query}` : "/market", { scroll: false });
  };

  const setColorInRoute = (next: ColorFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("color");
    } else {
      params.set("color", next);
    }
    const query = params.toString();
    router.replace(query ? `/market?${query}` : "/market", { scroll: false });
  };

  const resetFiltersInRoute = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("color");
    params.delete("targetGroup");
    const query = params.toString();
    router.replace(query ? `/market?${query}` : "/market", { scroll: false });
  };

  const setTargetGroupInRoute = (next: TargetGroupFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("targetGroup");
    } else {
      params.set("targetGroup", next);
    }
    const query = params.toString();
    router.replace(query ? `/market?${query}` : "/market", { scroll: false });
  };

  const categoryLabelByValue = useMemo(
    () =>
      Object.fromEntries(
        PRODUCT_CATEGORIES.map(({ value }) => [value, t(`categories.${value}`)]),
      ) as Record<string, string>,
    [t],
  );

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20">
        <nav
          aria-label="Market sections"
          className="border-b border-black/10 py-5"
        >
          <div className="relative flex items-center justify-between md:justify-start">
            <button
              type="button"
              onClick={resetFiltersInRoute}
              className="cursor-pointer text-[10px] uppercase tracking-widest text-foreground transition hover:text-zinc-400"
            >
              {t("marketPage.allProducts")}
            </button>
            <div className="ml-4 flex items-center justify-end gap-4 sm:gap-6 md:absolute md:left-1/2 md:ml-0 md:-translate-x-1/2 md:justify-start md:gap-8">
              <Link
                href="/market?targetGroup=women"
                className={`border-b pb-0.5 text-[13px] font-medium uppercase tracking-widest transition hover:border-black hover:text-foreground ${
                  targetGroupFilter === "women"
                    ? "border-black text-foreground"
                    : "border-transparent text-foreground/60"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setTargetGroupInRoute("women");
                }}
              >
                {t("marketPage.women")}
              </Link>
              <Link
                href="/market?targetGroup=men"
                className={`border-b pb-0.5 text-[13px] font-medium uppercase tracking-widest transition hover:border-black hover:text-foreground ${
                  targetGroupFilter === "men"
                    ? "border-black text-foreground"
                    : "border-transparent text-foreground/60"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setTargetGroupInRoute("men");
                }}
              >
                {t("marketPage.men")}
              </Link>
              <Link
                href="/market?targetGroup=kids"
                className={`border-b pb-0.5 text-[13px] font-medium uppercase tracking-widest transition hover:border-black hover:text-foreground ${
                  targetGroupFilter === "kids"
                    ? "border-black text-foreground"
                    : "border-transparent text-foreground/60"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setTargetGroupInRoute("kids");
                }}
              >
                {t("marketPage.kids")}
              </Link>
            </div>
          </div>
        </nav>

        <div className="mt-4 flex flex-col gap-3 border-b border-black/10 pb-3">
          <div className="min-w-0 max-w-xs">
            <button
              type="button"
              onClick={() => setCategoryInRoute("all")}
              className="cursor-pointer text-[10px] font-medium uppercase tracking-widest text-muted-foreground transition hover:opacity-80"
            >
              {t("marketPage.categoryLabel")}
            </button>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryInRoute(e.target.value as CategoryFilter)}
              className="mt-1 h-8 w-full border-0 border-b border-black/15 bg-transparent px-0 text-sm capitalize text-foreground focus-visible:outline-none focus-visible:ring-0"
            >
              <option value="all" className="capitalize">
                {t("marketPage.allCategories")}
              </option>
              {PRODUCT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value} className="capitalize">
                  {categoryLabelByValue[value] ?? label}
                </option>
              ))}
            </select>
            {categoryFilter !== "all" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setColorInRoute("all")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide transition ${
                    colorFilter === "all"
                      ? "border-black bg-black text-white"
                      : "border-black/20 text-foreground/80 hover:border-black/35"
                  }`}
                >
                  {t("colors.all")}
                </button>
                {availableColorsForCategory.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorInRoute(color)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide transition ${
                      colorFilter === color
                        ? "border-black bg-black text-white"
                        : "border-black/20 text-foreground/80 hover:border-black/35"
                    }`}
                  >
                    {translateFilterColorLabel(color, t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0 max-w-xs">
            <label
              htmlFor="price-sort"
              className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              {t("marketPage.sort")}
            </label>
            <select
              id="price-sort"
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value as PriceSortOrder)}
              className="mt-1 h-8 w-full border-0 border-b border-black/15 bg-transparent px-0 text-sm text-foreground focus-visible:outline-none focus-visible:ring-0"
            >
              <option value="">{t("marketPage.sortBy")}</option>
              <option value="price-asc">{t("marketPage.priceLowHigh")}</option>
              <option value="price-desc">{t("marketPage.priceHighLow")}</option>
            </select>
          </div>
        </div>

        {loading && !error && (
          <p className="mt-6 text-sm text-muted-foreground">{t("marketPage.loadingProducts")}</p>
        )}

        {error && (
          <p className="mt-6 text-sm text-red-500">{t("marketPage.loadError")}</p>
        )}

        <div
          key={language}
          lang={language}
          className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {displayedProducts.map((product) => (
            <ProductCard
              key={`${product.id}-${language}`}
              product={product}
              textPaddingClassName="px-3 sm:px-4"
            />
          ))}

          {!error &&
            !loading &&
            products.length > 0 &&
            displayedProducts.length === 0 && (
              <p className="col-span-full mt-2 text-sm text-muted-foreground">
                {t("marketPage.noProductsForFilters")}
              </p>
            )}

          {!error && !loading && products.length === 0 && (
            <p className="col-span-full mt-6 text-sm text-muted-foreground">
              {t("marketPage.noProductsAvailable")}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Market() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-3.5rem)] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <p className="text-sm text-muted-foreground">{t("marketPage.loading")}</p>
          </div>
        </main>
      }
    >
      <MarketClient />
    </Suspense>
  );
}
