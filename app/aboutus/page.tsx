"use client";

import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";

const ABOUTUS_IMAGES = {
  hero: "/images/Gemini_Generated_Image_1scio91scio91sci.png",
  parallax: ["/images/viber2.jpg", "/images/viber5.jpg"],
  finale: ["/images/Gemini_Generated_Image_cog0vcog0vcog0vc.png", "/images/Gemini_Generated_Image_1welo01welo01wel.png"],
} as const;

/** Body copy except signatureQuote: matches Who We Are flow (centered, balanced wrap, max-w-md). */
const aboutParagraphClass =
  "mt-5 text-sm font-light tracking-wide leading-[2.2] text-zinc-600/90 max-w-md mx-auto text-center [text-wrap:balance]";

export default function AboutUs() {
  const { t } = useLanguage();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] w-full max-w-full min-w-0 overflow-x-hidden bg-[#fafafa] text-zinc-900">
      <section className="relative right-[50%] left-[50%] ml-[-50vw] mr-[-50vw] w-screen pt-12 pb-14">
        <div className="flex min-w-0 flex-col items-center gap-8 md:flex-row md:items-stretch md:gap-0">
          <div className="relative ml-0 aspect-[2/3] w-full max-w-full shrink-0 overflow-hidden rounded-none border-y border-r border-l-0 border-border/40 bg-white pl-0 md:aspect-auto md:h-[760px] md:w-[950px] md:max-w-[950px]">
            <Image
              src={ABOUTUS_IMAGES.hero}
              alt="Oscar d-t"
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 950px"
              priority
            />
          </div>
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center px-6 sm:px-8 md:min-h-[760px] md:px-8">
            <article className="flex min-h-0 flex-col items-center justify-center text-center md:items-center md:px-2">
              <h1 className="font-serif text-xl tracking-widest text-zinc-900 md:text-2xl">
                {t("about.whoWeAreTitle")}
              </h1>
              <p className={aboutParagraphClass}>{t("about.whoWeAreText")}</p>
            </article>
          </div>
        </div>
      </section>

      <div className="w-full max-w-full min-w-0 space-y-14 overflow-x-hidden pl-3 pr-4 pb-12 sm:pl-4 sm:pr-6 md:pl-6 md:pr-8">
        <section className="rounded-sm bg-[#f5f2eb] px-4 py-8 text-center sm:px-8 sm:py-12">
          <p className="mx-auto max-w-xl text-lg italic leading-relaxed text-zinc-700 sm:text-2xl">
            {t("about.signatureQuote")}
          </p>
        </section>

        <section className="space-y-12">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
            <h2 className="font-serif text-xl tracking-widest text-zinc-900 md:text-2xl">
              {t("about.storyTitle")}
            </h2>
            <p className={aboutParagraphClass}>{t("about.storyParagraph1")}</p>
          </div>

          <div
            className="relative h-[30vh] w-full border-y border-border/40 bg-cover bg-center md:h-[44vh] md:bg-fixed"
            style={{ backgroundImage: `url('${ABOUTUS_IMAGES.parallax[0]}')` }}
            aria-hidden="true"
          />

          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
            <p className={aboutParagraphClass}>{t("about.storyParagraph2")}</p>
          </div>

          <div
            className="relative h-[30vh] w-full border-y border-border/40 bg-cover bg-center md:h-[44vh] md:bg-fixed"
            style={{ backgroundImage: `url('${ABOUTUS_IMAGES.parallax[1]}')` }}
            aria-hidden="true"
          />

          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
            <p className={aboutParagraphClass}>{t("about.storyParagraph3")}</p>
          </div>
        </section>

        <section className="relative right-[50%] left-[50%] ml-[-50vw] mr-[-50vw] flex w-screen max-w-[100vw] min-w-0 flex-col overflow-hidden md:flex-row md:w-full md:items-stretch md:justify-start">
          <div className="flex w-full shrink-0 flex-col justify-center bg-white py-10 md:h-[700px] md:w-[35%] md:min-w-[450px] md:shrink-0 md:py-0">
            <div className="flex min-h-0 min-w-0 w-full flex-col items-center justify-center px-6 sm:px-8 md:px-8">
              <article className="flex min-h-0 flex-col items-center justify-center text-center md:items-center md:px-2">
                <h2 className="font-serif text-xl tracking-widest text-zinc-900 md:text-2xl">
                  {t("about.aboutTitle")}
                </h2>
                <p className={aboutParagraphClass}>{t("about.aboutText")}</p>
              </article>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-row items-start justify-start gap-4 overflow-hidden md:h-[700px] md:min-h-0 md:items-center md:justify-start md:gap-10">
            <div className="relative min-h-[280px] min-w-0 flex-1 basis-0 overflow-hidden md:h-[700px] md:min-h-0">
              <Image
                src={ABOUTUS_IMAGES.finale[0]}
                alt="Oscar d-t showcase one"
                fill
                unoptimized
                sizes="(max-width: 767px) 50vw, 32vw"
                className="object-cover"
              />
            </div>
            <div className="flex min-h-[280px] min-w-0 flex-1 basis-0 flex-col overflow-hidden md:h-[700px] md:w-[32vw] md:max-w-[440px] md:flex-none md:shrink-0 md:self-center md:items-center md:justify-center">
              <div className="relative min-h-[280px] min-w-0 w-full flex-1 overflow-hidden md:h-[90%] md:min-h-0 md:flex-none">
                <Image
                  src={ABOUTUS_IMAGES.finale[1]}
                  alt="Oscar d-t showcase two"
                  fill
                  unoptimized
                  sizes="(max-width: 767px) 50vw, 32vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
