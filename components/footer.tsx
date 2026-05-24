"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteWordmark } from "@/components/site-wordmark";
import { useLanguage } from "@/context/LanguageContext";
import mkLocale from "@/locales/mk.json";

function resolveLocaleKey(
  dict: Record<string, unknown>,
  key: string,
): string {
  const value = key.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);

  return typeof value === "string" ? value : key;
}

/** Macedonian copy — matches server render (LanguageProvider defaults to mk on SSR). */
function tMk(key: string): string {
  return resolveLocaleKey(mkLocale as Record<string, unknown>, key);
}

export function Footer() {
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tr = (key: string) => (mounted ? t(key) : tMk(key));
  const shopHref = !mounted || language === "mk" ? "/cart" : "/market";

  const linkQuiet =
    "block text-[10px] tracking-widest text-zinc-500 transition hover:text-zinc-900";

  return (
    <footer className="w-full border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-12">
          <div className="space-y-3">
            <SiteWordmark placement="footer" />
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-900">
              {tr("footer.shop")}
            </h4>
            <Link href={shopHref} className={linkQuiet}>
              {tr("footer.shopLink")}
            </Link>
            <Link href="/aboutus" className={linkQuiet}>
              {tr("footer.aboutUs")}
            </Link>
            <Link href="/contact" className={linkQuiet}>
              {tr("footer.contact")}
            </Link>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-900">
              {tr("footer.social")}
            </h4>
            <Link
              href="https://www.instagram.com/oscar_dt_jewellery?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              className={linkQuiet}
            >
              {tr("footer.instagram")}
            </Link>
            <Link href="https://www.facebook.com/oskar.dt.3" className={linkQuiet}>
              {tr("footer.facebook")}
            </Link>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-900">
              {tr("footer.infoColumnTitle")}
            </h4>
            <Link href="/privacy-policy" className={linkQuiet}>
              {tr("footer.privacyPolicy")}
            </Link>
            <Link href="/delivery-policy" className={linkQuiet}>
              {tr("footer.deliveryPolicy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
