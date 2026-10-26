import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const faqItems = ["products", "pricing", "help"] as const;

export function PricingPage() {
  const t = useTranslations("pricingPage");

  return (
    <div className="min-h-full overflow-hidden bg-background text-foreground">
      <section className="border-y border-gold-100 bg-[#f5f2e9] px-5 py-16 dark:bg-card/40 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1000px] items-center gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("statusEyebrow")}</p>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("statusTitle")}</h1>
          </div>
          <div className="rounded-3xl border border-gold-200 bg-background/75 p-7 shadow-sm dark:border-border dark:bg-background sm:p-9">
            <p className="text-lg leading-9 text-brand-900/80 dark:text-brand-100/80">{t("statusDescription")}</p>
            <p className="mt-5 border-t border-border pt-5 font-semibold leading-8 text-brand-950 dark:text-foreground">{t("statusNote")}</p>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("faqEyebrow")}</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-brand-950 dark:text-foreground sm:text-5xl">{t("faqTitle")}</h2>
          </div>
          <div className="mt-10 flex flex-col gap-3">
            {faqItems.map((key) => (
              <details key={key} className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold marker:hidden group-open:text-gold-700 dark:group-open:text-gold-300">
                  <span>{t(`faq.${key}.question`)}</span>
                  <span aria-hidden="true" className="text-2xl font-normal text-gold-600 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pt-4 leading-8 text-muted-foreground">{t(`faq.${key}.answer`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-5 mb-16 rounded-[2rem] bg-foreground px-6 py-12 text-center text-background dark:bg-card dark:text-foreground sm:mx-8 sm:px-10 lg:mb-24 lg:py-16">
        <h2 className="font-heading text-3xl font-bold sm:text-5xl">{t("closingTitle")}</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-background/75 dark:text-muted-foreground">{t("closingDescription")}</p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" variant="secondary" nativeButton={false} render={<Link href={ROUTES.products} />}>
            {t("closingProducts")} <ArrowLeftIcon data-icon="inline-end" />
          </Button>
        </div>
      </section>
    </div>
  );
}
