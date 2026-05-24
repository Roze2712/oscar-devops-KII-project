"use client";

import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { translateColorLabel } from "@/lib/translate-color-label";
import { cn } from "@/lib/utils";

export const PRODUCT_CATEGORIES = [
  { value: "bag", label: "Bag" },
  { value: "watches", label: "Watches" },
  { value: "headbands", label: "Венчиња" },
  { value: "shnoli", label: "Шноли" },
  { value: "earrings", label: "Earrings" },
  { value: "bracelets", label: "Bracelets" },
  { value: "wallets", label: "Wallets" },
  { value: "rings", label: "Rings" },
  { value: "backpacks", label: "Backpacks" },
  { value: "necklaces", label: "Necklaces" },
  { value: "sunglasses", label: "Sunglasses" },
] as const;

export type CategoryValue = (typeof PRODUCT_CATEGORIES)[number]["value"];
export type CategoryFilter = "all" | CategoryValue;
export type ColorFilter = "all" | string;

/**
 * Maps DB / admin free-text and locale display strings (MK, EN) to canonical
 * `PRODUCT_CATEGORIES` slugs used in URLs and `<select value>`.
 * Keys are `trim().toLowerCase().normalize("NFC")`.
 */
const CATEGORY_LABEL_TO_VALUE: Record<string, CategoryValue> = (() => {
  const map: Record<string, CategoryValue> = {};

  const register = (slug: CategoryValue, labels: string[]) => {
    for (const label of labels) {
      const key = label.trim().toLowerCase().normalize("NFC");
      if (key) map[key] = slug;
    }
  };

  for (const c of PRODUCT_CATEGORIES) {
    register(c.value, [c.value, c.label]);
  }

  /* Macedonian — align with `locales/mk.json` → `categories` (and `marketPage.categories`) */
  register("bag", [
    "чанти",
    "чанта",
    "ташна",
    "ташна со дино",
  ]);
  register("watches", ["часовници", "часовник"]);
  register("headbands", ["венчиња", "венче"]);
  register("shnoli", ["шноли", "шнола", "сноли"]);
  register("earrings", ["обетки", "обетка"]);
  register("bracelets", ["нараквици", "нараквица"]);
  register("wallets", ["паричници", "паричник"]);
  register("rings", ["прстени", "прстен"]);
  register("backpacks", ["ранци", "ранец", "ранче", "машко ранче"]);
  register("necklaces", ["ланчиња", "ланче"]);
  register("sunglasses", ["очила за сонце", "очила"]);

  /* English alternates / plurals when DB stores a label instead of the slug */
  register("bag", ["bags"]);
  register("watches", ["watch"]);
  register("headbands", ["headbands", "headband"]);
  register("shnoli", ["shnoli", "snoli", "šnoli"]);
  register("earrings", ["earring"]);
  register("bracelets", ["bracelet"]);
  register("wallets", ["wallet"]);
  register("rings", ["ring"]);
  register("backpacks", ["backpack"]);
  register("necklaces", ["necklace"]);

  return map;
})();

/** ASCII slug from Latin text; used when DB stores English-like tokens. */
function slugifyAsciiCategory(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Resolves a stored `products.category` value to the canonical filter slug, or "".
 * Case-insensitive; supports Macedonian labels, English labels, and URL slugs.
 */
export function resolveStoredCategoryToFilterValue(
  raw: string | null | undefined,
): CategoryValue | "" {
  if (raw == null) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const key = trimmed.toLowerCase().normalize("NFC");
  const fromMap = CATEGORY_LABEL_TO_VALUE[key];
  if (fromMap) return fromMap;

  const ascii = slugifyAsciiCategory(trimmed);
  if (!ascii) return "";

  if (PRODUCT_CATEGORIES.some((c) => c.value === ascii)) {
    return ascii as CategoryValue;
  }

  if (ascii.endsWith("s")) {
    const singular = ascii.slice(0, -1);
    if (PRODUCT_CATEGORIES.some((c) => c.value === singular)) {
      return singular as CategoryValue;
    }
  }

  return "";
}

export function categoryFromSearchParam(raw: string | null): CategoryFilter {
  if (!raw?.trim()) return "all";
  const resolved = resolveStoredCategoryToFilterValue(raw);
  return resolved || "all";
}

function normalizeCategoryCompare(s: string): string {
  return s.trim().toLowerCase().normalize("NFC");
}

/** Normalized chunks of a product name for substring matching (full + split on punctuation). */
function normalizedNameSearchTokens(raw: string): string[] {
  const full = normalizeCategoryCompare(raw);
  const parts = raw
    .split(/[,;/|\-\u2013\u2014–—]+/)
    .map((p) => normalizeCategoryCompare(p))
    .filter(Boolean);
  return [...new Set([full, ...parts])];
}

/** All known needles for a canonical slug (aliases, EN label, slug) for substring matching. */
const NEEDLES_BY_SLUG: Record<CategoryValue, string[]> = (() => {
  const sets: Record<CategoryValue, Set<string>> = {} as Record<
    CategoryValue,
    Set<string>
  >;
  for (const c of PRODUCT_CATEGORIES) {
    sets[c.value] = new Set();
  }
  for (const c of PRODUCT_CATEGORIES) {
    const s = sets[c.value];
    s.add(normalizeCategoryCompare(c.value));
    s.add(normalizeCategoryCompare(c.label));
  }
  for (const [key, slug] of Object.entries(CATEGORY_LABEL_TO_VALUE)) {
    sets[slug as CategoryValue].add(key);
  }
  return Object.fromEntries(
    (Object.keys(sets) as CategoryValue[]).map((slug) => [
      slug,
      [...sets[slug]].filter((n) => n.length >= 2),
    ]),
  ) as Record<CategoryValue, string[]>;
})();

/**
 * Category filter matches a **caller-provided haystack** (market builds this from
 * product names, optional `name_en`, and optional admin `category` text) against
 * locale labels, slugs, and known MK/EN aliases.
 */
export function productNameMatchesCategoryFilter(
  productName: string | null | undefined,
  selected: CategoryFilter,
  localizedCategoryLabel: string,
): boolean {
  if (selected === "all") return true;

  const haystacks = normalizedNameSearchTokens(String(productName ?? ""));
  if (haystacks.every((h) => !h)) return false;

  const needles = new Set<string>([
    ...NEEDLES_BY_SLUG[selected],
    normalizeCategoryCompare(localizedCategoryLabel),
    selected.toLowerCase(),
  ]);
  const needleList = [...needles].filter((n) => n.length >= 2);

  for (const hay of haystacks) {
    if (!hay) continue;
    for (const needle of needleList) {
      if (hay.includes(needle)) return true;
    }
  }

  return false;
}

function isHexColorToken(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const h = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h);
}

/** One stored label may list variants with slashes, e.g. "Blue / Blue-Orange". */
function splitSlashSeparatedColorParts(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (isHexColorToken(t)) return [t];
  if (/\s*\/\s*/.test(t)) {
    return t.split(/\s*\/\s*/).flatMap((part) => splitSlashSeparatedColorParts(part));
  }
  return [t];
}

export function normalizeColorFilterValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isHexColorToken(trimmed)) {
    return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toUpperCase();
  }
  return trimmed.toLocaleLowerCase("mk-MK").replace(/\s+/g, " ");
}

/**
 * UI label for a normalized filter token (same resolution pattern as product detail colors).
 */
export function translateFilterColorLabel(
  normalizedToken: string,
  t: (key: string) => string,
): string {
  const trimmed = normalizedToken.trim();
  if (!trimmed) return "";
  if (isHexColorToken(trimmed)) {
    const h = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return h.toUpperCase();
  }
  return translateColorLabel(trimmed, t);
}

function getProductColorLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];

  for (const entry of raw) {
    if (typeof entry === "string") {
      for (const piece of splitSlashSeparatedColorParts(entry)) {
        const normalized = normalizeColorFilterValue(piece);
        if (normalized) labels.push(normalized);
      }
      continue;
    }
    if (typeof entry === "object" && entry !== null) {
      const obj = entry as { name?: unknown; label?: unknown; hex?: unknown };
      const text =
        (typeof obj.name === "string" && obj.name) ||
        (typeof obj.label === "string" && obj.label) ||
        (typeof obj.hex === "string" && obj.hex) ||
        "";
      for (const piece of splitSlashSeparatedColorParts(text)) {
        const normalized = normalizeColorFilterValue(piece);
        if (normalized) labels.push(normalized);
      }
    }
  }

  return labels;
}

export function productMatchesColorFilter(
  productColors: unknown,
  selected: ColorFilter,
): boolean {
  if (selected === "all") return true;
  const productColorLabels = getProductColorLabels(productColors);
  return productColorLabels.includes(selected);
}

export function collectAvailableColorsForProducts(
  products: Array<{ colors: unknown }>,
): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    for (const color of getProductColorLabels(product.colors)) {
      seen.add(color);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "mk-MK"));
}

type MarketCategoryFilterProps = {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
  availableColors?: string[];
  colorValue?: ColorFilter;
  onColorChange?: (next: ColorFilter) => void;
};

export function MarketCategoryFilter({
  value,
  onChange,
  availableColors = [],
  colorValue = "all",
  onColorChange,
}: MarketCategoryFilterProps) {
  const { t } = useLanguage();
  const showColorSubFilter =
    value !== "all" && availableColors.length > 0 && typeof onColorChange === "function";

  return (
    <div className="mt-6 max-w-xs">
      <Label htmlFor="category-filter" className="text-muted-foreground">
        Category
      </Label>
      <select
        id="category-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as CategoryFilter)}
        className={cn(
          "mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        )}
      >
        <option value="all">All categories</option>
        {PRODUCT_CATEGORIES.map(({ value: v, label }) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>

      {showColorSubFilter ? (
        <div className="mt-3">
          <Label className="text-muted-foreground">Color</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onColorChange("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                colorValue === "all"
                  ? "border-foreground bg-foreground text-background"
                  : "border-input text-foreground hover:bg-muted",
              )}
            >
              {t("colors.all")}
            </button>
            {availableColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onColorChange(color)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  colorValue === color
                    ? "border-foreground bg-foreground text-background"
                    : "border-input text-foreground hover:bg-muted",
                )}
              >
                {translateFilterColorLabel(color, t)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
