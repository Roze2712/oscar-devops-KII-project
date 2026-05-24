"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useWishlist, type WishlistItem } from "@/lib/context/WishlistContext";
import {
  formatProductPriceWithCurrency,
  resolveProductDisplayTitle,
} from "@/lib/product-localization";

export type ProductCardProduct = {
  id: number;
  name: string;
  name_en?: string | null;
  price: string | number | null;
  image: string | null;
};

type ProductCardProps = {
  product: ProductCardProduct;
  className?: string;
  textPaddingClassName?: string;
  showPrice?: boolean;
  centerText?: boolean;
};

const PRODUCT_CARD_IMAGE_BG = "#f2f2f2";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'%3E%3Crect width='3' height='4' fill='%23f3f4f6'/%3E%3C/svg%3E";

function getProductImageList(image: ProductCardProduct["image"]): string[] {
  if (!image) return [];
  const trimmed = image.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
          .map((item) => item.trim());
      }
    } catch {
      // Plain URL string below.
    }
  }

  return [trimmed];
}

function toWishlistItem(product: ProductCardProduct): WishlistItem {
  const price =
    product.price === null || product.price === undefined || product.price === ""
      ? null
      : String(product.price);
  return {
    id: product.id,
    name: product.name,
    name_en: product.name_en,
    price,
    image: product.image,
  };
}

export function ProductCard({
  product,
  className = "",
  textPaddingClassName = "px-3 sm:px-4",
  showPrice = true,
  centerText = false,
}: ProductCardProps) {
  const { t, language } = useLanguage();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const inWishlist = isInWishlist(product.id);

  const displayTitle = useMemo(
    () =>
      resolveProductDisplayTitle(
        language,
        product.name ?? "",
        product.name_en ?? null,
      ),
    [language, product.name, product.name_en],
  );

  const priceLabel = useMemo(
    () => formatProductPriceWithCurrency(product.price, t("currency")),
    [product.price, language, t],
  );

  const images = useMemo(
    () => getProductImageList(product.image),
    [product.image],
  );
  const primaryImage = images[0] ?? PLACEHOLDER_IMAGE;
  const hoverImage = images[1] ?? primaryImage;

  const imageSurfaceStyle: CSSProperties = {
    backgroundColor: PRODUCT_CARD_IMAGE_BG,
    backgroundImage: "none",
  };

  const productCardImgStyle: CSSProperties = {
    backgroundColor: PRODUCT_CARD_IMAGE_BG,
    backgroundImage: "none",
  };
  const productCardImgBgClass = "![background-image:none]";

  return (
    <article lang={language} className={`min-w-0 ${className}`}>
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        style={imageSurfaceStyle}
      >
        <Link
          href={`/market/${product.id}`}
          className="group relative z-0 flex h-full min-h-0 w-full min-w-0 items-center justify-center"
          style={imageSurfaceStyle}
        >
          <div
            className="relative z-0 h-full w-full min-h-0 min-w-0"
            style={imageSurfaceStyle}
          >
            <img
              src={primaryImage}
              alt={displayTitle}
              className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain object-center transition-opacity duration-500 ease-in-out group-hover:opacity-0 ${productCardImgBgClass}`}
              style={productCardImgStyle}
              loading="lazy"
            />
            <img
              src={hoverImage}
              alt={displayTitle}
              className={`pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain object-center opacity-0 transition-opacity duration-500 ease-in-out group-hover:opacity-100 ${productCardImgBgClass}`}
              style={productCardImgStyle}
              loading="lazy"
            />
          </div>
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(toWishlistItem(product));
          }}
          aria-pressed={inWishlist}
          aria-label={
            inWishlist
              ? t("wishlistActions.removeFromWishlist")
              : t("wishlistActions.addToWishlist")
          }
          className="absolute right-2 top-2 z-30 p-1 text-black transition-opacity hover:opacity-70"
        >
          <Heart
            className={`size-5 ${inWishlist ? "fill-black text-black" : "fill-none text-black"}`}
            strokeWidth={1}
          />
        </button>
      </div>
      <Link href={`/market/${product.id}`} className="mt-2.5 block">
        <div
          className={`flex flex-col gap-0.5 ${
            centerText ? "items-center" : "items-start"
          } ${textPaddingClassName}`}
        >
          <h3
            data-testid="product-card-category-title"
            className={`line-clamp-2 text-sm font-bold capitalize leading-tight tracking-tight text-foreground [font-family:Inter,Montserrat,Arial,sans-serif] ${
              centerText ? "text-center" : "text-left"
            }`}
          >
            {displayTitle}
          </h3>
          {showPrice ? (
            <p
              className={`text-[11px] font-bold tabular-nums leading-tight text-foreground [font-family:Inter,Montserrat,Arial,sans-serif] ${
                centerText ? "text-center" : "text-left"
              }`}
            >
              {priceLabel}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
