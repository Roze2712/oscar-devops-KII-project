"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Facebook,
  Heart,
  Instagram,
  Menu,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { useWishlist } from "@/lib/context/WishlistContext";
import { SiteWordmark } from "@/components/site-wordmark";
import { cn } from "@/lib/utils";
import mkDict from "@/locales/mk.json";

/**
 * Pre-mount SSR-stable resolver for `t(key)` calls. The server always renders
 * with the MK dictionary (because `window` is undefined and our context
 * defaults to "mk"); during initial client hydration we must return the same
 * MK strings to avoid a mismatch when the user's stored locale is "en". After
 * the `mounted` flag flips, the navbar swaps back to the real `t` from the
 * language context. Same shape as `resolvePath` in `LanguageContext.tsx`.
 */
function resolveMkFallback(key: string): string {
  const value = key.split(".").reduce<unknown>((acc, segment) => {
    if (
      acc &&
      typeof acc === "object" &&
      segment in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, mkDict as unknown);
  return typeof value === "string" ? value : key;
}

const INSTAGRAM_HREF =
  "https://www.instagram.com/oscar_dt_jewellery?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";
const FACEBOOK_HREF = "https://www.facebook.com/oskar.dt.3";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { language, setLanguage, t: tRaw } = useLanguage();
  const { items: wishlistItems } = useWishlist();
  const { items: cartItems } = useCart();
  const wishlistCount = wishlistItems.length;
  const cartCount = cartItems.length;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [marketSearchOpen, setMarketSearchOpen] = useState(false);
  const [marketSearchInput, setMarketSearchInput] = useState("");

  /**
   * Hydration gate: stays `false` during SSR and the very first client render
   * so the navbar emits the same MK strings the server sent, then flips on
   * mount and lets the real `tRaw` (locale-aware) take over. Prevents the
   * "Otvori meni" ↔ "Open menu" aria-label mismatch React was complaining about.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const t = mounted ? tRaw : resolveMkFallback;

  const navLinks = [
    { href: "/", label: t("navbar.home") },
    { href: "/aboutus", label: t("navbar.aboutUs") },
    { href: "/market", label: t("navbar.products") },
    { href: "/contact", label: t("navbar.contact") },
  ];

  useEffect(() => {
    setOverlayMounted(true);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/market") {
      setMarketSearchInput("");
      return;
    }
    setMarketSearchInput(searchParams.get("search") ?? "");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  const linkClass = (href: string) =>
    cn(
      "whitespace-nowrap rounded-md px-1.5 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3 sm:text-sm",
      pathname === href
        ? "bg-[#F7F7E6] text-foreground underline underline-offset-4 decoration-2"
        : "text-foreground",
    );

  const mobileRowClass =
    "flex items-center justify-between gap-4 border-b border-zinc-200 py-4 text-left text-[13px] font-normal uppercase tracking-[0.14em] text-black transition-colors hover:text-zinc-600";

  const submitMarketSearch = () => {
    const trimmed = marketSearchInput.trim();

    if (pathname === "/market") {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
      const query = params.toString();
      router.replace(query ? `/market?${query}` : "/market", { scroll: false });
      return;
    }

    const target = trimmed
      ? `/market?search=${encodeURIComponent(trimmed)}`
      : "/market";
    router.push(target);
  };

  const closeMarketSearch = () => {
    setMarketSearchOpen(false);
    setMarketSearchInput("");
    if (pathname === "/market" && searchParams.get("search")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("search");
      const query = params.toString();
      router.replace(query ? `/market?${query}` : "/market", { scroll: false });
    }
  };

  const mobileOverlay = (
    <div
      id="mobile-nav-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("navbar.menuNavigation")}
      aria-hidden={!mobileMenuOpen}
      className={cn(
        "fixed inset-0 z-[9999] flex max-h-[100dvh] min-h-0 flex-col bg-white text-black shadow-[0_0_40px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
        mobileMenuOpen
          ? "translate-x-0"
          : "pointer-events-none -translate-x-full",
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-end border-b border-zinc-200 bg-white px-4">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-md p-2 text-black transition-colors hover:bg-zinc-100"
          aria-label={t("navbar.closeMenu")}
        >
          <X className="size-[22px]" strokeWidth={1.5} />
        </button>
      </div>

      <nav
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pb-10 pt-2 [scrollbar-gutter:stable]"
        aria-label={t("navbar.menuNavigation")}
      >
        {/* Primary navigation */}
        <ul className="flex flex-col">
          {navLinks.map(({ href, label }) => (
            <li key={href} className="border-b border-zinc-200">
              <Link
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block py-4 text-left text-[13px] font-normal uppercase tracking-[0.14em] text-black antialiased transition-colors hover:text-zinc-600",
                  pathname === href && "font-medium text-zinc-900",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div
          className="my-5 h-px w-full shrink-0 bg-zinc-200"
          aria-hidden
        />

        {/* Utilities: Favorites, Cart, Language */}
        <div className="flex flex-col">
          <Link
            href="/wishlist"
            onClick={() => setMobileMenuOpen(false)}
            className={mobileRowClass}
          >
            <span className="flex items-center gap-3">
              <Heart className="size-[18px] shrink-0" strokeWidth={1.35} />
              {t("navbar.wishlist")}
            </span>
            {wishlistCount > 0 ? (
              <span className="text-xs font-medium tabular-nums text-zinc-500">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </Link>

          <Link
            href="/cart"
            onClick={() => setMobileMenuOpen(false)}
            className={mobileRowClass}
          >
            <span className="flex items-center gap-3">
              <ShoppingBag className="size-[18px] shrink-0" strokeWidth={1.35} />
              {t("navbar.cart")}
            </span>
            {cartCount > 0 ? (
              <span className="text-xs font-medium tabular-nums text-zinc-500">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>

          <div className="border-b border-zinc-200 py-4">
            <p className="mb-2 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t("navbar.languageSelector")}
            </p>
            <div className="inline-flex rounded-md border border-zinc-300 p-0.5">
              {(["mk", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "min-w-[3rem] rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                    language === code
                      ? "bg-black text-white"
                      : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Social — compact icons */}
        <div className="mt-auto shrink-0 border-t border-zinc-200 pt-8">
          <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            {t("footer.social")}
          </p>
          <div className="flex items-center justify-center gap-8">
            <a
              href={INSTAGRAM_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-full p-2 text-black transition-opacity hover:opacity-60"
              aria-label={t("footer.instagram")}
            >
              <Instagram className="size-[18px]" strokeWidth={1.2} />
            </a>
            <a
              href={FACEBOOK_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-full p-2 text-black transition-opacity hover:opacity-60"
              aria-label={t("footer.facebook")}
            >
              <Facebook className="size-[18px]" strokeWidth={1.2} />
            </a>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid min-h-14 w-full max-w-7xl grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-1 px-4 py-1.5 sm:gap-x-2 sm:px-6 md:flex md:justify-between md:gap-4 md:py-2 lg:px-8">
        {marketSearchOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMarketSearch();
            }}
            className="col-span-3 flex items-center gap-1 md:hidden"
            role="search"
            aria-label={t("navbar.search")}
          >
            <button
              type="submit"
              className="shrink-0 rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label={t("navbar.submitSearch")}
            >
              <Search className="size-[18px]" strokeWidth={1.5} />
            </button>
            <input
              type="search"
              value={marketSearchInput}
              onChange={(e) => setMarketSearchInput(e.target.value)}
              placeholder={t("navbar.searchPlaceholder")}
              className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-300 ease-out focus-visible:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={closeMarketSearch}
              className="shrink-0 rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label={t("navbar.closeSearch")}
            >
              <X className="size-[18px]" strokeWidth={1.5} />
            </button>
          </form>
        ) : null}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={cn(
            "place-self-start rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden",
            marketSearchOpen && "hidden",
          )}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-overlay"
          aria-label={t("navbar.openMenu")}
        >
          <Menu className="size-[22px]" strokeWidth={1.5} />
        </button>

        <div className={cn(marketSearchOpen && "hidden md:block")}>
          <SiteWordmark placement="navbar" />
        </div>

        <div
          className={cn(
            "flex min-w-0 items-center justify-end gap-0.5 sm:gap-4",
            marketSearchOpen && "hidden md:flex",
          )}
        >
          <ul className="hidden min-w-0 flex-nowrap items-center justify-end gap-0.5 md:flex md:gap-6">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClass(href)}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          {marketSearchOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitMarketSearch();
              }}
              className="hidden items-center gap-1 md:flex"
              role="search"
              aria-label={t("navbar.search")}
            >
              <input
                type="search"
                value={marketSearchInput}
                onChange={(e) => setMarketSearchInput(e.target.value)}
                placeholder={t("navbar.searchPlaceholder")}
                className="h-8 w-44 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
              />
              <button
                type="submit"
                className="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={t("navbar.submitSearch")}
              >
                <Search className="size-[18px]" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={closeMarketSearch}
                className="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={t("navbar.closeSearch")}
              >
                <X className="size-[18px]" strokeWidth={1.5} />
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setMarketSearchOpen((prev) => !prev);
              if (pathname !== "/market") {
                setMarketSearchInput("");
              } else {
                setMarketSearchInput(searchParams.get("search") ?? "");
              }
            }}
            className="inline-flex shrink-0 rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:ml-3 lg:ml-4"
            aria-label={t("navbar.search")}
            aria-expanded={marketSearchOpen}
          >
            <Search className="size-[22px]" strokeWidth={1.5} />
          </button>
          <Link
            href="/cart"
            aria-label={t("navbar.cart")}
            className="shrink-0 rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ShoppingBag className="size-[22px]" strokeWidth={1.5} />
          </Link>
          <Link
            href="/wishlist"
            aria-label={
              wishlistCount > 0
                ? `${t("navbar.wishlist")} (${wishlistCount})`
                : t("navbar.wishlist")
            }
            className="relative shrink-0 rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Heart className="size-[22px]" strokeWidth={1.5} />
            {wishlistCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold leading-none text-background">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </Link>
          <select
            value={mounted ? language : "mk"}
            onChange={(e) => setLanguage(e.target.value as "mk" | "en")}
            aria-label={t("navbar.languageSelector")}
            className="hidden h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground md:block"
          >
            <option value="mk">MK</option>
            <option value="en">EN</option>
          </select>
        </div>
      </div>

      {overlayMounted
        ? createPortal(mobileOverlay, document.body)
        : null}
    </nav>
  );
}
