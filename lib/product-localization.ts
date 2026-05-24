export type ProductDisplayLanguage = "mk" | "en";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalizeFirstLetter(value: string): string {
  const s = value.trim();
  if (!s) return value;
  return s[0].toLocaleUpperCase() + s.slice(1);
}

/**
 * Latin glyphs that get accidentally typed in place of their Cyrillic look-alikes
 * (Latin `o`/`a`/`e`/`p`/`c`/`x`/`y` ↔ Cyrillic `о`/`а`/`е`/`р`/`с`/`х`/`у`).
 * When such a Latin char sits *inside* a run of Cyrillic letters it's almost
 * certainly a homoglyph typo, not a deliberate ASCII char — rewrite it to its
 * Cyrillic twin so the dictionary still matches.
 *
 * Without this step, an admin entry like "Платновo венче" (last `o` is Latin)
 * leaks through the gloss and renders as "Knittedo headband".
 */
const LATIN_TO_CYRILLIC_HOMOGLYPHS: Record<string, string> = {
  o: "о",
  O: "О",
  a: "а",
  A: "А",
  e: "е",
  E: "Е",
  p: "р",
  P: "Р",
  c: "с",
  C: "С",
  x: "х",
  X: "Х",
  y: "у",
  Y: "У",
  k: "к",
  K: "К",
  H: "Н",
  B: "В",
  M: "М",
  T: "Т",
};

function normalizeCyrillicHomoglyphs(input: string): string {
  if (!input) return input;
  const isCyrillic = (code: number) => code >= 0x0400 && code <= 0x04ff;
  return input.replace(
    /[oOaAeEpPcCxXyYkKHBMT]/g,
    (latin, offset: number, full: string) => {
      const prev = offset > 0 ? full.charCodeAt(offset - 1) : 0;
      const next =
        offset + 1 < full.length ? full.charCodeAt(offset + 1) : 0;
      if (isCyrillic(prev) || isCyrillic(next)) {
        return LATIN_TO_CYRILLIC_HOMOGLYPHS[latin] ?? latin;
      }
      return latin;
    },
  );
}

/**
 * Words our gloss can legitimately emit. Used as anchors when scrubbing the
 * one corruption pattern still observed in the wild: a saved `name_en` /
 * `description_en` row that contains "<gloss-output>" + a single stray `o`
 * (Latin or Cyrillic `о`) before a word boundary, e.g. "Knittedo headband".
 *
 * That artifact predates the homoglyph pre-pass: an admin saved a product
 * whose MK title had a Latin `o` typo, the old gloss left it in place, the
 * mangled result was written to `name_en`, and now `resolveProductDisplayTitle`
 * happily returns it unchanged. We can't rerun the gloss without a DB
 * migration, so we sanitize on render instead.
 */
const KNOWN_EN_GLOSS_NOUNS: ReadonlyArray<string> = [
  "knitted",
  "headband",
  "headbands",
  "leather",
  "eco-leather",
  "wallet",
  "wallets",
  "bag",
  "bags",
  "backpack",
  "backpacks",
  "watch",
  "watches",
  "bracelet",
  "bracelets",
  "ring",
  "rings",
  "necklace",
  "necklaces",
  "earring",
  "earrings",
  "hair clip",
  "hair clips",
  "hair band",
  "hair bands",
  "sunglasses",
  "butterfly",
  "formula",
];

const STRAY_TRAILING_O_RES: ReadonlyArray<RegExp> = KNOWN_EN_GLOSS_NOUNS.map(
  (word) =>
    new RegExp(`\\b(${escapeRegExp(word)})[oо]+(?=\\s|$|[,.!?;:])`, "gi"),
);

/**
 * Idempotent post-processor for any English product copy headed to the UI.
 * Removes the stray-`o` artifact described above without touching legitimate
 * text (plurals stay intact — `[oо]` is the only suffix the regex eats, and
 * it requires a word boundary right after).
 */
function sanitizeEnglishProductCopy(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of STRAY_TRAILING_O_RES) {
    out = out.replace(re, "$1");
  }
  return out;
}

/**
 * English product nouns (+ the `with` connector) that occasionally leak into
 * `description_mk` / legacy `description` rows when an admin half-translates
 * the copy on save — the observed pattern is e.g. "Sunglasses with пластична
 * рамка". Keys are lowercase English; values are the Macedonian equivalent
 * in lowercase. Sentence-start capitalization is reapplied at replacement
 * time from the matched source token.
 *
 * Intentionally narrow: only product nouns and `with`. Broader EN→MK gloss
 * (adjectives, colors, full sentences) belongs in a dedicated
 * `glossEnDescriptionToMk` helper, not here, to avoid quietly mangling
 * mostly-English copy that landed in the MK column.
 */
const STRAY_EN_TO_MK_TOKENS_RAW: ReadonlyArray<[string, string]> = [
  ["sunglasses", "очила за сонце"],
  ["backpacks", "ранци"],
  ["backpack", "ранец"],
  ["headbands", "венчиња"],
  ["headband", "венче"],
  ["wallets", "паричници"],
  ["wallet", "паричник"],
  ["watches", "часовници"],
  ["watch", "часовник"],
  ["bracelets", "нараквици"],
  ["bracelet", "нараквица"],
  ["necklaces", "ланчиња"],
  ["necklace", "ланче"],
  ["earrings", "обетки"],
  ["earring", "обетка"],
  ["rings", "прстени"],
  ["ring", "прстен"],
  ["bags", "чанти"],
  ["bag", "чанта"],
  ["hair clips", "шноли"],
  ["hair clip", "шнола"],
  ["hair bands", "ленти за коса"],
  ["hair band", "лента за коса"],
  ["with", "со"],
];

// Sort longest-first so multi-word phrases ("hair clip") and plurals
// ("backpacks") win over their shorter substrings ("backpack").
const STRAY_EN_TO_MK_TOKEN_RES: ReadonlyArray<[RegExp, string]> = [
  ...STRAY_EN_TO_MK_TOKENS_RAW,
]
  .sort((a, b) => b[0].length - a[0].length)
  .map(
    ([en, mk]) =>
      [new RegExp(`\\b${escapeRegExp(en)}\\b`, "gi"), mk] as [RegExp, string],
  );

function startsWithUppercaseLatin(ch: string | undefined): boolean {
  // ASCII A–Z only — the source token is always Latin, so the check stays
  // simple and avoids any Unicode case-folding surprises.
  return !!ch && ch >= "A" && ch <= "Z";
}

/**
 * Idempotent post-processor for Macedonian product copy. Swaps a narrow
 * set of stray English product nouns (plus the `with` connector) for their
 * Macedonian equivalents while leaving fully-MK text untouched.
 *
 * Skipped entirely when the input contains no Cyrillic at all — without
 * that guard a pure-English fallback (e.g. an MK locale row that has only
 * `description_en`) would get half-translated, which is worse than the
 * original English. That broader case is intentionally left to a future
 * EN→MK gloss.
 */
function sanitizeMacedonianProductCopy(text: string): string {
  if (!text) return text;
  if (!/[\u0400-\u04FF]/.test(text)) return text;

  let out = text;
  for (const [re, mk] of STRAY_EN_TO_MK_TOKEN_RES) {
    out = out.replace(re, (match) =>
      startsWithUppercaseLatin(match[0])
        ? mk.charAt(0).toLocaleUpperCase("mk-MK") + mk.slice(1)
        : mk,
    );
  }
  return out;
}

/** Longer Macedonian phrases first (client-side EN fallback when `name_en` is empty). */
const MK_TITLE_PHRASES_RAW: [string, string][] = [
  ["очила за сонце", "sunglasses"],
  ["женско ранче", "girls' backpack"],
  ["машко ранче", "boys' backpack"],
  ["ленти за коса", "hair bands"],
  ["лента за коса", "hair band"],
  ["платневи венчиња", "knitted headbands"],
  ["платново венче", "knitted headband"],
  ["венчиња", "headbands"],
  ["венче", "headband"],
  ["платново", "knitted"],
  ["платнена", "knitted"],
  ["платнени", "knitted"],
  ["платнен", "knitted"],
  ["часовници", "watches"],
  ["часовник", "watch"],
  ["нараквици", "bracelets"],
  ["нараквица", "bracelet"],
  ["паричници", "wallets"],
  ["паричник", "wallet"],
  ["ланчиња", "necklaces"],
  ["ланче", "necklace"],
  ["обетки", "earrings"],
  ["обетка", "earring"],
  ["шноли", "hair clips"],
  ["шнола", "hair clip"],
  ["чанти", "bags"],
  ["чанта", "bag"],
  ["прстени", "rings"],
  ["прстен", "ring"],
  ["ранци", "backpacks"],
  ["ранче", "backpack"],
  ["ранец", "backpack"],
  ["пеперутка", "butterfly"],
  ["формула", "formula"],
  ["женски", "women's"],
  ["мажки", "men's"],
  ["женско", "girls'"],
  ["машко", "boys'"],
  ["детски", "kids'"],
  ["златна", "gold"],
  ["сребрена", "silver"],
  ["бела", "white"],
  ["црна", "black"],
  ["црвена", "red"],
  ["плава", "blue"],
  ["зелена", "green"],
  ["жолта", "yellow"],
  ["портокалова", "orange"],
  ["розе", "pink"],
  ["розева", "pink"],
  ["виолетова", "purple"],
  ["сива", "gray"],
  [" со ", " with "],
];

const MK_TITLE_PHRASES = [...MK_TITLE_PHRASES_RAW].sort(
  (a, b) => b[0].length - a[0].length,
);

const EXACT_MK_TITLES: Record<string, string> = {
  венче: "Headband",
  венчиња: "Headbands",
  ранче: "Backpack",
  ранец: "Backpack",
};

function normalizeTitleKey(s: string): string {
  return s.trim().normalize("NFC").toLocaleLowerCase("mk-MK");
}

/** Gloss Macedonian catalog title to English on the client. */
export function glossMkProductTitleToEn(mkTitle: string): string {
  const trimmedRaw = mkTitle.trim();
  if (!trimmedRaw) return "";
  // Pre-pass: rewrite Latin glyphs sitting inside Cyrillic words ("Платновo"
  // with Latin `o`) to their Cyrillic twins so the dictionary still hits.
  const trimmed = normalizeCyrillicHomoglyphs(trimmedRaw);

  const exact = EXACT_MK_TITLES[normalizeTitleKey(trimmed)];
  if (exact) return exact;

  let s = trimmed;
  for (const [mk, en] of MK_TITLE_PHRASES) {
    s = s.replace(new RegExp(escapeRegExp(mk), "gi"), en);
  }
  s = s.replace(/(\s|^)со(\s|$)/gi, "$1with$2");

  return s.replace(/\s+/g, " ").trim();
}

/**
 * Default Macedonian copy auto-applied in the admin form when a product is
 * tagged as a women's bag. Exported so the runtime gloss map and the form
 * stay in lockstep — change one, both follow.
 */
export const WOMENS_HANDBAG_DEFAULT_DESCRIPTION_MK =
  "Изработена од висококвалитетна еко-кожа, оваа чанта доаѓа со дополнителна прилагодлива и отстранлива прерамка за на рамо. Совршен спој на елеганција и практичност за секој ден.";

export const WOMENS_HANDBAG_DEFAULT_DESCRIPTION_EN =
  "Crafted from high-quality eco-leather, this bag comes with an additional adjustable and detachable shoulder strap. A perfect blend of elegance and practicality for every day.";

/**
 * Men's counterpart — same construction as the women's default but with
 * style/utility wording ("стил и функционалност" instead of
 * "елеганција и практичност").
 */
export const MENS_HANDBAG_DEFAULT_DESCRIPTION_MK =
  "Изработена од висококвалитетна еко-кожа, оваа машка чанта доаѓа со прилагодлива и отстранлива прерамка за на рамо. Совршен спој на стил и функционалност за секој ден.";

export const MENS_HANDBAG_DEFAULT_DESCRIPTION_EN =
  "Crafted from high-quality eco-leather, this men's bag comes with an adjustable and detachable shoulder strap. A perfect blend of style and functionality for every day.";

/**
 * Longer Macedonian description phrases first so multi-word compounds win over
 * their single-word substrings (e.g. "паричник од еко кожа" before "паричник").
 * Lowercase-only; final output is sentence-cased.
 */
const MK_DESCRIPTION_PHRASES_RAW: [string, string][] = [
  [WOMENS_HANDBAG_DEFAULT_DESCRIPTION_MK, WOMENS_HANDBAG_DEFAULT_DESCRIPTION_EN],
  [MENS_HANDBAG_DEFAULT_DESCRIPTION_MK, MENS_HANDBAG_DEFAULT_DESCRIPTION_EN],
  ["совршен спој на стил и функционалност", "a perfect blend of style and functionality"],
  ["стил и функционалност", "style and functionality"],
  ["функционалност", "functionality"],
  ["машка чанта", "men's bag"],
  ["машка торба", "men's bag"],
  ["дополнителна прилагодлива и отстранлива прерамка за на рамо", "additional adjustable and detachable shoulder strap"],
  ["прилагодлива и отстранлива прерамка за на рамо", "adjustable and detachable shoulder strap"],
  ["дополнителна", "additional"],
  ["дополнителен", "additional"],
  ["дополнително", "additional"],
  ["висококвалитетна еко-кожа", "high-quality eco-leather"],
  ["висококвалитетна еко кожа", "high-quality eco-leather"],
  ["висококвалитетен", "high-quality"],
  ["висококвалитетна", "high-quality"],
  ["изработена од", "crafted from"],
  ["изработен од", "crafted from"],
  ["изработено од", "crafted from"],
  ["еко-кожа", "eco-leather"],
  ["прерамка за на рамо", "shoulder strap"],
  ["прерамка", "strap"],
  ["прилагодлива", "adjustable"],
  ["отстранлива", "detachable"],
  ["оваа чанта", "this bag"],
  ["оваа торба", "this bag"],
  ["совршен спој на елеганција и практичност", "a perfect blend of elegance and practicality"],
  ["совршен спој", "a perfect blend"],
  ["елеганција", "elegance"],
  ["практичност", "practicality"],
  ["за секој ден", "for every day"],
  ["паричник од еко кожа", "eco-leather wallet"],
  ["паричници од еко кожа", "eco-leather wallets"],
  ["паричник од кожа", "leather wallet"],
  ["паричници од кожа", "leather wallets"],
  ["кожен паричник", "leather wallet"],
  ["кожени паричници", "leather wallets"],
  ["чанта од еко кожа", "eco-leather bag"],
  ["чанти од еко кожа", "eco-leather bags"],
  ["чанта од кожа", "leather bag"],
  ["чанти од кожа", "leather bags"],
  ["кожена чанта", "leather bag"],
  ["кожени чанти", "leather bags"],
  ["ранец од еко кожа", "eco-leather backpack"],
  ["ранец од кожа", "leather backpack"],
  ["кожен ранец", "leather backpack"],
  ["од еко кожа", "made of eco-leather"],
  ["од кожа", "made of leather"],
  ["еко кожа", "eco-leather"],
  ["квалитетен материјал", "high-quality material"],
  ["квалитетен", "high-quality"],
  ["модерен додаток", "modern accessory"],
  ["паричници", "wallets"],
  ["паричник", "wallet"],
  ["часовници", "watches"],
  ["часовник", "watch"],
  ["нараквици", "bracelets"],
  ["нараквица", "bracelet"],
  ["ланчиња", "necklaces"],
  ["ланче", "necklace"],
  ["обетки", "earrings"],
  ["обетка", "earring"],
  ["шноли", "hair clips"],
  ["шнола", "hair clip"],
  ["платневи венчиња", "knitted headbands"],
  ["платново венче", "knitted headband"],
  ["венчиња", "headbands"],
  ["венче", "headband"],
  ["платново", "knitted"],
  ["платнена", "knitted"],
  ["платнени", "knitted"],
  ["платнен", "knitted"],
  ["чанти", "bags"],
  ["чанта", "bag"],
  ["прстени", "rings"],
  ["прстен", "ring"],
  ["ранци", "backpacks"],
  ["ранче", "backpack"],
  ["ранец", "backpack"],
  ["очила за сонце", "sunglasses"],
  ["пластична рамка", "plastic frame"],
  ["метална рамка", "metal frame"],
  ["кожен", "leather"],
  ["кожена", "leather"],
  ["кожено", "leather"],
  ["кожени", "leather"],
  ["златна", "gold"],
  ["сребрена", "silver"],
  ["бела", "white"],
  ["црна", "black"],
  ["црвена", "red"],
  ["плава", "blue"],
  ["зелена", "green"],
  ["жолта", "yellow"],
  ["портокалова", "orange"],
  ["розе", "pink"],
  ["розева", "pink"],
  ["виолетова", "purple"],
  ["сива", "gray"],
  ["женски", "women's"],
  ["мажки", "men's"],
  ["женско", "girls'"],
  ["машко", "boys'"],
  ["детски", "kids'"],
  [" со ", " with "],
];

const MK_DESCRIPTION_PHRASES = [...MK_DESCRIPTION_PHRASES_RAW].sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * Runtime gloss for product descriptions when the EN copy is missing from
 * Supabase. Mirrors `glossMkProductTitleToEn` but tuned for longer prose
 * (multi-word noun phrases, kept lowercase except the leading letter).
 */
export function glossMkDescriptionToEn(mkDescription: string): string {
  const trimmedRaw = mkDescription.trim();
  if (!trimmedRaw) return "";
  // Same Latin↔Cyrillic homoglyph cleanup as the title gloss.
  const trimmed = normalizeCyrillicHomoglyphs(trimmedRaw);

  let s = trimmed;
  for (const [mk, en] of MK_DESCRIPTION_PHRASES) {
    s = s.replace(new RegExp(escapeRegExp(mk), "gi"), en);
  }
  s = s.replace(/(\s|^)со(\s|$)/gi, "$1with$2");
  s = s.replace(/\s+/g, " ").trim();

  return capitalizeFirstLetter(s);
}

/**
 * Grid/detail title: EN uses `name_en` when set; otherwise glosses Macedonian `name`.
 * MK always uses `name`.
 */
export function resolveProductDisplayTitle(
  language: ProductDisplayLanguage,
  name: string,
  name_en?: string | null,
): string {
  const mkName = (name ?? "").trim();
  const enName =
    name_en === null || name_en === undefined ? "" : String(name_en).trim();

  if (language === "en") {
    if (enName) {
      // Pre-existing rows may have a saved "Knittedo …" style artifact from
      // before the homoglyph pre-pass shipped — scrub on render.
      return capitalizeFirstLetter(sanitizeEnglishProductCopy(enName));
    }
    const glossed = sanitizeEnglishProductCopy(
      glossMkProductTitleToEn(mkName),
    );
    return capitalizeFirstLetter(glossed || mkName);
  }

  return capitalizeFirstLetter(mkName || enName);
}

/** @deprecated Use `resolveProductDisplayTitle` — kept for cart/checkout imports. */
export function displayProductNameForLocale(
  language: ProductDisplayLanguage,
  name: string,
  name_en?: string | null,
): string {
  return resolveProductDisplayTitle(language, name, name_en);
}

/** Extract display amount from Supabase `price` (string or number). */
export function extractProductPriceAmount(
  raw: string | number | null | undefined,
): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }

  const original = String(raw).replace(/\u00a0/g, " ").trim();
  if (!original) return "";

  let amount = original
    .replace(/^\s*(ден\.?|den\.?|mkd)\s*/gi, "")
    .replace(/\s*(ден\.?|den\.?|mkd)\s*$/gi, "")
    .trim();

  if (amount && /[\d]/.test(amount)) return amount;

  const match = original.match(
    /\d{1,3}(?:[.\s]\d{3})+(?:[,.]\d+)?|\d+(?:[,.]\d+)?/,
  );
  if (match) return match[0].trim();

  return amount;
}

export function formatProductPriceWithCurrency(
  price: string | number | null | undefined,
  currencyLabel: string,
): string {
  const amount = extractProductPriceAmount(price);
  if (!amount) return "—";
  const suffix = currencyLabel.trim();
  return suffix ? `${amount} ${suffix}` : amount;
}

export type LocalizedProductFields = {
  name?: string | null;
  name_en?: string | null;
  name_mk?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_mk?: string | null;
  delivery_en?: string | null;
  delivery_mk?: string | null;
  category?: string | null;
  /**
   * Supabase `targetGroup` column (PG quoted identifier). Stored as a JSON array
   * of MK labels ("Жени" | "Мажи" | "Деца"), but legacy rows may carry a single
   * string or a stringified JSON array — `normalizeTargetGroupLabels` handles
   * all three shapes.
   */
  targetGroup?: unknown;
};

/**
 * Read an arbitrary `targetGroup` cell into a trimmed list of MK labels.
 * Mirrors `parseTargetGroupFromRow` in `app/market/page.tsx` so the helper
 * stays self-contained.
 */
export function normalizeTargetGroupLabels(raw: unknown): string[] {
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
        /* single string below */
      }
    }
    return [trimmed];
  }
  return [];
}

export type ColorSwatch = {
  hex?: string;
  name?: string;
  label?: string;
};

const HEADBAND_DESCRIPTION_MK =
  "Модерен додаток кој внесува елеганција во секоја фризура. Венче кое е изработено од квалитетен материјал кој не ја стега главата.";
const HEADBAND_DESCRIPTION_EN =
  "A modern accessory that brings elegance to every hairstyle. A headband made of high-quality material that does not pressure the head.";

function optString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed || null;
}

function pickLocalizedJsonValue(
  raw: unknown,
  language: ProductDisplayLanguage,
): string | null {
  const direct = optString(raw);
  if (direct) return direct;
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (language === "en") {
    return (
      optString(o.en) ??
      optString(o.EN) ??
      optString(o.english) ??
      optString(o.mk) ??
      optString(o.MK)
    );
  }
  return (
    optString(o.mk) ??
    optString(o.MK) ??
    optString(o.en) ??
    optString(o.EN)
  );
}

function localizedColorText(
  entry: Record<string, unknown>,
  language: ProductDisplayLanguage,
  field: "name" | "label",
): string | null {
  const enKey = field === "name" ? "name_en" : "label_en";
  const mkKey = field === "name" ? "name_mk" : "label_mk";
  const raw = entry[field];

  if (language === "en") {
    return (
      optString(entry[enKey]) ??
      pickLocalizedJsonValue(raw, language) ??
      optString(raw)
    );
  }
  return (
    optString(entry[mkKey]) ??
    pickLocalizedJsonValue(raw, language) ??
    optString(raw)
  );
}

export function localizedProductName(
  product: LocalizedProductFields,
  language: ProductDisplayLanguage,
): string {
  return resolveProductDisplayTitle(
    language,
    product?.name ?? "",
    product?.name_en,
  );
}

/**
 * MK label of the women's target group exactly as it sits in Supabase
 * `targetGroup` arrays — used by both the admin form and the catalog fallback.
 */
export const WOMEN_TARGET_GROUP_LABEL = "Жени";
export const MEN_TARGET_GROUP_LABEL = "Мажи";

/**
 * Strings to treat as "no description" when picking a fallback. Covers the
 * exact text saved on legacy Supabase rows where the placeholder was copied
 * into the column literally.
 */
const DEFAULT_PLACEHOLDER_DESCRIPTIONS: ReadonlyArray<string> = [
  "Нема достапен опис.",
  "No description available.",
];

function isPlaceholderDescription(
  value: string | null,
  extras: ReadonlyArray<string>,
): boolean {
  if (!value) return false;
  const norm = value.trim().toLocaleLowerCase("mk-MK");
  if (!norm) return false;
  const allPlaceholders = [...DEFAULT_PLACEHOLDER_DESCRIPTIONS, ...extras];
  return allPlaceholders.some(
    (placeholder) => placeholder.trim().toLocaleLowerCase("mk-MK") === norm,
  );
}

export function localizedProductDescription(
  product: LocalizedProductFields,
  language: ProductDisplayLanguage,
  options?: {
    headbandsLocaleLabel?: string;
    isHeadbandsProduct?: (
      product: LocalizedProductFields,
      headbandsLabel: string,
    ) => boolean;
    bagsLocaleLabel?: string;
    isBagsProduct?: (
      product: LocalizedProductFields,
      bagsLabel: string,
    ) => boolean;
    /**
     * Extra strings (on top of the canonical MK/EN placeholders) that should
     * be treated as missing description — lets callers feed in the active
     * locale's `productDetail.noDescription` so legacy DB rows with the
     * literal placeholder text still fall through to the default copy.
     */
    placeholderDescriptions?: ReadonlyArray<string>;
  },
): string | null {
  const placeholderExtras = options?.placeholderDescriptions ?? [];

  const pickIfReal = (raw: string | null | undefined): string | null => {
    const trimmed = raw?.trim() || null;
    if (!trimmed) return null;
    if (isPlaceholderDescription(trimmed, placeholderExtras)) return null;
    return trimmed;
  };

  const legacy = pickIfReal(product?.description);
  const mk = pickIfReal(product?.description_mk);
  const en = pickIfReal(product?.description_en);

  if (language === "en") {
    // Run the stray-`o` scrubber over whatever EN copy we hand back, whether
    // it came straight from Supabase or just out of the runtime gloss.
    if (en) return sanitizeEnglishProductCopy(en);
    // No dedicated EN copy in Supabase — gloss the Macedonian source so users
    // never see Cyrillic in English mode.
    const mkSource = mk || legacy;
    if (mkSource) {
      const glossed = sanitizeEnglishProductCopy(
        glossMkDescriptionToEn(mkSource),
      );
      if (glossed) return glossed;
    }
  } else {
    // Run the MK sanitizer over whatever DB copy we picked so stray English
    // nouns admins left behind ("Sunglasses with пластична рамка") render
    // properly. The Cyrillic-presence guard inside the helper makes it a
    // no-op for the rare pure-EN fallback case.
    const fromDb = mk || legacy || en;
    if (fromDb) return sanitizeMacedonianProductCopy(fromDb);
  }

  const headbandsLabel = options?.headbandsLocaleLabel ?? "";
  const isHeadbands =
    options?.isHeadbandsProduct?.(product, headbandsLabel) ?? false;
  if (isHeadbands) {
    return language === "en" ? HEADBAND_DESCRIPTION_EN : HEADBAND_DESCRIPTION_MK;
  }

  const bagsLabel = options?.bagsLocaleLabel ?? "";
  const isBags =
    options?.isBagsProduct?.(product, bagsLabel) ?? false;
  if (isBags) {
    const targetGroups = normalizeTargetGroupLabels(product?.targetGroup);
    if (targetGroups.includes(WOMEN_TARGET_GROUP_LABEL)) {
      return language === "en"
        ? WOMENS_HANDBAG_DEFAULT_DESCRIPTION_EN
        : WOMENS_HANDBAG_DEFAULT_DESCRIPTION_MK;
    }
    if (targetGroups.includes(MEN_TARGET_GROUP_LABEL)) {
      return language === "en"
        ? MENS_HANDBAG_DEFAULT_DESCRIPTION_EN
        : MENS_HANDBAG_DEFAULT_DESCRIPTION_MK;
    }
  }

  return null;
}

export function localizedProductDelivery(
  product: LocalizedProductFields,
  language: ProductDisplayLanguage,
  localeFallback: string,
): string {
  const en = product?.delivery_en?.trim();
  const mk = product?.delivery_mk?.trim();
  if (language === "en") {
    return en || mk || localeFallback;
  }
  return mk || en || localeFallback;
}

export function normalizeProductColors(
  raw: unknown,
  language: ProductDisplayLanguage,
): ColorSwatch[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: ColorSwatch[] = [];

  for (const entry of raw) {
    if (typeof entry === "string") {
      const t = entry.trim();
      if (!t) continue;
      const h = t.startsWith("#") ? t : `#${t}`;
      if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h)) {
        out.push({ hex: h });
      } else {
        out.push({ name: t });
      }
      continue;
    }

    if (typeof entry === "object" && entry !== null) {
      const obj = entry as Record<string, unknown>;
      const hexRaw = obj.hex;
      const localizedName = localizedColorText(obj, language, "name");
      const localizedLabel = localizedColorText(obj, language, "label");
      const displayLabel = localizedLabel ?? localizedName;

      if (typeof hexRaw === "string" && hexRaw.trim()) {
        const h = hexRaw.trim().startsWith("#")
          ? hexRaw.trim()
          : `#${hexRaw.trim()}`;
        if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h)) {
          out.push(
            displayLabel
              ? { hex: h, label: displayLabel, name: localizedName ?? undefined }
              : { hex: h },
          );
        }
        continue;
      }

      if (localizedName) {
        out.push({ name: localizedName, label: localizedLabel ?? undefined });
        continue;
      }
      if (localizedLabel) {
        out.push({ name: localizedLabel });
      }
    }
  }

  return out.length ? out : null;
}
