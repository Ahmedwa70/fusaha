import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, ArrowLeftIcon, CheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { localeDirections, type Locale } from "@/i18n/config";
import { ArchPattern } from "@/app/auth/login/_components/arch-pattern";
import { ImageSlot } from "@/app/_components/image-slot";
import { MobileHeaderMenu } from "@/app/_components/mobile-header-menu";

export default async function LandingPage() {
  const locale = (await getLocale()) as Locale;
  const isRtl = localeDirections[locale] === "rtl";
  const ForwardIcon = isRtl ? ArrowLeftIcon : ArrowRightIcon;

  const tApp = await getTranslations("app");
  const tHero = await getTranslations("landing.hero");
  const tBefore = await getTranslations("landing.before");
  const tHow = await getTranslations("landing.how");
  const tLevels = await getTranslations("landing.levels");
  const tFeatures = await getTranslations("landing.features");
  const tClosing = await getTranslations("landing.closing");
  const tFooter = await getTranslations("landing.footer");

  const steps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: tHow(`step${n}Title`),
    body: tHow(`step${n}Body`),
  }));

  const levels = [1, 2, 3].map((n) => ({
    title: tLevels(`level${n}Title`),
    body: tLevels(`level${n}Body`),
  }));

  const features = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: tFeatures(`f${n}Title`),
    body: tFeatures(`f${n}Body`),
  }));

  const oldSteps = [1, 2, 3, 4].map((n) => tBefore(`oldStep${n}`));

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt={tApp("name")} width={32} height={32} priority className="size-8" />
          <span className="font-heading text-lg font-semibold text-brand-900 dark:text-brand-50">
            {tApp("name")}
          </span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={ROUTES.login} />}>
            {tHero("ctaSecondary")}
          </Button>
        </div>
        <MobileHeaderMenu className="sm:hidden" />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pt-8 pb-20 sm:px-10 lg:pt-14 lg:pb-28">
          <ArchPattern className="absolute inset-0 -z-10 h-full w-full text-brand-900/4 dark:text-gold-400/5" />
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
            <div className="text-center lg:text-start">
              <h1 className="text-balance font-heading text-4xl leading-[1.15] font-semibold text-brand-900 dark:text-brand-50 sm:text-5xl lg:text-[3.25rem]">
                {tHero("headline")}
              </h1>
              <p className="mx-auto mt-5 max-w-md text-balance text-lg leading-relaxed text-muted-foreground lg:mx-0">
                {tHero("subheadline")}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" nativeButton={false} render={<Link href={ROUTES.signup} />} className="w-full sm:w-auto">
                  {tHero("ctaPrimary")}
                  <ForwardIcon data-icon="inline-end" />
                </Button>
                <Button size="lg" variant="outline" nativeButton={false} render={<Link href={ROUTES.login} />} className="w-full sm:w-auto">
                  {tHero("ctaSecondary")}
                </Button>
              </div>
            </div>
            <ImageSlot label={tHero("imagePlaceholder")} ratio="aspect-[4/3]" className="w-full" />
          </div>
        </section>

        {/* Before / After */}
        <section className="border-y border-border bg-brand-50/50 px-6 py-16 dark:bg-white/2 sm:px-10 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-2xl font-semibold text-brand-900 dark:text-brand-50 sm:text-3xl">
              {tBefore("title")}
            </h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="rounded-2xl border border-border bg-card p-7">
                <p className="text-sm font-medium text-muted-foreground">{tBefore("oldLabel")}</p>
                <ol className="mt-4 space-y-3">
                  {oldSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-col justify-center rounded-2xl border border-gold-400/30 bg-brand-900 p-7 text-brand-50 dark:bg-brand-950">
                <p className="text-sm font-medium text-gold-300">{tBefore("newLabel")}</p>
                <p className="mt-4 text-lg leading-relaxed">{tBefore("newStep")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 sm:px-10 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-2xl font-semibold text-brand-900 dark:text-brand-50 sm:text-3xl">
              {tHow("title")}
            </h2>
            <ol className="mt-14 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-3">
              {steps.map((step, i) => (
                <li key={i} className="flex flex-col items-center text-center">
                  <div className="flex size-16 items-center justify-center rounded-t-full border-2 border-b-0 border-brand-300 bg-brand-50 dark:border-gold-400/40 dark:bg-white/5">
                    <span className="font-heading text-base font-semibold text-brand-700 dark:text-gold-300">
                      {i + 1}
                    </span>
                  </div>
                  <div className="h-px w-16 bg-brand-300 dark:bg-gold-400/40" />
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Levels */}
        <section className="border-y border-border bg-brand-50/50 px-6 py-16 dark:bg-white/2 sm:px-10 lg:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-heading text-2xl font-semibold text-brand-900 dark:text-brand-50 sm:text-3xl">
              {tLevels("title")}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {tLevels("subtitle")}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              {levels.map((level, i) => (
                <div key={i} className="flex-1 rounded-2xl border border-border bg-card p-6 text-start">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-gold-100 text-xs font-semibold text-gold-800 dark:bg-gold-500/15 dark:text-gold-300">
                      {i + 1}
                    </span>
                    <h3 className="font-heading text-base font-semibold text-foreground">{level.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{level.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-16 sm:px-10 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-heading text-2xl font-semibold text-brand-900 dark:text-brand-50 sm:text-3xl">
              {tFeatures("title")}
            </h2>
            <div className="mt-4 grid gap-16 lg:grid-cols-2 lg:items-center">
              <ul className="divide-y divide-border">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3.5 py-5">
                    <CheckIcon className="mt-0.5 size-5 shrink-0 text-gold-600 dark:text-gold-400" strokeWidth={2} />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <ImageSlot label={tHero("imagePlaceholder")} ratio="aspect-square" className="hidden lg:flex" />
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-6 pb-20 sm:px-10">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-brand-900 px-8 py-16 text-center dark:bg-brand-950 sm:px-16">
            <ArchPattern className="absolute inset-0 h-full w-full text-gold-400/8" />
            <div className="relative">
              <h2 className="font-heading text-2xl font-semibold text-brand-50 sm:text-3xl">
                {tClosing("title")}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-100/70">
                {tClosing("subtitle")}
              </p>
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href={ROUTES.signup} />}
                className="mt-8 bg-gold-500 text-brand-950 hover:bg-gold-400"
              >
                {tClosing("cta")}
                <ForwardIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Image src="/logo.png" alt={tApp("name")} width={20} height={20} className="size-5" />
            <span>{tApp("name")}</span>
            <span className="text-border">·</span>
            <span>{tApp("tagline")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{tFooter("rights")}</p>
        </div>
      </footer>
    </div>
  );
}
