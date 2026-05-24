"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  fetchOrderedProducts,
  isMissingSortOrderColumn,
} from "@/lib/supabase/fetch-products";
import { writeStoredProductOrder } from "@/lib/supabase/product-order";
import { cn } from "@/lib/utils";
import {
  collectAvailableColorsForProducts,
  productMatchesColorFilter,
  type CategoryValue,
  type ColorFilter,
} from "@/app/market/_components/category-filter";
import {
  MENS_HANDBAG_DEFAULT_DESCRIPTION_MK,
  WOMENS_HANDBAG_DEFAULT_DESCRIPTION_MK,
} from "@/lib/product-localization";

/** Macedonian label for the bag category (matches `locales/mk.json` → `categories.bag`). */
const BAGS_CATEGORY_MK_LABEL = "Чанти";
const WOMEN_TARGET_GROUP_MK_LABEL = "Жени" as const;
const MEN_TARGET_GROUP_MK_LABEL = "Мажи" as const;

/**
 * Category dropdown options for the admin form. Keys match `PRODUCT_CATEGORIES`
 * slugs from `category-filter.tsx`; labels are the Macedonian translations from
 * `locales/mk.json` → `categories.*` so the admin UX stays Cyrillic.
 *
 * The `label` is also the value persisted on Supabase `products.category`,
 * matching how `resolveStoredCategoryToFilterValue` already accepts MK labels.
 */
const CATEGORY_OPTIONS: ReadonlyArray<{ slug: CategoryValue; label: string }> = [
  { slug: "bag", label: BAGS_CATEGORY_MK_LABEL },
  { slug: "watches", label: "Часовници" },
  { slug: "headbands", label: "Венчиња" },
  { slug: "shnoli", label: "Шноли" },
  { slug: "earrings", label: "Обетки" },
  { slug: "bracelets", label: "Нараквици" },
  { slug: "wallets", label: "Паричници" },
  { slug: "rings", label: "Прстени" },
  { slug: "backpacks", label: "Ранци" },
  { slug: "necklaces", label: "Ланчиња" },
  { slug: "sunglasses", label: "Очила за сонце" },
];

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const BUCKET = "product-images";

type ProductRow = {
  id: number;
  name: string;
  price: string | null;
  image: string | null;
  description: string | null;
  dimensions: string | null;
  colors: unknown;
  sort_order?: number | null;
  /** PostgreSQL quoted identifier `"targetGroup"` — same key in Supabase client. */
  targetGroup?: string[] | string | null;
};

const fieldClass =
  "border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600";

type ProductColorEntry = { name?: string; hex?: string };

type UpdateProductPayload = {
  name: string;
  price: string | null;
  image: string | null;
  description: string | null;
  dimensions: string | null;
  colors: ProductColorEntry[] | null;
  targetGroup: string[];
};

/** Stored in Supabase `targetGroup` and used in checkbox state (Cyrillic labels). */
const TARGET_GROUP_OPTIONS = ["Жени", "Мажи", "Деца"] as const;

const TARGET_GROUP_CHECKBOX_IDS = ["women", "men", "kids"] as const;

type TargetGroupOption = (typeof TARGET_GROUP_OPTIONS)[number];

function normalizeTargetGroupArray(value: ProductRow["targetGroup"]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean);
        }
      } catch {
        // Single string value below.
      }
    }
    return [trimmed];
  }
  return [];
}

function nextTargetGroupsAfterToggle(
  prev: string[],
  option: TargetGroupOption,
  checked: boolean,
): string[] {
  if (checked) {
    return prev.includes(option) ? prev : [...prev, option];
  }
  return prev.filter((value) => value !== option);
}

function parseImageUrlsInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function imageFieldToInputString(image: string | null): string {
  if (!image) return "";
  const trimmed = image.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
          .join("\n");
      }
    } catch {
      // Fallback to plain text handling below.
    }
  }
  return trimmed;
}

function imageFieldToUrlList(image: string | null): string[] {
  const parsed = parseImageUrlsInput(imageFieldToInputString(image));
  return parsed;
}

function imageFieldToPreviewSrc(image: string | null): string | null {
  const list = parseImageUrlsInput(imageFieldToInputString(image));
  return list[0] ?? null;
}

function serializeImageUrls(urls: string[]): string | null {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  return JSON.stringify(urls);
}

/** Row payload for `products` insert; `targetGroup` matches quoted PG column `"targetGroup"`. */
function toProductsInsertRow(input: {
  name: string;
  price: string | null;
  image: string | null;
  description: string | null;
  dimensions: string | null;
  colors: ProductColorEntry[] | null;
  targetGroup: string[];
  category: string | null;
  sort_order: number;
}) {
  return {
    name: input.name,
    price: input.price,
    image: input.image,
    description: input.description,
    dimensions: input.dimensions,
    colors: input.colors,
    targetGroup: input.targetGroup,
    category: input.category,
    sort_order: input.sort_order,
  };
}

function filterProductsForAdminList(
  products: ProductRow[],
  searchQuery: string,
  colorFilter: ColorFilter,
): ProductRow[] {
  const q = searchQuery.trim().toLowerCase();
  const matched = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : products;
  if (colorFilter === "all") return matched;
  return matched.filter((p) => productMatchesColorFilter(p.colors, colorFilter));
}

/** Reorder visible cards while keeping hidden (filtered-out) products in place. */
function reorderProductsPreservingHidden(
  products: ProductRow[],
  visible: ProductRow[],
  activeId: number,
  overId: number,
): ProductRow[] {
  const oldIndex = visible.findIndex((p) => p.id === activeId);
  const newIndex = visible.findIndex((p) => p.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return products;
  const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
  const visibleIds = new Set(visible.map((p) => p.id));
  let visibleIndex = 0;
  return products.map((product) => {
    if (!visibleIds.has(product.id)) return product;
    return reorderedVisible[visibleIndex++] ?? product;
  });
}

/** Highest `id` first — always used on fetch before any UI display. */
function sortProductsByIdDescending<T extends { id: number }>(products: T[]): T[] {
  return [...products].sort((a, b) => b.id - a.id);
}

/** Index in array → `sort_order` (0 = position badge #1). */
function withSequentialSortOrder(products: ProductRow[]): ProductRow[] {
  return products.map((product, index) => ({
    ...product,
    sort_order: index,
  }));
}

function parseHexToken(part: string): string | null {
  const t = part.trim();
  if (!t) return null;
  const h = t.startsWith("#") ? t : `#${t}`;
  if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(h)) {
    return h;
  }
  return null;
}

/** Comma-separated color names (e.g. "Bela, Crna, Zlatna") or hex codes (#RGB / #RRGGBB). */
function parseColorsInput(s: string): ProductColorEntry[] | null {
  const t = s.trim();
  if (!t) return null;
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  const out: ProductColorEntry[] = [];
  for (const part of parts) {
    const hex = parseHexToken(part);
    if (hex) {
      out.push({ hex });
    } else {
      out.push({ name: part });
    }
  }
  return out.length ? out : null;
}

/** Title-cases the normalized color token from `collectAvailableColorsForProducts`. */
function formatAdminColorLabel(token: string): string {
  if (!token) return token;
  if (token.startsWith("#")) return token.toUpperCase();
  return token.charAt(0).toLocaleUpperCase("mk-MK") + token.slice(1);
}

function colorsToInputString(colors: unknown): string {
  if (colors == null || !Array.isArray(colors)) return "";
  const parts: string[] = [];
  for (const o of colors) {
    if (typeof o === "string") {
      parts.push(o.trim());
      continue;
    }
    if (typeof o === "object" && o !== null) {
      const name =
        "name" in o && typeof (o as { name: unknown }).name === "string"
          ? (o as { name: string }).name.trim()
          : "";
      const hex =
        "hex" in o && typeof (o as { hex: unknown }).hex === "string"
          ? (o as { hex: string }).hex.trim()
          : "";
      if (name) {
        parts.push(name);
      } else if (hex) {
        parts.push(hex);
      }
    }
  }
  return parts.join(", ");
}

type ImageDragData = { type: "image"; productId: number };

const PRODUCT_DRAG_MIME = "application/x-oscar-product-id";

function productImageSortableId(
  productId: number,
  url: string,
  index: number,
): string {
  return `image::${productId}::${index}::${url}`;
}

function isProductDragHandleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-product-drag-handle]"));
}

type ImageDragHandler = (event: DragEndEvent) => void;

function SortableImageTile({
  id,
  productId,
  url,
  index,
  onRemove,
}: {
  id: string;
  productId: number;
  url: string;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      data: { type: "image", productId } satisfies ImageDragData,
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="relative"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-md bg-[#f2f2f2] touch-none"
        {...attributes}
        {...listeners}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`Слика ${index + 1}`}
          className="absolute inset-0 m-auto h-full w-full max-h-full max-w-full object-contain object-center"
        />
        {index === 0 ? (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-zinc-50">
            ГЛАВНА
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/85 text-zinc-50 transition-opacity hover:opacity-90"
          aria-label={`Отстрани слика ${index + 1}`}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ProductEditCard({
  product,
  displayIndex,
  deletingId,
  draggedProductId,
  dropTargetProductId,
  onProductDragStart,
  onProductDragEnd,
  onProductDragEnter,
  onProductDrop,
  onDelete,
  onSave,
  registerImageDragHandler,
  unregisterImageDragHandler,
}: {
  product: ProductRow;
  displayIndex: number;
  deletingId: number | null;
  draggedProductId: number | null;
  dropTargetProductId: number | null;
  onProductDragStart: (productId: number) => void;
  onProductDragEnd: () => void;
  onProductDragEnter: (productId: number) => void;
  onProductDrop: (targetProductId: number) => void;
  onDelete: (id: number) => void;
  onSave: (id: number, payload: UpdateProductPayload) => Promise<void>;
  registerImageDragHandler: (
    productId: number,
    handler: ImageDragHandler,
  ) => void;
  unregisterImageDragHandler: (productId: number) => void;
}) {
  const priceToString = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return typeof value === "string" ? value : String(value);
  };

  const [cardName, setCardName] = useState(product.name);
  const [cardPrice, setCardPrice] = useState<string>(
    priceToString(product.price),
  );
  const [cardImageUrls, setCardImageUrls] = useState<string[]>(
    imageFieldToUrlList(product.image),
  );
  const [cardDescription, setCardDescription] = useState(
    product.description ?? "",
  );
  const [cardDimensions, setCardDimensions] = useState(
    product.dimensions ?? "",
  );
  const [cardColorsInput, setCardColorsInput] = useState(
    colorsToInputString(product.colors),
  );
  const [cardTargetGroups, setCardTargetGroups] = useState<string[]>(
    normalizeTargetGroupArray(product.targetGroup),
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  useEffect(() => {
    setCardName(product.name);
    setCardPrice(priceToString(product.price));
    setCardImageUrls(imageFieldToUrlList(product.image));
    setCardDescription(product.description ?? "");
    setCardDimensions(product.dimensions ?? "");
    setCardColorsInput(colorsToInputString(product.colors));
    setCardTargetGroups(normalizeTargetGroupArray(product.targetGroup));
    setCardError(null);
  }, [
    product.id,
    product.name,
    product.price,
    product.image,
    product.description,
    product.dimensions,
    product.colors,
    product.targetGroup,
  ]);

  const handleSave = async () => {
    setCardError(null);
    setSaving(true);

    try {
      const payload: UpdateProductPayload = {
        name: cardName.trim(),
        price: cardPrice.trim() || null,
        image: serializeImageUrls(cardImageUrls.map((url) => url.trim()).filter(Boolean)),
        description: cardDescription.trim() || null,
        dimensions: cardDimensions.trim() || null,
        colors: parseColorsInput(cardColorsInput),
        targetGroup: cardTargetGroups,
      };

      if (!payload.name) {
        throw new Error("Името е задолжително.");
      }
      if (payload.targetGroup.length === 0) {
        throw new Error("Изберете барем една целна група.");
      }

      await onSave(product.id, payload);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Настана грешка.");
    } finally {
      setSaving(false);
    }
  };

  const addImageUrlInput = () => {
    cardFileInputRef.current?.click();
  };

  const removeImageUrlAt = (index: number) => {
    setCardImageUrls((prev) => {
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadCardFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setCardError(null);
    setUploadingImages(true);

    const supabase = createClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`"${file.name}" е поголема од 6 MB.`);
        }

        const ext = file.name.split(".").pop() || "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);
        uploadedUrls.push(publicData.publicUrl);
      }

      if (uploadedUrls.length > 0) {
        setCardImageUrls((prev) => [...prev, ...uploadedUrls]);
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Настана грешка.");
    } finally {
      setUploadingImages(false);
      if (cardFileInputRef.current) {
        cardFileInputRef.current.value = "";
      }
    }
  };

  const handleCardFileInput = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    await uploadCardFiles(Array.from(e.target.files ?? []));
  };

  const handleCardDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await uploadCardFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleImageDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setCardImageUrls((prev) => {
        const ids = prev.map((url, index) =>
          productImageSortableId(product.id, url, index),
        );
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [product.id],
  );

  useEffect(() => {
    registerImageDragHandler(product.id, handleImageDragEnd);
    return () => unregisterImageDragHandler(product.id);
  }, [
    product.id,
    handleImageDragEnd,
    registerImageDragHandler,
    unregisterImageDragHandler,
  ]);

  const toggleCardTargetGroup = (option: string, checked: boolean) => {
    setCardTargetGroups((prev) => {
      if (checked) return prev.includes(option) ? prev : [...prev, option];
      return prev.filter((value) => value !== option);
    });
  };

  const isDraggingProduct = draggedProductId === product.id;
  const isDropTarget =
    dropTargetProductId === product.id && draggedProductId !== product.id;

  return (
    <li
      draggable
      onDragStart={(event) => {
        if (!isProductDragHandleTarget(event.target)) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(PRODUCT_DRAG_MIME, String(product.id));
        event.dataTransfer.effectAllowed = "move";
        onProductDragStart(product.id);
      }}
      onDragEnd={onProductDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onProductDragEnter(product.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onProductDrop(product.id);
      }}
      className={cn(
        "flex h-fit w-full min-w-0 self-start flex-col overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/50 shadow-sm",
        isDraggingProduct && "z-20 opacity-50 shadow-lg",
        isDropTarget && "z-10 ring-2 ring-zinc-400",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${cardName || product.name || "Производ"} — ${isExpanded ? "затвори" : "отвори"} уредување`}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className="relative aspect-square w-full cursor-pointer overflow-hidden bg-[#f2f2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
      >
        <span
          data-product-drag-handle
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute left-2 top-2 z-20 inline-flex cursor-grab items-center gap-1 rounded-md bg-zinc-900/90 px-2 py-1 text-xs font-medium text-zinc-50 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5 shrink-0 opacity-80" aria-hidden />
          Повлечи
        </span>
        <span className="pointer-events-none absolute right-2 top-2 z-20 inline-flex min-h-7 min-w-7 items-center justify-center rounded-md bg-zinc-900/90 px-2 text-xs font-medium text-zinc-50">
          {displayIndex}
        </span>
        <span
          className="pointer-events-none absolute bottom-2 right-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900/90 text-zinc-50"
          aria-hidden
        >
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </span>
        {(cardImageUrls[0] ?? imageFieldToPreviewSrc(product.image)) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardImageUrls[0] ?? imageFieldToPreviewSrc(product.image) ?? ""}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 m-auto h-full w-full max-h-full max-w-full select-none object-contain object-center"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
            —
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-zinc-800/80 p-2 sm:p-4">
        <div className="grid gap-2">
          <Label
            htmlFor={`product-card-name-${product.id}`}
            className="text-zinc-300"
          >
            Име
          </Label>
          <Input
            id={`product-card-name-${product.id}`}
            required
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            data-no-product-drag
            placeholder="пример: Bag to Bag..."
            className={cn(fieldClass, "h-8 w-full text-sm")}
          />
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`product-card-price-${product.id}`}
            className="text-zinc-300"
          >
            Цена (МКD)
          </Label>
          <Input
            id={`product-card-price-${product.id}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={cardPrice}
            onChange={(e) => setCardPrice(e.target.value.replace(/\D/g, ""))}
            data-no-product-drag
            placeholder="0"
            className={cn(fieldClass, "h-8 w-full text-sm")}
          />
        </div>

        <div className="grid gap-3" data-no-product-drag>
          <Label className="text-zinc-300">Слики (главна + дополнителни)</Label>
          <input
            ref={cardFileInputRef}
            id={`product-card-image-file-${product.id}`}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void handleCardFileInput(e);
            }}
          />
          <div
            className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center text-sm text-zinc-400"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              void handleCardDrop(e);
            }}
          >
            Повлечи и пушти слики тука или кликни „Додади слика“.
          </div>
          {cardImageUrls.length > 0 ? (
            <SortableContext
              items={cardImageUrls.map((url, index) =>
                productImageSortableId(product.id, url, index),
              )}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cardImageUrls.map((url, index) => (
                  <SortableImageTile
                    key={productImageSortableId(product.id, url, index)}
                    id={productImageSortableId(product.id, url, index)}
                    productId={product.id}
                    url={url}
                    index={index}
                    onRemove={() => removeImageUrlAt(index)}
                  />
                ))}
              </div>
            </SortableContext>
          ) : (
            <p className="text-xs text-zinc-500">Нема додадени слики.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addImageUrlInput}
              disabled={uploadingImages}
              className="w-fit border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <Plus className="size-4" aria-hidden />
              {uploadingImages ? "Се прикачува..." : "Додади слика"}
            </Button>
            <p className="text-xs text-zinc-500">Максимална големина 6 MB по слика.</p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`product-card-description-${product.id}`}
            className="text-zinc-300"
          >
            Опис
          </Label>
          <textarea
            id={`product-card-description-${product.id}`}
            value={cardDescription}
            onChange={(e) => setCardDescription(e.target.value)}
            data-no-product-drag
            placeholder="Краток опис..."
            rows={3}
            className={cn(
              "flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fieldClass,
            )}
          />
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`product-card-dimensions-${product.id}`}
            className="text-zinc-300"
          >
            Димензии (опционално)
          </Label>
          <textarea
            id={`product-card-dimensions-${product.id}`}
            value={cardDimensions}
            onChange={(e) => setCardDimensions(e.target.value)}
            data-no-product-drag
            placeholder="На пр. 24 × 18 × 6 cm"
            rows={2}
            className={cn(
              "flex min-h-[56px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
              fieldClass,
            )}
          />
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={`product-card-colors-${product.id}`}
            className="text-zinc-300"
          >
            Бои (опционално, одделени со запирка)
          </Label>
          <Input
            id={`product-card-colors-${product.id}`}
            type="text"
            value={cardColorsInput}
            onChange={(e) => setCardColorsInput(e.target.value)}
            data-no-product-drag
            placeholder="Бела, Црна, Златна"
            className={cn(fieldClass, "h-8 w-full text-sm")}
          />
        </div>

        <div className="grid gap-2" data-no-product-drag>
          <Label className="text-zinc-300">Целна група</Label>
          <div className="grid gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 p-3">
            {TARGET_GROUP_CHECKBOX_IDS.map((checkboxId, index) => {
              const option = TARGET_GROUP_OPTIONS[index];
              return (
                <div
                  key={checkboxId}
                  className="flex items-center gap-2 text-sm text-zinc-200"
                >
                  <input
                    id={`product-card-target-group-${product.id}-${checkboxId}`}
                    type="checkbox"
                    checked={cardTargetGroups.includes(option)}
                    onChange={(e) =>
                      setCardTargetGroups((prev) =>
                        nextTargetGroupsAfterToggle(
                          prev,
                          option,
                          e.target.checked,
                        ),
                      )
                    }
                    className="size-4 rounded border-zinc-600 bg-zinc-900 text-zinc-100"
                  />
                  <Label
                    htmlFor={`product-card-target-group-${product.id}-${checkboxId}`}
                    className="cursor-pointer font-normal text-zinc-200"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        {cardError && (
          <p className="text-sm text-red-400" role="alert">
            {cardError}
          </p>
        )}

        <div className="mt-auto flex gap-2" data-no-product-drag>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1 bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Save…
              </>
            ) : (
              "Зачувај"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={deletingId === product.id}
            className="flex-1 border-red-900/60 bg-transparent text-red-400 hover:bg-red-950/50 hover:text-red-300"
            onClick={() => onDelete(product.id)}
          >
            {deletingId === product.id ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Избриши"
            )}
          </Button>
        </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function AddProductForm() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [colorsInput, setColorsInput] = useState("");
  const [targetGroups, setTargetGroups] = useState<string[]>([]);
  /** Selected category MK label (e.g. "Чанти"). Empty string = none selected. */
  const [category, setCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reorderingProducts, setReorderingProducts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const productListSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  /** Products matching the search text only — the basis for the color dropdown options. */
  const searchMatchedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const availableColors = useMemo(
    () => collectAvailableColorsForProducts(searchMatchedProducts),
    [searchMatchedProducts],
  );

  /** Reset the color when it no longer applies to the current search results. */
  useEffect(() => {
    if (colorFilter !== "all" && !availableColors.includes(colorFilter)) {
      setColorFilter("all");
    }
  }, [availableColors, colorFilter]);

  const filteredProducts = useMemo(
    () => filterProductsForAdminList(products, searchQuery, colorFilter),
    [products, searchQuery, colorFilter],
  );

  const imagePreviewUrls = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles],
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  const sortOrderSupportedRef = useRef(true);

  const loadProducts = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchError, sortOrderSupported } =
      await fetchOrderedProducts<ProductRow>(supabase, {
        select:
          "id, name, price, image, description, dimensions, colors, targetGroup, sort_order",
        idAscending: false,
      });

    sortOrderSupportedRef.current = sortOrderSupported;

    if (fetchError) {
      setListError(fetchError.message);
    } else {
      const list = withSequentialSortOrder(
        sortProductsByIdDescending(data ?? []),
      );
      setListError(null);
      setProducts(list);
    }
    setListLoading(false);
  }, []);

  const persistProductSortOrder = useCallback(
    async (ordered: ProductRow[]) => {
      writeStoredProductOrder(ordered.map((product) => product.id));

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setListError("Сесијата истече. Најавете се повторно.");
        return false;
      }

      const sequential = withSequentialSortOrder(ordered);

      const updates = await Promise.all(
        sequential.map((product) =>
          supabase
            .from("products")
            .update({ sort_order: product.sort_order })
            .eq("id", product.id),
        ),
      );

      const failed = updates.find((result) => result.error);
      if (failed?.error) {
        if (isMissingSortOrderColumn(failed.error)) {
          setListError(
            "Редоследот е зачуван локално. За трајно зачувување, пушти ја миграцијата sort_order во Supabase.",
          );
          return true;
        }
        setListError(failed.error.message);
        return false;
      }

      setListError(null);
      return true;
    },
    [],
  );

  const imageDragHandlersRef = useRef<Map<number, ImageDragHandler>>(new Map());

  const registerImageDragHandler = useCallback(
    (productId: number, handler: ImageDragHandler) => {
      imageDragHandlersRef.current.set(productId, handler);
    },
    [],
  );

  const unregisterImageDragHandler = useCallback((productId: number) => {
    imageDragHandlersRef.current.delete(productId);
  }, []);

  const [draggedProductId, setDraggedProductId] = useState<number | null>(null);
  const [dropTargetProductId, setDropTargetProductId] = useState<number | null>(
    null,
  );

  const reorderProductsByIds = useCallback(
    (sourceId: number, targetId: number) => {
      if (sourceId === targetId) return;

      setProducts((prev) => {
        const visible = filterProductsForAdminList(
          prev,
          searchQuery,
          colorFilter,
        );
        const next = reorderProductsPreservingHidden(
          prev,
          visible,
          sourceId,
          targetId,
        );
        if (next === prev) return prev;

        setReorderingProducts(true);
        void (async () => {
          const ok = await persistProductSortOrder(next);
          if (!ok) {
            await loadProducts();
          }
          setReorderingProducts(false);
        })();

        return withSequentialSortOrder(next);
      });
    },
    [colorFilter, persistProductSortOrder, searchQuery, loadProducts],
  );

  const handleProductDrop = useCallback(
    (targetId: number) => {
      const sourceId = draggedProductId;
      setDraggedProductId(null);
      setDropTargetProductId(null);
      if (sourceId == null) return;
      reorderProductsByIds(sourceId, targetId);
    },
    [draggedProductId, reorderProductsByIds],
  );

  const handleImageListDragEnd = useCallback((event: DragEndEvent) => {
    const productId = event.active.data.current?.productId as number | undefined;
    if (productId != null) {
      imageDragHandlersRef.current.get(productId)?.(event);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  /**
   * Auto-fill the description with the canonical women's handbag copy as soon
   * as the admin picks `Чанти` from the category dropdown and ticks `Жени`.
   * Guarded by the empty-description check so manually entered copy is never
   * overwritten; `description` is intentionally excluded from deps so that
   * clearing the field after a fill doesn't trigger another fill.
   */
  useEffect(() => {
    if (description.trim()) return;
    if (category !== BAGS_CATEGORY_MK_LABEL) return;
    if (!targetGroups.includes(WOMEN_TARGET_GROUP_MK_LABEL)) return;
    setDescription(WOMENS_HANDBAG_DEFAULT_DESCRIPTION_MK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, targetGroups]);

  /**
   * Mirror of the women's effect, but for `Мажи` + Чанти. Defers to the
   * women's default when both target groups are selected so the two effects
   * don't race over the same state.
   */
  useEffect(() => {
    if (description.trim()) return;
    if (category !== BAGS_CATEGORY_MK_LABEL) return;
    if (!targetGroups.includes(MEN_TARGET_GROUP_MK_LABEL)) return;
    if (targetGroups.includes(WOMEN_TARGET_GROUP_MK_LABEL)) return;
    setDescription(MENS_HANDBAG_DEFAULT_DESCRIPTION_MK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, targetGroups]);

  const resetForm = () => {
    setName("");
    setPrice("");
    setImageFiles([]);
    setDescription("");
    setDimensions("");
    setColorsInput("");
    setTargetGroups([]);
    setCategory("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (targetGroups.length === 0) {
      setFormError("Изберете барем една целна група.");
      return;
    }

    for (const file of imageFiles) {
      if (file.size > MAX_FILE_BYTES) {
        setFormError(`"${file.name}" е поголема од 6 MB.`);
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const uploadedImageUrls: string[] = [];

      for (const file of imageFiles) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);

        uploadedImageUrls.push(publicData.publicUrl);
      }

      const priceValue = price.trim() || null;

      const insertRow = toProductsInsertRow({
        name: name.trim(),
        price: priceValue,
        image: serializeImageUrls(uploadedImageUrls),
        description: description.trim() || null,
        dimensions: dimensions.trim() || null,
        colors: parseColorsInput(colorsInput),
        targetGroup: targetGroups,
        category: category.trim() || null,
        sort_order: 0,
      });

      const productSelect =
        "id, name, price, image, description, dimensions, colors, targetGroup, sort_order";

      const insertWithSort = await supabase
        .from("products")
        .insert(insertRow)
        .select(productSelect)
        .single();

      let inserted = insertWithSort.data as ProductRow | null;
      let insertError = insertWithSort.error;

      if (insertError && isMissingSortOrderColumn(insertError)) {
        const { sort_order: _sortOrder, ...rowWithoutSort } = insertRow;
        const insertWithoutSort = await supabase
          .from("products")
          .insert(rowWithoutSort)
          .select(
            "id, name, price, image, description, dimensions, colors, targetGroup",
          )
          .single();
        inserted = insertWithoutSort.data as ProductRow | null;
        insertError = insertWithoutSort.error;
        sortOrderSupportedRef.current = false;
      }

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (!inserted) {
        throw new Error("Производот е зачуван, но не можеше да се вчита.");
      }

      const nextOrder = withSequentialSortOrder([inserted, ...products]);
      setProducts(nextOrder);
      writeStoredProductOrder(nextOrder.map((product) => product.id));

      if (sortOrderSupportedRef.current) {
        const persisted = await persistProductSortOrder(nextOrder);
        if (!persisted) {
          await loadProducts();
        }
      }

      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Настана грешка.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Да се избрише овој производ?")) {
      return;
    }
    setListError(null);
    setDeletingId(id);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setListError("Сесијата истече. Најавете се повторно.");
      setDeletingId(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setListError(deleteError.message);
      setDeletingId(null);
      return;
    }

    await loadProducts();
    setDeletingId(null);
  };

  const handleUpdate = async (id: number, payload: UpdateProductPayload) => {
    setListError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const message = "Сесијата истече. Најавете се повторно.";
      setListError(message);
      throw new Error(message);
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({
        name: payload.name.trim(),
        price: payload.price,
        image: payload.image,
        description: payload.description,
        dimensions: payload.dimensions,
        colors: payload.colors,
        targetGroup: payload.targetGroup,
      })
      .eq("id", id);

    if (updateError) {
      setListError(updateError.message);
      throw new Error(updateError.message);
    }

    await loadProducts();
  };

  const toggleTargetGroup = (option: string, checked: boolean) => {
    setTargetGroups((prev) => {
      if (checked) {
        return prev.includes(option) ? prev : [...prev, option];
      }
      return prev.filter((value) => value !== option);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-1 py-8 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className={cn(
          "rounded-xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-sm",
          "text-zinc-100",
        )}
      >
        <h2 className="mb-6 text-lg font-semibold tracking-tight text-zinc-50">
          Нов производ
        </h2>

        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <Label htmlFor="product-name" className="text-zinc-300">
              Име
            </Label>
            <Input
              id="product-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="пример: Bag to Bag..."
              className={fieldClass}
            />
          </div>

          {/*
            The "Категорија" dropdown is intentionally hidden from the admin
            UI: the storefront's related-products slider classifies products
            by name keywords (see `detectProductNameGroup` in
            `app/market/[id]/product-page-client.tsx`), so the column isn't
            required for that surface anymore. The `category` state,
            `CATEGORY_OPTIONS`, the bag-description auto-fill effects, and
            the `category` field in the Supabase payload are all kept so
            existing rows / other consumers (market grid filter, headband /
            bag description fallback) keep working — new rows simply persist
            `category: null` since the state stays at the empty-string
            default. Re-render this block to bring the picker back.
          */}

          <div className="grid gap-2">
            <Label htmlFor="product-price" className="text-zinc-300">
              Цена (MKD)
            </Label>
            <Input
              id="product-price"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value.replace(/\D/g, ""))
              }
              placeholder="0"
              className={fieldClass}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-image-file" className="text-zinc-300">
              Слики
            </Label>
            <input
              ref={fileInputRef}
              id="product-image-file"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
              className="sr-only"
              tabIndex={-1}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-fit border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50"
              >
                Прикачи слики
              </Button>
              <span className="text-sm text-zinc-400">
                {imageFiles.length > 0
                  ? `${imageFiles.length} избрани слики`
                  : "Нема избрани слики"}
              </span>
            </div>
            {imageFiles.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {imagePreviewUrls.map((previewUrl, index) => (
                  <li key={previewUrl} className="space-y-1">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#f2f2f2]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={`Preview ${index + 1}`}
                        className="max-h-full max-w-full object-contain object-center"
                      />
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      {imageFiles[index]?.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-500">
              Максимална големина 6 MB по слика
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-description" className="text-zinc-300">
              Опис
            </Label>
            <textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краток опис..."
              rows={4}
              className={cn(
                "flex min-h-[100px] w-full rounded-md border px-3 py-2 text-base shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
                "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                fieldClass,
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-dimensions" className="text-zinc-300">
              Димензии (опционално)
            </Label>
            <textarea
              id="product-dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="На пр. 24 × 18 × 6 cm"
              rows={2}
              className={cn(
                "flex min-h-[56px] w-full rounded-md border px-3 py-2 text-base shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
                "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                fieldClass,
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-colors" className="text-zinc-300">
              Бои (опционално, одделени со запирка)
            </Label>
            <Input
              id="product-colors"
              type="text"
              value={colorsInput}
              onChange={(e) => setColorsInput(e.target.value)}
              placeholder="Бела, Црна, Златна"
              className={fieldClass}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-zinc-300">Целна група</Label>
            <div className="grid gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 p-3">
              {TARGET_GROUP_CHECKBOX_IDS.map((checkboxId, index) => {
                const option = TARGET_GROUP_OPTIONS[index];
                return (
                  <div
                    key={checkboxId}
                    className="flex items-center gap-2 text-sm text-zinc-200"
                  >
                    <input
                      id={`product-target-group-${checkboxId}`}
                      type="checkbox"
                      checked={targetGroups.includes(option)}
                      onChange={(e) =>
                        setTargetGroups((prev) =>
                          nextTargetGroupsAfterToggle(
                            prev,
                            option,
                            e.target.checked,
                          ),
                        )
                      }
                      className="size-4 rounded border-zinc-600 bg-zinc-900 text-zinc-100"
                    />
                    <Label
                      htmlFor={`product-target-group-${checkboxId}`}
                      className="cursor-pointer font-normal text-zinc-200"
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-400" role="alert">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Се зачувува…
              </>
            ) : (
              "Додај производ"
            )}
          </Button>
        </div>
      </form>

      <section
        className={cn(
          "w-full max-w-7xl border-none bg-transparent px-1 py-12 text-zinc-100 sm:px-10",
        )}
      >
        <div className="mb-6 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пронајди продукт…"
            className={cn(fieldClass, "w-full sm:flex-1")}
          />
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value as ColorFilter)}
            aria-label="Филтрирај по боја"
            disabled={availableColors.length === 0}
            className={cn(
              "flex h-9 w-full rounded-md border px-3 text-sm shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600",
              "disabled:cursor-not-allowed disabled:opacity-50 sm:w-48",
              fieldClass,
            )}
          >
            <option value="all">Сите бои</option>
            {availableColors.map((color) => (
              <option key={color} value={color}>
                {formatAdminColorLabel(color)}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-medium text-zinc-400">Продукти</h3>
          <p className="text-xs text-zinc-500">
            Кликни на сликата за уредување; повлечи од „Повлечи“ за редослед. Мини-сликите се подредуваат одделно.
            {reorderingProducts ? " Се зачувува редоследот…" : null}
          </p>
        </div>
        {listError && (
          <p className="mb-3 text-sm text-red-400" role="alert">
            {listError}
          </p>
        )}
        {listLoading ? (
          <p className="text-sm text-zinc-500">Се вчитуваат…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-zinc-500">Нема производи.</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-zinc-500">Нема совпаѓања.</p>
        ) : (
          <DndContext
            sensors={productListSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleImageListDragEnd}
          >
            <ul className="grid w-full grid-cols-2 items-start gap-1.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredProducts.map((p, index) => (
                <ProductEditCard
                  key={p.id}
                  product={p}
                  displayIndex={index + 1}
                  deletingId={deletingId}
                  draggedProductId={draggedProductId}
                  dropTargetProductId={dropTargetProductId}
                  onProductDragStart={setDraggedProductId}
                  onProductDragEnd={() => {
                    setDraggedProductId(null);
                    setDropTargetProductId(null);
                  }}
                  onProductDragEnter={setDropTargetProductId}
                  onProductDrop={handleProductDrop}
                  onDelete={handleDelete}
                  onSave={handleUpdate}
                  registerImageDragHandler={registerImageDragHandler}
                  unregisterImageDragHandler={unregisterImageDragHandler}
                />
              ))}
            </ul>
          </DndContext>
        )}
      </section>
    </div>
  );
}
