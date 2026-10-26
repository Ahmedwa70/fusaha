import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon, CircleHelpIcon, CompassIcon, ExternalLinkIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const discoveryItems = ["products", "resources", "help"] as const;
const faqItems = ["products", "pricing", "help"] as const;

export function PricingPage() {
  const t = useTranslations("pricingPage");

  return (
    <div className="min-h-full overflow-hidden bg-background text-foreground">
      <section className="relative isolate overflow-hidden border-b border-gold-100 bg-[radial-gradient(circle_at_12%_14%,rgba(184,145,77,0.18),transparent_28%),radial-gradient(circle_at_88%_80%,rgba(15,86,78,0.12),transparent_30%),linear-gradient(120deg,#f6f1e4,#fbfaf5_52%,#f1ede1)] px-5 py-16 dark:bg-[radial-gradient(circle_at_12%_14%,rgba(184,145,77,0.12),transparent_28%),radial-gradient(circle_at_88%_80%,rgba(15,86,78,0.14),transparent_30%),linear-gradient(120deg,hsl(var(--background)),hsl(var(--background)))] sm:px-8 sm:py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="max-w-3xl text-start">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("heroEyebrow")}</p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.12] tracking-tight text-brand-950 [text-wrap:balance] dark:text-foreground sm:text-6xl">{t("heroTitle")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-brand-900/75 dark:text-brand-100/80 sm:text-xl">{t("heroDescription")}</p>
            <Button size="lg" className="mt-8 bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground" nativeButton={false} render={<Link href={ROUTES.products} />}>
              {t("heroCta")} <ArrowLeftIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="relative rounded-[2rem] border border-gold-200 bg-white/60 p-7 shadow-[0_24px_70px_rgba(38,48,43,0.1)] backdrop-blur-sm dark:border-border dark:bg-card/70 sm:p-9">
            <div className="absolute -top-4 end-8 rounded-full bg-gold-500 px-4 py-2 text-xs font-bold text-white shadow-sm">{t("heroBadge")}</div>
            <CompassIcon className="size-10 text-gold-600" strokeWidth={1.5} />
            <p className="mt-8 font-heading text-2xl font-bold leading-tight text-brand-950 dark:text-foreground sm:text-3xl">{t("heroCardTitle")}</p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm font-semibold text-brand-800 dark:text-brand-100/80">
              {["objectives", "planning", "practice", "assessment"].map((key) => <div key={key} className="rounded-xl border border-gold-100 bg-gold-50/70 px-3 py-3 dark:border-border dark:bg-secondary">{t(`heroCard.${key}`)}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("discoverEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("discoverTitle")}</h2><p className="mt-4 leading-8 text-muted-foreground">{t("discoverDescription")}</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {discoveryItems.map((key, index) => <article key={key} className="rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="flex size-11 items-center justify-center rounded-full bg-gold-100 text-gold-700 dark:bg-secondary dark:text-gold-300">{index === 0 ? <SparklesIcon /> : index === 1 ? <BookOpenIcon /> : <CircleHelpIcon />}</span><h3 className="mt-5 font-heading text-xl font-bold">{t(`discovery.${key}.title`)}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{t(`discovery.${key}.body`)}</p><Link href={ROUTES[key]} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:text-gold-800 dark:text-gold-300 dark:hover:text-gold-200">{t(`discovery.${key}.link`)} <ExternalLinkIcon data-icon="inline-end" /></Link></article>)}
          </div>
        </div>
      </section>

      <section className="border-y border-gold-100 bg-[#f5f2e9] px-5 py-16 dark:bg-card/40 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-24"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("statusEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("statusTitle")}</h2></div><div className="rounded-3xl border border-gold-200 bg-background/75 p-7 shadow-sm dark:border-border dark:bg-background sm:p-9"><p className="text-lg leading-9 text-brand-900/80 dark:text-brand-100/80">{t("statusDescription")}</p><p className="mt-5 border-t border-border pt-5 font-semibold leading-8 text-brand-950 dark:text-foreground">{t("statusNote")}</p></div></div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-3xl"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">{t("faqEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold text-brand-950 dark:text-foreground sm:text-5xl">{t("faqTitle")}</h2></div><div className="mt-10 flex flex-col gap-3">{faqItems.map((key) => <details key={key} className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold marker:hidden group-open:text-gold-700 dark:group-open:text-gold-300"><span>{t(`faq.${key}.question`)}</span><span aria-hidden="true" className="text-2xl font-normal text-gold-600 transition-transform group-open:rotate-45">+</span></summary><p className="max-w-2xl pt-4 leading-8 text-muted-foreground">{t(`faq.${key}.answer`)}</p></details>)}</div></div></section>

      <section className="mx-5 mb-16 rounded-[2rem] bg-foreground px-6 py-12 text-center text-background dark:bg-card dark:text-foreground sm:mx-8 sm:px-10 lg:mb-24 lg:py-16"><h2 className="font-heading text-3xl font-bold sm:text-5xl">{t("closingTitle")}</h2><p className="mx-auto mt-4 max-w-2xl leading-8 text-background/75 dark:text-muted-foreground">{t("closingDescription")}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button size="lg" variant="secondary" nativeButton={false} render={<Link href={ROUTES.products} />}>{t("closingProducts")}</Button><Button size="lg" variant="outline" className="border-background/40 bg-transparent text-background hover:bg-background/10 hover:text-background dark:border-border dark:text-foreground dark:hover:bg-secondary" nativeButton={false} render={<Link href={ROUTES.help} />}>{t("closingHelp")}</Button></div></section>
    </div>
  );
}
