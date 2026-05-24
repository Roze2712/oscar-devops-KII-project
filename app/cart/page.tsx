"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { displayProductNameForLocale } from "@/lib/display-product-name";

function parsePriceToNumber(price: string | null | undefined): number {
  if (price === null || price === undefined || price === "") return 0;
  const normalized = String(price).replace(/,/g, ".");
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const n = Number.parseFloat(match[0]);
  return Number.isFinite(n) ? n : 0;
}

function formatSummedAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function CartPage() {
  const { items, hydrated, removeFromCart } = useCart();
  const { t, language } = useLanguage();
  const router = useRouter();

  const subtotal = items.reduce(
    (sum, line) => sum + parsePriceToNumber(line.price),
    0,
  );
  const total = subtotal;

  if (!hydrated) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">{t("cart.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("cart.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cart.reviewItems")}
        </p>

        {items.length === 0 ? (
          <div className="mt-12 rounded-lg border border-border bg-card p-10 text-center shadow-sm">
            <p className="text-muted-foreground">{t("cart.empty")}</p>
            <Link
              href="/market"
              className="mt-6 inline-flex border border-transparent bg-black px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-black/90"
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th
                      scope="col"
                      className="w-14 px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <span className="sr-only">{t("cart.remove")}</span>
                    </th>
                    <th
                      scope="col"
                      className="w-28 px-2 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t("cart.image")}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t("cart.product")}
                    </th>
                    <th
                      scope="col"
                      className="w-36 px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t("cart.price")}
                    </th>
                    <th
                      scope="col"
                      className="w-36 px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t("cart.subtotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((line) => {
                    const lineDisplayName = displayProductNameForLocale(
                      language,
                      line.name,
                      line.name_en,
                    );
                    return (
                      <tr
                        key={line.lineId}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-4 py-4 align-middle">
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.lineId)}
                            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`${t("cart.remove")} ${lineDisplayName}`}
                          >
                            <Trash2 className="size-4" strokeWidth={1.5} />
                          </button>
                        </td>
                        <td className="px-2 py-4 align-middle">
                          <Link
                            href={`/market/${line.id}`}
                            className="block w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30"
                          >
                            {line.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- cart URLs may be remote
                              <img
                                src={line.image}
                                alt=""
                                className="aspect-[3/4] h-24 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-24 w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                                {t("cart.noImage")}
                              </div>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <Link
                            href={`/market/${line.id}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {lineDisplayName}
                          </Link>
                        </td>
                        <td className="px-4 py-4 align-middle tabular-nums text-foreground">
                          {line.price ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums font-medium text-foreground">
                          {line.price ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-80">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {t("cart.cartTotal")}
                </h2>
                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{t("cart.subtotal")}</dt>
                    <dd className="tabular-nums font-medium text-foreground">
                      {formatSummedAmount(subtotal)}
                    </dd>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-base font-semibold text-foreground">
                        {t("cart.total")}
                      </dt>
                      <dd className="text-base font-semibold tabular-nums text-foreground">
                        {formatSummedAmount(total)}
                      </dd>
                    </div>
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => router.push("/checkout")}
                  className="mt-8 w-full border border-transparent bg-black py-3.5 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("cart.continueToShipping")}
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t("cart.oneStepAway")}
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
