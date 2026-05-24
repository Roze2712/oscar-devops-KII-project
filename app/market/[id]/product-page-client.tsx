"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Ruler,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  localizedProductDelivery,
  localizedProductDescription,
  localizedProductName,
  normalizeProductColors,
  type ColorSwatch,
} from "@/lib/product-localization";
import { formatProductPriceWithCurrency } from "@/lib/product-localization";
import { translateColorLabel } from "@/lib/translate-color-label";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "@/components/product-card";
import { useLanguage } from "@/context/LanguageContext";
import {
  productNameMatchesCategoryFilter,
  resolveStoredCategoryToFilterValue,
} from "@/app/market/_components/category-filter";

type RelatedNameGroup =
  | "headbands"
  | "sunglasses"
  | "earrings"
  | "bracelets"
  | "necklaces"
  | "watches"
  | "wallets"
  | "backpacks"
  | "mini_backpacks"
  | "shnoli"
  | "bag"
  | "rings";

/**
 * Lower-cased substrings used to classify a product from its localized name(s)
 * alone — no DB `category` column is consulted, so this is robust to legacy
 * rows, typos, and admin-form changes.
 *
 * Order matters: the first group whose keyword appears in the name wins, so
 * more specific terms must come before short/ambiguous ones. For example,
 * "earring" must be checked before "ring", otherwise an earring would be
 * misclassified as a ring (because "ring" is a substring of "earring").
 */
const RELATED_NAME_GROUPS: ReadonlyArray<{
  group: RelatedNameGroup;
  keywords: ReadonlyArray<string>;
}> = [
  {
    group: "headbands",
    keywords: ["headband", "венче", "венчиња", "vence"],
  },
  {
    group: "sunglasses",
    keywords: ["sunglasses", "sunglass", "очила", "очила за сонце", "ocila"],
  },
  {
    group: "earrings",
    keywords: ["earring", "обетки", "обетка", "obetki"],
  },
  {
    group: "bracelets",
    keywords: ["bracelet", "нараквица", "нараквици", "narakvica", "narakvici"],
  },
  {
    group: "necklaces",
    keywords: ["necklace", "ланче", "ланчиња", "lance", "lanche"],
  },
  {
    group: "watches",
    keywords: ["watch", "часовник", "часовници", "casovnik", "casovnici"],
  },
  {
    group: "wallets",
    keywords: ["wallet", "паричник", "паричници", "parichnik", "parichnici"],
  },
  // `mini_backpacks` MUST come before `backpacks` so that a product named
  // "Женско ранче …" classifies as a mini-backpack instead of falling through
  // to the full-size group. "ранче" and "ранец" don't overlap as substrings
  // (4th character differs: ч vs ц), so a full-size "Ранец" can never be
  // misclassified as a mini-backpack — the two are cleanly disjoint.
  {
    group: "mini_backpacks",
    keywords: ["ранче", "ранчиња", "ranche"],
  },
  {
    group: "backpacks",
    keywords: ["backpack", "ранец", "ранци", "ranec", "ranci"],
  },
  {
    group: "shnoli",
    keywords: ["shnoli", "šnoli", "шнола", "шноли"],
  },
  {
    group: "bag",
    keywords: [
      "bag",
      "чанта",
      "чанти",
      "чани",
      "chanta",
      "куфер",
      "ташна",
      "ташни",
    ],
  },
  {
    group: "rings",
    keywords: ["ring", "прстен", "прстени", "prsten"],
  },
];

/**
 * Classify a product by what's in `name` / `name_en`. Returns the matched
 * group slug, or `null` when no keyword matches (caller treats this as
 * "unknown" and skips the strict group filter).
 */
function detectProductNameGroup(
  name: string | null | undefined,
  nameEn: string | null | undefined,
): RelatedNameGroup | null {
  const blob = [name, nameEn]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
  if (!blob) return null;

  for (const { group, keywords } of RELATED_NAME_GROUPS) {
    if (keywords.some((kw) => blob.includes(kw))) {
      return group;
    }
  }
  return null;
}

type Product = {
  id: number;
  name: string;
  name_en?: string | null;
  name_mk?: string | null;
  category?: string | null;
  price: string | null;
  description: string | null;
  description_en?: string | null;
  description_mk?: string | null;
  delivery_en?: string | null;
  delivery_mk?: string | null;
  image: string | null;
  colors: unknown;
  dimensions: string | null;
  /** Raw Supabase `targetGroup` cell (array, JSON-string or single string). */
  targetGroup: unknown;
};

type RecommendedProduct = {
  id: number;
  name: string;
  name_en?: string | null;
  category?: string | null;
  price: string | null;
  image: string | null;
};

const colorMap: Record<string, string> = {
  // Latin
  bela: "white",
  crna: "black",
  crvena: "#B22222",
  plava: "#ADD8E6",
  plavo: "#ADD8E6",
  zelena: "green",
  zolta: "#FDFD96",
  portokalova: "orange",
  roze: "pink",
  rozeva: "#FFB6C1",
  violetova: "purple",
  bronza: "#D4A76A",
  bronzena: "#D4A76A",
  zlatna: "#D4AF37",
  srebrena: "#C0C0C0",
  bezh: "#F5F5DC",
  braon: "#4B2C20",
  kafena: "#4B2C20",
  siva: "gray",
  "temno-sina": "darkblue",
  "temno sina": "darkblue",
  krem: "#FFFDD0",
  kremasta: "#FFFDD0",
  bordo: "#800000",
  ciklama: "#D33682",
  // Cyrillic
  бела: "white",
  црна: "black",
  црвена: "#B22222",
  плава: "#ADD8E6",
  плаво: "#ADD8E6",
  зелена: "green",
  жолта: "#FDFD96",
  портокалова: "orange",
  розе: "pink",
  розева: "#FFB6C1",
  виолетова: "purple",
  бронза: "#D4A76A",
  бронзена: "#D4A76A",
  златна: "#D4AF37",
  сребрена: "#C0C0C0",
  беж: "#F5F5DC",
  браон: "#4B2C20",
  кафена: "#4B2C20",
  сива: "gray",
  "темно-сина": "darkblue",
  "темно сина": "darkblue",
  крем: "#FFFDD0",
  кремаста: "#FFFDD0",
  бордо: "#800000",
  борда: "#800000",
  циклама: "#D33682",
};

function productIsHeadbandsForDescription(
  product: Product,
  headbandsLocaleLabel: string,
): boolean {
  if (resolveStoredCategoryToFilterValue(product?.category) === "headbands") {
    return true;
  }
  const nameBlob = [product?.name, product?.name_en, product?.name_mk]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");
  return productNameMatchesCategoryFilter(
    nameBlob,
    "headbands",
    headbandsLocaleLabel,
  );
}

/**
 * True when this product is in the bags category — either by its persisted
 * `category` slug or by its localized name. Mirrors the headbands helper so
 * legacy rows (whose `category` was never written) still get the bag default.
 */
function productIsBagsForDescription(
  product: Product,
  bagsLocaleLabel: string,
): boolean {
  if (resolveStoredCategoryToFilterValue(product?.category) === "bag") {
    return true;
  }
  const nameBlob = [product?.name, product?.name_en, product?.name_mk]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");
  return productNameMatchesCategoryFilter(nameBlob, "bag", bagsLocaleLabel);
}

function parseNumericId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce Supabase row so missing i18n columns or odd types never break the page. */
function parseProductRow(row: unknown): Product | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = parseNumericId(r.id);
  if (id === null) return null;

  const nameRaw = r.name;
  const name =
    typeof nameRaw === "string"
      ? nameRaw
      : nameRaw == null
        ? ""
        : String(nameRaw);

  const priceRaw = r.price;
  const price: string | null =
    priceRaw == null
      ? null
      : typeof priceRaw === "string"
        ? priceRaw
        : typeof priceRaw === "number"
          ? String(priceRaw)
          : null;

  const desc = r.description;
  const description: string | null =
    typeof desc === "string" ? desc : desc == null ? null : String(desc);

  const img = r.image;
  const image = typeof img === "string" ? img : null;

  const dim = r.dimensions;
  const dimensions: string | null =
    typeof dim === "string" ? dim : dim == null ? null : String(dim);

  const optText = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v !== "string") return null;
    return v;
  };

  return {
    id,
    name,
    name_en: optText(r.name_en),
    name_mk: optText(r.name_mk),
    category: optText(r.category),
    price,
    description,
    description_en: optText(r.description_en),
    description_mk: optText(r.description_mk),
    delivery_en: optText(r.delivery_en),
    delivery_mk: optText(r.delivery_mk),
    image,
    colors: r.colors,
    dimensions,
    targetGroup: r.targetGroup ?? null,
  };
}

function getSwatchBackgroundColor(color: ColorSwatch): string {
  if (color.hex) return color.hex;

  const rawName = color.name ?? color.label ?? "";
  const normalized = rawName
    .trim()
    .toLocaleLowerCase("mk-MK")
    .replace(/\s+/g, " ");
  if (!normalized) return "hsl(var(--muted))";

  const mapped = colorMap[normalized];
  if (mapped !== undefined) return mapped;

  if (isHexColorToken(normalized)) {
    return normalized.startsWith("#") ? normalized : `#${normalized}`;
  }

  // Unmapped Cyrillic (or other non-ASCII) strings are not valid CSS colors and render as white.
  if (/[^\u0020-\u007e]/.test(normalized)) {
    return "hsl(var(--muted))";
  }

  return normalized;
}

function isHexColorToken(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const h = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h);
}

function getProductImageList(image: string | null): string[] {
  if (!image) return [];
  const trimmed = image.trim();
  if (!trimmed) return [];

  // New format: JSON array string stored in the image field.
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean);
      }
    } catch {
      // Fall back to legacy single-string behavior.
    }
  }

  // Legacy format: plain string URL.
  return [trimmed];
}

function ProductAccordion({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-border">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 py-5 text-xs font-medium uppercase tracking-[0.2em] text-foreground [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2.5">
          {icon}
          <span>{title}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="pb-8 text-left text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

export default function ProductPageClient() {
  const params = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<RecommendedProduct[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [addToBagState, setAddToBagState] = useState<"idle" | "adding" | "added">(
    "idle",
  );
  // `LanguageContext.readStoredLanguage` returns "mk" during SSR (no `window`)
  // but synchronously reads localStorage on the client, so a returning user
  // with `oscar-dt-language === "en"` flips `language` to "en" on the first
  // client paint while the server-rendered HTML is still in "mk". Gate the
  // two locale-dependent nodes that are present in the SSR output (the
  // `<main lang>` attribute and the breadcrumb label) on this flag so the
  // first client render mirrors SSR, then re-renders with the real values
  // once mounted.
  const [isMounted, setIsMounted] = useState(false);
  const addToBagResetTimeoutRef = useRef<number | null>(null);
  const recommendationsSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      setError("Invalid product id.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const load = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) {
          setError(fetchError.message);
          setProduct(null);
        } else {
          const parsed = parseProductRow(data);
          if (!parsed) {
            setError("Invalid product data.");
            setProduct(null);
          } else {
            setProduct(parsed);
            setError(null);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.id]);

  useEffect(() => {
    if (!product) {
      setRelatedProducts([]);
      return;
    }

    const RELATED_LIMIT = 8;
    const MIN_GROUP_MATCHES = 4;
    const RELATED_SELECT = "id, name, name_en, category, price, image";

    let cancelled = false;
    const currentProductId = product.id;
    const currentGroup = detectProductNameGroup(product.name, product.name_en);
    const currentGroupKeywords =
      currentGroup === null
        ? []
        : (RELATED_NAME_GROUPS.find((g) => g.group === currentGroup)
            ?.keywords ?? []);

    const loadRelated = async () => {
      const supabase = createClient();
      let groupMatches: RecommendedProduct[] = [];

      // 1. Server-side ilike across the active group's keywords on both
      //    `name` and `name_en`. This finds matching rows regardless of how
      //    far back in the catalog they sit (no pool-depth dependency).
      if (currentGroup && currentGroupKeywords.length > 0) {
        const orFilter = currentGroupKeywords
          .flatMap((kw) => [`name.ilike.%${kw}%`, `name_en.ilike.%${kw}%`])
          .join(",");

        const { data, error: matchError } = await supabase
          .from("products")
          .select(RELATED_SELECT)
          .or(orFilter)
          .neq("id", currentProductId)
          .order("id", { ascending: false })
          .limit(RELATED_LIMIT * 3);

        if (!matchError && data) {
          // Re-run the priority detector on each row so that, e.g., a query
          // for the "rings" group doesn't accidentally surface earrings via
          // the substring `ring` ⊂ `earring`.
          groupMatches = (data as RecommendedProduct[])
            .filter(
              (p) => detectProductNameGroup(p.name, p.name_en) === currentGroup,
            )
            .slice(0, RELATED_LIMIT);
        }
      }

      if (cancelled) return;

      if (groupMatches.length >= MIN_GROUP_MATCHES) {
        setRelatedProducts(groupMatches.slice(0, RELATED_LIMIT));
        return;
      }

      // 2. Top up to RELATED_LIMIT with newest products (excluding current
      //    and anything already matched). Only runs when the targeted query
      //    yielded fewer than the minimum.
      const slotsToFill = RELATED_LIMIT - groupMatches.length;
      const excludedIds = [
        currentProductId,
        ...groupMatches.map((p) => p.id),
      ];

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("products")
        .select(RELATED_SELECT)
        .not("id", "in", `(${excludedIds.join(",")})`)
        .order("id", { ascending: false })
        .limit(slotsToFill);

      if (cancelled) return;

      if (fallbackError || !fallbackData) {
        setRelatedProducts(groupMatches);
        return;
      }

      setRelatedProducts(
        [...groupMatches, ...(fallbackData as RecommendedProduct[])].slice(
          0,
          RELATED_LIMIT,
        ),
      );
    };

    void loadRelated();

    return () => {
      cancelled = true;
    };
  }, [product]);

  const scrollRecommendationsBy = (direction: "left" | "right") => {
    const el = recommendationsSliderRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 320);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const colorSwatches = product
    ? normalizeProductColors(product.colors, language)
    : null;
  const productImages = product ? getProductImageList(product.image) : [];
  const displayName = product ? localizedProductName(product, language) : "";
  const productDescriptionText = useMemo(() => {
    if (!product) return null;
    return localizedProductDescription(product, language, {
      headbandsLocaleLabel: t("marketPage.categories.headbands"),
      isHeadbandsProduct: (p, label) =>
        productIsHeadbandsForDescription(p as Product, label),
      bagsLocaleLabel: t("marketPage.categories.bag"),
      isBagsProduct: (p, label) =>
        productIsBagsForDescription(p as Product, label),
      // Treat the active locale's "no description" placeholder as empty so
      // legacy DB rows that copied the placeholder text into the column still
      // fall through to the women's/men's bag defaults below.
      placeholderDescriptions: [t("productDetail.noDescription")],
    });
  }, [product, language, t]);
  const displayDeliveryText = product
    ? localizedProductDelivery(product, language, t("productDetail.deliveryBody"))
    : "";
  const activeColor =
    colorSwatches && colorSwatches.length > 0
      ? colorSwatches[Math.min(selectedColorIndex, colorSwatches.length - 1)]
      : null;
  const activeColorName = activeColor?.name ?? activeColor?.label ?? activeColor?.hex ?? "";
  const displayColorLabel = translateColorLabel(activeColorName, t);

  const displayPriceWithCurrency = useMemo(
    () => formatProductPriceWithCurrency(product?.price ?? null, t("currency")),
    [product?.price, t, language],
  );

  useEffect(() => {
    setSelectedColorIndex(0);
  }, [product?.id]);

  useEffect(() => {
    return () => {
      if (addToBagResetTimeoutRef.current) {
        clearTimeout(addToBagResetTimeoutRef.current);
      }
    };
  }, []);

  const handleAddToBag = () => {
    if (!product || addToBagState === "adding") return;

    if (addToBagResetTimeoutRef.current) {
      clearTimeout(addToBagResetTimeoutRef.current);
      addToBagResetTimeoutRef.current = null;
    }

    setAddToBagState("adding");
    const startedAt = Date.now();
    const image = productImages.length > 0 ? productImages[0] : null;
    addToCart({
      id: product.id,
      name: product.name?.trim() || displayName || "",
      name_en: product.name_en?.trim() || null,
      price: product.price,
      image,
    });

    const elapsed = Date.now() - startedAt;
    const minAddingVisibleMs = 250;
    const waitBeforeSuccessMs = Math.max(0, minAddingVisibleMs - elapsed);

    window.setTimeout(() => {
      setAddToBagState("added");
      addToBagResetTimeoutRef.current = window.setTimeout(() => {
        setAddToBagState("idle");
        addToBagResetTimeoutRef.current = null;
      }, 2000);
    }, waitBeforeSuccessMs);
  };

  return (
    <main
      key={language}
      lang={isMounted ? language : "mk"}
      className="min-h-[calc(100vh-3.5rem)] bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-12 lg:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-10 text-[13px] font-normal tracking-wide text-muted-foreground"
        >
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link
                href="/market"
                className="text-foreground/80 transition hover:text-foreground"
              >
                {/* Pre-mount fallback must match the SSR output, which always
                    uses the MK dictionary (see comment by `isMounted` above).
                    Keep this literal in sync with `locales/mk.json` → `market`. */}
                {isMounted ? t("market") : "Производи"}
              </Link>
            </li>
            <li aria-hidden className="text-muted-foreground/50">
              /
            </li>
            <li className="max-w-[min(100%,28rem)] truncate">
              {loading ? (
                <span className="text-muted-foreground/70">…</span>
              ) : product ? (
                <span className="text-muted-foreground capitalize">
                  {displayName}
                </span>
              ) : (
                <span className="text-muted-foreground/70">
                  {t("productDetail.productFallback")}
                </span>
              )}
            </li>
          </ol>
        </nav>

        {loading && (
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-14 lg:gap-20">
            <div className="aspect-[3/4] w-full animate-pulse bg-muted/60" />
            <div className="flex flex-col gap-6 pt-2 md:max-w-md">
              <div className="h-10 w-3/4 animate-pulse rounded bg-muted/60" />
              <div className="h-8 w-1/3 animate-pulse rounded bg-muted/60" />
              <div className="h-12 w-full max-w-md animate-pulse rounded bg-muted/60" />
              <div className="h-px w-full max-w-md animate-pulse bg-muted/40" />
              <div className="h-10 w-full max-w-md animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-500">{t("productDetail.loadError")}</p>
        )}

        {!loading && !error && product && (
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 lg:gap-24 xl:gap-28">
            <div className="flex flex-col gap-1">
              {productImages.length > 0 ? (
                productImages.map((imageSrc, index) => (
                  <div
                    key={`${imageSrc}-${index}`}
                    className="overflow-hidden bg-muted/15"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase URLs */}
                    <img
                      src={imageSrc}
                      alt={`${displayName || product.name} image ${index + 1}`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ))
              ) : (
                <div className="flex min-h-[280px] w-full items-center justify-center bg-muted/15 text-sm text-muted-foreground">
                  {t("productDetail.noImage")}
                </div>
              )}
            </div>

            <div className="flex w-full flex-col md:sticky md:top-28 md:max-w-md lg:max-w-lg md:self-start md:pt-2">
              <h1 className="w-full text-left text-3xl font-bold capitalize tracking-tight text-foreground sm:text-4xl sm:leading-[1.15]">
                {displayName}
              </h1>
              <p className="mt-5 w-full text-left text-2xl font-medium tabular-nums tracking-tight text-foreground">
                {displayPriceWithCurrency}
              </p>

              {colorSwatches && colorSwatches.length > 0 && (
                <div className="mt-8 w-full">
                  <p className="mb-5 text-left text-sm tracking-[0.08em] text-foreground">
                    <span className="font-semibold uppercase">
                      {t("productDetail.color")}:
                    </span>{" "}
                    <span className="font-medium text-foreground">
                      {displayColorLabel}
                    </span>
                  </p>
                  <div
                    className="flex flex-wrap justify-start gap-3"
                    role="list"
                    aria-label={t("productDetail.availableColors")}
                  >
                    {colorSwatches.map((c, i) => {
                      const key = `${c.hex ?? c.name ?? c.label ?? i}-${i}`;
                      const rawSwatchLabel = c.label ?? c.name ?? c.hex ?? "";
                      const swatchLabel = translateColorLabel(rawSwatchLabel, t);

                      return (
                        <button
                          key={key}
                          type="button"
                          title={swatchLabel}
                          aria-label={swatchLabel || `Color ${i + 1}`}
                          aria-pressed={i === selectedColorIndex}
                          onClick={() => setSelectedColorIndex(i)}
                          className={`inline-flex size-8 shrink-0 rounded-full border border-border/70 transition ${
                            i === selectedColorIndex
                              ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                              : "ring-1 ring-black/10 hover:ring-black/25"
                          }`}
                          style={{ backgroundColor: getSwatchBackgroundColor(c) }}
                        >
                          <span className="sr-only">
                            {swatchLabel || `Color ${i + 1}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  void handleAddToBag();
                }}
                disabled={addToBagState === "adding"}
                aria-live="polite"
                className={`mt-10 flex w-full max-w-md items-center justify-center gap-2 border border-transparent py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  addToBagState === "added"
                    ? "animate-pulse bg-black hover:bg-black"
                    : "bg-black hover:bg-black/90"
                } ${addToBagState === "adding" ? "cursor-wait opacity-95" : ""}`}
              >
                {addToBagState === "adding" ? (
                  <>
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    {t("addingToCart")}
                  </>
                ) : addToBagState === "added" ? (
                  t("addedToCart")
                ) : (
                  t("addToCart")
                )}
              </button>

              <div className="mt-14 w-full max-w-md border-t border-border">
                <ProductAccordion
                  title={t("productDetail.description")}
                  icon={<ClipboardList size={18} strokeWidth={1.2} aria-hidden />}
                >
                  {productDescriptionText !== null &&
                  productDescriptionText.trim() !== ""
                    ? productDescriptionText
                    : t("productDetail.noDescription")}
                </ProductAccordion>
                {product.dimensions &&
                  product.dimensions !== "" && (
                    <ProductAccordion
                      title={t("productDetail.dimensions")}
                      icon={<Ruler size={18} strokeWidth={1.2} aria-hidden />}
                    >
                      {product.dimensions.trim()}
                    </ProductAccordion>
                  )}
                <ProductAccordion
                  title={t("productDetail.shipping")}
                  icon={<Truck size={18} strokeWidth={1.2} aria-hidden />}
                >
                  {displayDeliveryText}
                </ProductAccordion>
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && !error && product && relatedProducts.length > 0 && (
        <section
          className="mt-20 w-full max-w-full border-t border-border pb-16 pt-12"
          aria-labelledby="you-may-also-like-heading"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
            <h2
              id="you-may-also-like-heading"
              className="mb-6 px-3 text-center text-2xl font-semibold tracking-tight sm:px-4"
            >
              {t("moreProducts")}
            </h2>
          </div>

          <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2">
            <button
              type="button"
              onClick={() => scrollRecommendationsBy("left")}
              aria-label={t("productDetail.previousRecommendations")}
              className="absolute left-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/40 bg-background/20 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-white/80 dark:hover:bg-background/50"
            >
              <ChevronLeft className="size-5" strokeWidth={2} />
            </button>

            <div
              ref={recommendationsSliderRef}
              className="flex min-w-0 snap-x snap-mandatory touch-pan-x gap-2 overflow-x-auto scroll-pl-0 scroll-pr-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {relatedProducts.map((p) => (
                <ProductCard
                  key={`related-${p.id}`}
                  product={p}
                  className="w-[40vw] shrink-0 snap-start lg:w-[calc((100vw-1.5rem)/4)]"
                  textPaddingClassName="px-3 sm:px-4"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollRecommendationsBy("right")}
              aria-label={t("productDetail.nextRecommendations")}
              className="absolute right-2 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/40 bg-background/20 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-white/80 dark:hover:bg-background/50"
            >
              <ChevronRight className="size-5" strokeWidth={2} />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
