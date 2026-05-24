"use client";

import { useLanguage } from "@/context/LanguageContext";

const MAP_EMBED_SRC =
  "https://www.google.com/maps?q=" +
  encodeURIComponent("Kej na revolucijata 26, Kochani 2300, North Macedonia") +
  "&output=embed";

export default function Contact() {
  const { t } = useLanguage();

  return (
    <main className="min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-stretch">
          <div className="space-y-8 text-foreground">
            <header className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight uppercase">
                {t("contact.title")}
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {t("contact.subtitle")}
              </p>
            </header>

            <address className="not-italic space-y-6 text-base leading-relaxed">
              <p className="flex items-start gap-3 font-medium">
                <i
                  className="fa-solid fa-map fa-fw mt-1 shrink-0 text-muted-foreground"
                  aria-hidden={true}
                />
                <span>{t("contact.address")}</span>
              </p>
              <p className="flex items-start gap-3">
                <i
                  className="fa-regular fa-envelope fa-fw mt-1 shrink-0 text-muted-foreground"
                  aria-hidden={true}
                />
                <a
                  href="mailto:oscar.dt.jewellery@gmail.com"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  oscar.dt.jewellery@gmail.com
                </a>
              </p>
              <p className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <i
                  className="fa-solid fa-phone fa-fw mt-1 shrink-0 text-muted-foreground"
                  aria-hidden={true}
                />
                <span className="min-w-0">
                  <a
                    href="tel:+38978268066"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    +389 78 268 066
                  </a>
                  <span className="text-muted-foreground"> / </span>
                  <a
                    href="tel:+38978593954"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    +389 78 593 954
                  </a>
                </span>
              </p>
              <p className="flex items-start gap-3 text-muted-foreground">
                <i
                  className="fa-regular fa-clock fa-fw mt-1 shrink-0"
                  aria-hidden={true}
                />
                <span>{t("contact.hours")}</span>
              </p>
            </address>
          </div>

          <div className="relative min-h-[280px] w-full overflow-hidden rounded-lg border border-border/40 bg-muted shadow-sm lg:min-h-[420px]">
            <iframe
              title={t("contact.mapTitle")}
              src={MAP_EMBED_SRC}
              className="absolute inset-0 z-[3] h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </main>
  );
}
