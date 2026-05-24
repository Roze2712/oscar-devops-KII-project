"use client";

import Image from "next/image";
import Link from "next/link";
import { ProductSlider } from "@/components/product-slider";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="bg-[#fafafa] pt-0">
      <section className="relative h-[calc(100vh-3.5rem)] min-h-[700px] w-full overflow-hidden bg-black">
        <video
          key="hero-video-fixed"
          src="/videos/0-02-05-368a93615088939f120ab8123b53d85e579d6c2e40b47e376c9c6490b53e40aa_220005a05e0.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 h-[110%] w-full object-cover max-md:object-[35%_center] md:object-center"
        />
        {/* Subtle gradient: enough contrast for type without masking the product */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/25" />
        <div className="relative z-10 flex h-full items-center justify-center px-4 text-center sm:px-6">
          <div className="flex max-w-3xl flex-col items-center">
            <h1 className="font-serif text-5xl tracking-[0.08em] text-white drop-shadow-[0_1px_12px_rgba(0,0,0,0.35)] sm:text-6xl md:text-7xl">
              {t("homePage.brandTitle")}
            </h1>
            <p className="mt-2 font-serif text-sm lowercase tracking-[0.2em] text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)] sm:text-base">
              bags & accessories
            </p>
            <Link
              href="/market"
              className="mt-10 inline-flex items-center justify-center border border-white/85 bg-transparent px-7 py-3 text-xs font-medium uppercase tracking-[0.24em] text-white shadow-[0_1px_12px_rgba(0,0,0,0.2)] transition hover:bg-white/10"
            >
              {t("homePage.discoverTheCollection")}
            </Link>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#fafafa] px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-serif text-3xl tracking-[0.2em] text-foreground/85 sm:text-4xl md:text-5xl">
            {t("homePage.refinedMinimalism")}
          </h2>
        </div>
      </section>

      <section className="w-full bg-[#fafafa] pb-20 sm:pb-24">
        <div className="flex w-full flex-col items-stretch md:grid md:grid-cols-12 md:items-stretch">
          <div className="order-1 relative h-[400px] w-full overflow-hidden bg-white md:order-2 md:col-span-8 md:h-[80vh] md:min-h-[700px]">
            <video
              src="/videos/0-02-05-83172bebab6daf85445d6eb633bb7de6d6c1e7edc27fcd7baf70214e0d574b92_22005ae32e5.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
          <div className="order-2 flex items-center justify-center bg-white px-6 py-8 text-center md:order-1 md:col-span-4 md:h-[80vh] md:min-h-[700px]">
            <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-sm bg-white px-6 py-8 sm:px-8 md:px-12 md:pt-12 md:pb-14">
              <h3 className="font-serif text-xl tracking-widest text-zinc-900 md:text-2xl">
                {t("homePage.essenceOfStyleTitle")}
              </h3>
              <p className="mt-5 text-sm font-light tracking-wide leading-[2.2] text-zinc-600/90 max-w-md mx-auto text-center [text-wrap:balance]">
                {t("homePage.essenceOfStyleBody")}
              </p>
              <Link
                href="/market"
                className='mt-12 border-b border-zinc-900/40 pb-1 text-xs font-medium uppercase tracking-[0.2em] text-zinc-900 transition hover:border-zinc-900 hover:text-zinc-700 [font-family:Geist,"Geist_Fallback",sans-serif]'
              >
                {t("homePage.discoverMore")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#fafafa] px-0 pb-20 pt-0 sm:pb-24 sm:pt-0">
        <div className="mt-0">
          <div className="py-8 sm:py-10">
            <h3 className='mx-auto mt-0 max-w-fit whitespace-nowrap text-center text-[32px] font-[500] leading-[38.4px] tracking-[-1.28px] text-black [font-family:"Sterling_SSM","Sterling_Fallback",serif]'>
              {t("homePage.shopByCategory")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-4">
            <Link
              href="/market?targetGroup=women"
              className="group relative block h-[400px] cursor-pointer overflow-hidden md:h-auto md:aspect-[3/4]"
            >
              <Image
                src="/images/viber7.jpg"
                alt={t("homePage.categoryWomenAlt")}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 33vw, 100vw"
                className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <span className="text-sm uppercase tracking-[0.3em] text-white md:text-2xl [font-family:Geist,'Geist_Fallback',sans-serif]">
                  {t("marketPage.women")}
                </span>
              </div>
            </Link>

            <Link
              href="/market?targetGroup=men"
              className="group relative block h-[400px] cursor-pointer overflow-hidden md:h-auto md:aspect-[3/4]"
            >
              <Image
                src="/images/viber6.jpg"
                alt={t("homePage.categoryMenAlt")}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 33vw, 100vw"
                className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <span className="text-sm uppercase tracking-[0.3em] text-white md:text-2xl [font-family:Geist,'Geist_Fallback',sans-serif]">
                  {t("marketPage.men")}
                </span>
              </div>
            </Link>

            <Link
              href="/market?targetGroup=kids"
              className="group relative block h-[400px] cursor-pointer overflow-hidden md:h-auto md:aspect-[3/4]"
            >
              <Image
                src="/images/viber4.jpg"
                alt={t("homePage.categoryKidsAlt")}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 33vw, 100vw"
                className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <span className="text-sm uppercase tracking-[0.3em] text-white md:text-2xl [font-family:Geist,'Geist_Fallback',sans-serif]">
                  {t("marketPage.kids")}
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
