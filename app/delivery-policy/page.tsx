"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function DeliveryPolicyPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-white text-zinc-900">
      <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 lg:py-20">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("deliveryPolicyPage.title")}
        </h1>
        <p className="mt-10 text-sm leading-[1.75] text-zinc-600 sm:text-base">
          {t("deliveryPolicyPage.body")}
        </p>
        <Link
          href="/market"
          className="mt-14 inline-flex border border-zinc-900 bg-zinc-900 px-7 py-3.5 text-xs font-medium uppercase tracking-[0.15em] text-white transition hover:bg-black"
        >
          {t("infoPages.backToShop")}
        </Link>
      </div>
    </main>
  );
}
