"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

type SiteWordmarkProps = {
  /** Navbar: centered on small screens, left from md. Footer: left-aligned in column. */
  placement: "navbar" | "footer";
  className?: string;
};

export function SiteWordmark({ placement, className }: SiteWordmarkProps) {
  const { t } = useLanguage();
  const ariaLabel = `${t("site.wordmark")} — ${t("site.wordmarkTagline")}`;

  const titleColor =
    placement === "navbar" ? "text-foreground" : "text-zinc-900";

  return (
    <Link
      href="/"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-col items-center transition-opacity",
        placement === "navbar" &&
          "justify-self-center hover:opacity-90 md:justify-self-start",
        placement === "footer" && "hover:opacity-85",
        className,
      )}
    >
      {/* Width = title; tagline uses inset-x-[10%] so its box is exactly 80% of title width and centered */}
      <span className="relative inline-flex w-max max-w-full flex-col items-center pb-2">
        <span
          className={cn(
            'block w-max whitespace-nowrap font-serif text-[13px] font-medium tracking-[0.2em] sm:text-sm [font-family:Geist,"Geist_Fallback",serif]',
            titleColor,
          )}
        >
          {t("site.wordmark")}
        </span>
        <span
          className={cn(
            "absolute inset-x-[10%] top-full -mt-2 block text-center",
            "font-sans text-[6px] font-medium italic leading-none tracking-tight",
            "whitespace-nowrap",
            titleColor,
          )}
        >
          {t("site.wordmarkTagline")}
        </span>
      </span>
    </Link>
  );
}
