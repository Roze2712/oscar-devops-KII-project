"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { displayProductNameForLocale } from "@/lib/display-product-name";

function parsePriceToNumber(price: string | number | null | undefined): number {
  if (price === null || price === undefined || price === "") return 0;
  if (typeof price === "number") return price;
  const normalized = String(price).replace(/,/g, ".");
  const match = normalized.match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const n = Number.parseFloat(match[0]);
  return Number.isFinite(n) ? n : 0;
}

function stripCurrencySuffixFromPrice(
  price: string | number | null | undefined,
): string {
  if (price === null || price === undefined || price === "") return "";
  return String(price).replace(/\s*(ден\.?|den\.?|mkd)$/i, "").trim();
}

function formatSummedAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function sanitizePhoneInput(value: string): string {
  // Allow only digits and a single optional leading "+".
  let cleaned = value.replace(/[^\d+]/g, "");
  if (cleaned.includes("+")) {
    cleaned = `+${cleaned.replace(/\+/g, "")}`;
  }

  // Keep lengths bounded for the two accepted formats:
  // +389XXXXXXXX (12 chars) or 0XXXXXXXX (9 chars).
  if (cleaned.startsWith("+")) return cleaned.slice(0, 12);
  return cleaned.slice(0, 9);
}

function isValidMacedonianPhone(value: string): boolean {
  return /^\+389\d{8}$/.test(value) || /^0\d{8}$/.test(value);
}

function isPhoneTooShort(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("+389")) return value.length < 12;
  if (value.startsWith("0")) return value.length < 9;
  return value.length < 9;
}

const MACEDONIAN_CITIES: { label: string; value: string }[] = [
  { label: "Скопје", value: "skopje" },
  { label: "Битола", value: "bitola" },
  { label: "Куманово", value: "kumanovo" },
  { label: "Прилеп", value: "prilep" },
  { label: "Тетово", value: "tetovo" },
  { label: "Велес", value: "veles" },
  { label: "Штип", value: "shtip" },
  { label: "Охрид", value: "ohrid" },
  { label: "Гостивар", value: "gostivar" },
  { label: "Струмица", value: "strumica" },
  { label: "Кавадарци", value: "kavadarci" },
  { label: "Кочани", value: "kochani" },
  { label: "Кичево", value: "kichevo" },
  { label: "Струга", value: "struga" },
  { label: "Радовиш", value: "radovish" },
  { label: "Гевгелија", value: "gevgelija" },
  { label: "Дебар", value: "debar" },
  { label: "Крива Паланка", value: "kriva-palanka" },
  { label: "Свети Николе", value: "sveti-nikole" },
  { label: "Виница", value: "vinica" },
  { label: "Ресен", value: "resen" },
  { label: "Берово", value: "berovo" },
  { label: "Делчево", value: "delchevo" },
  { label: "Кратово", value: "kratovo" },
  { label: "Пробиштип", value: "probishtip" },
  { label: "Неготино", value: "negotino" },
  { label: "Крушево", value: "krushevo" },
  { label: "Македонски Брод", value: "makedonski-brod" },
  { label: "Валандово", value: "valandovo" },
  { label: "Богданци", value: "bogdanci" },
  { label: "Демир Капија", value: "demir-kapija" },
  { label: "Демир Хисар", value: "demir-hisar" },
  { label: "Македонска Каменица", value: "makedonska-kamenica" },
  { label: "Пехчево", value: "pehchevo" },
];

export default function CheckoutPage() {
  const { items, hydrated, clearCart } = useCart();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Македонија");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const cityComboboxRef = useRef<HTMLDivElement>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim();
    if (!q) return MACEDONIAN_CITIES;
    const needle = q.toLowerCase();
    return MACEDONIAN_CITIES.filter((c) =>
      c.label.toLowerCase().startsWith(needle),
    );
  }, [cityQuery]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (cityComboboxRef.current?.contains(e.target as Node)) return;
      setCityOpen(false);
      if (city) {
        const opt = MACEDONIAN_CITIES.find((c) => c.value === city);
        setCityQuery(opt?.label ?? "");
      } else {
        setCityQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [city]);

  useEffect(() => {
    if (!hydrated) return;
    console.log("[CheckoutPage] CartContext items", items);
  }, [hydrated, items]);

  const subtotal = useMemo(
    () => items.reduce((sum, line) => sum + parsePriceToNumber(line.price), 0),
    [items],
  );
  const total = subtotal;

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setPhoneError(null);
      setFormError(null);

      if (country !== "Македонија") {
        setFormError(t("checkout.errorCountry"));
        return;
      }

      if (
        !email.trim() ||
        !firstName.trim() ||
        !lastName.trim() ||
        !address.trim()
      ) {
        setFormError(t("checkout.errorRequiredFields"));
        return;
      }

      if (!city.trim()) {
        setFormError(t("checkout.errorSelectCity"));
        return;
      }

      const cityLabel =
        MACEDONIAN_CITIES.find((c) => c.value === city)?.label ?? "";
      if (!cityLabel) {
        setFormError(t("checkout.errorSelectCity"));
        return;
      }

      if (isPhoneTooShort(phoneNumber)) {
        setPhoneError(t("checkout.errorPhoneShort"));
        return;
      }

      if (!isValidMacedonianPhone(phoneNumber)) {
        setPhoneError(t("checkout.errorPhoneInvalid"));
        return;
      }

      if (items.length === 0) {
        setFormError(t("checkout.errorCartEmpty"));
        return;
      }

      const totalFormatted = formatSummedAmount(total);
      const currency = t("currency").trim();

      setIsSubmitting(true);
      try {
        const res = await fetch("/api/send-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(45_000),
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            address: address.trim(),
            city: cityLabel,
            phone: phoneNumber.trim(),
            items: items.map((item) => {
              const numP = parsePriceToNumber(item.price);
              const stripped = stripCurrencySuffixFromPrice(item.price);
              return {
                name: displayProductNameForLocale(language, item.name, item.name_en),
                price:
                  numP > 0
                    ? `${numP} ${currency}`
                    : stripped
                      ? `${stripped} ${currency}`
                      : `0 ${currency}`,
                image: item.image,
              };
            }),
            total: `${totalFormatted} ${currency}`,
          }),
        });

        let data: { success?: boolean } = {};
        try {
          data = (await res.json()) as { success?: boolean };
        } catch {
          /* non-JSON body */
        }

        if (!res.ok || data.success !== true) {
          alert(t("checkout.errorOrderSend"));
          return;
        }

        setShowSuccessToast(true);
      } catch {
        alert(t("checkout.errorOrderSend"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      address,
      city,
      country,
      email,
      firstName,
      items,
      language,
      lastName,
      phoneNumber,
      t,
      total,
    ],
  );

  useEffect(() => {
    if (!showSuccessToast) return;
    const timeout = setTimeout(() => {
      setShowSuccessToast(false);
      clearCart();
      router.push("/market");
    }, 3000);
    return () => clearTimeout(timeout);
  }, [showSuccessToast, clearCart, router]);

  if (!hydrated) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">{t("checkout.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      {showSuccessToast && (
        <div className="fixed left-1/2 top-[20px] z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-medium text-foreground shadow-lg animate-in slide-in-from-top-full duration-500">
          {t("checkout.successToast")}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("checkout.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("checkout.subtitle")}
        </p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          <section className="lg:col-span-8">
            <form
              className="rounded-lg border border-border bg-card p-6 shadow-sm"
              onSubmit={handleSubmit}
            >
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {t("checkout.contactInfoTitle")}
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.email")}
                  </span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder={t("checkout.emailPlaceholder")}
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                <div className="hidden sm:block" />
              </div>

              <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground">
                {t("checkout.shippingAddressTitle")}
              </h2>

              <div className="mt-6">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.country")}
                  </span>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Македонија">Македонија</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.firstName")}
                  </span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    type="text"
                    required
                    // placeholder="Име"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.lastName")}
                  </span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    type="text"
                    required
                    // placeholder="Презиме"
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.address")}
                  </span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    type="text"
                    required
                    // placeholder="Street address"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.city")}
                  </span>
                  <div ref={cityComboboxRef} className="relative">
                    <input
                      type="text"
                      value={cityQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCityQuery(v);
                        setCityOpen(true);
                        const sel = MACEDONIAN_CITIES.find(
                          (c) => c.value === city,
                        );
                        if (!sel || v !== sel.label) setCity("");
                      }}
                      onFocus={() => setCityOpen(true)}
                      placeholder="Избери град..."
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={cityOpen}
                      role="combobox"
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {cityOpen && (
                      <ul
                        role="listbox"
                        className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm text-popover-foreground shadow-md"
                      >
                        {filteredCities.length === 0 ? (
                          <li className="px-3 py-2 text-muted-foreground">
                            {t("checkout.cityNoResults")}
                          </li>
                        ) : (
                          filteredCities.map((c) => (
                            <li key={c.value} role="none">
                              <button
                                type="button"
                                role="option"
                                aria-selected={city === c.value}
                                className="flex w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                  setCity(c.value);
                                  setCityQuery(c.label);
                                  setCityOpen(false);
                                }}
                              >
                                {c.label}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                </label>
              </div>

              <div className="mt-4 w-full sm:w-1/2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("checkout.phoneNumber")}
                  </span>
                  <input
                    value={phoneNumber}
                    onChange={(e) => {
                      const nextValue = sanitizePhoneInput(e.target.value);
                      setPhoneNumber(nextValue);
                      if (isPhoneTooShort(nextValue)) {
                        setPhoneError(
                          t("checkout.errorPhoneShort"),
                        );
                      } else if (phoneError) {
                        setPhoneError(null);
                      }
                    }}
                    type="tel"
                    required
                    placeholder={t("checkout.phonePlaceholder")}
                    inputMode="numeric"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                {phoneError && (
                  <p className="text-xs text-red-500">{phoneError}</p>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t("checkout.confirmationHint")}
                </p>
                <button
                  type="submit"
                  disabled={
                    items.length === 0 || showSuccessToast || isSubmitting
                  }
                  className="inline-flex justify-center rounded-md border border-transparent bg-black px-6 py-3 text-sm font-medium uppercase tracking-[0.12em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? t("checkout.submitting") : t("checkout.submit")}
                </button>
              </div>
              {formError && (
                <p className="mt-3 text-xs text-red-500">{formError}</p>
              )}
            </form>
          </section>

          <aside className="lg:col-span-4 lg:sticky lg:top-24 self-start">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {t("checkout.orderSummary")}
              </h2>

              <div className="mt-6 space-y-4">
                {items.map((line) => {
                  const lineDisplayName = displayProductNameForLocale(
                    language,
                    line.name,
                    line.name_en,
                  );
                  return (
                  <div
                    key={line.lineId}
                    className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-2"
                  >
                    <div className="h-14 w-12 overflow-hidden rounded-md border border-border/70 bg-muted/20">
                      {line.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- cart URLs may be remote
                        <img
                          src={line.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {t("checkout.noImage")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {lineDisplayName}
                      </p>
                      <p className="mt-1 text-sm tabular-nums text-foreground">
                        {line.price ?? "—"}
                      </p>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="mt-8 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("checkout.subtotal")}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {formatSummedAmount(subtotal)}
                  </span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-base font-semibold text-foreground">
                      {t("checkout.total")}
                    </span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {formatSummedAmount(total)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                {t("delivery.standardNotice")}
              </p>

              {items.length === 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("checkout.emptyCart")}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

