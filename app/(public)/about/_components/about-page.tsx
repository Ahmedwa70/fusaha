import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, CompassIcon, GraduationCapIcon, HeartHandshakeIcon, LightbulbIcon, TargetIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const principles = ["objectives", "structure", "purpose", "progression", "assessment", "support"] as const;

export function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="min-h-full overflow-hidden bg-background text-foreground">
      <section className="relative isolate overflow-hidden border-b border-gold-100 bg-[radial-gradient(circle_at_14%_18%,rgba(184,145,77,0.18),transparent_28%),radial-gradient(circle_at_88%_76%,rgba(15,86,78,0.12),transparent_30%),linear-gradient(120deg,#f6f1e4,#fbfaf5_52%,#f1ede1)] px-5 py-16 dark:bg-[radial-gradient(circle_at_14%_18%,rgba(184,145,77,0.12),transparent_28%),radial-gradient(circle_at_88%_76%,rgba(15,86,78,0.14),transparent_30%),linear-gradient(120deg,hsl(var(--background)),hsl(var(--background)))] sm:px-8 sm:py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1400px] items-end gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div className="max-w-3xl text-start">
            <p className="mb-5 text-sm font-bold tracking-[0.16em] text-gold-700 uppercase">{t("heroEyebrow")}</p>
            <h1 className="max-w-4xl font-heading text-4xl font-bold leading-[1.12] tracking-tight text-brand-950 [text-wrap:balance] dark:text-foreground sm:text-6xl lg:text-7xl">{t("heroTitle")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-brand-900/75 dark:text-brand-100/80 sm:text-xl">{t("heroDescription")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground" nativeButton={false} render={<Link href={ROUTES.products} />}>{t("heroPrimary")} <ArrowLeftIcon data-icon="inline-end" /></Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href={ROUTES.resources} />}>{t("heroSecondary")}</Button>
            </div>
          </div>
          <div className="relative rounded-[2rem] border border-gold-200 bg-white/60 p-6 shadow-[0_24px_70px_rgba(38,48,43,0.1)] backdrop-blur-sm dark:border-border dark:bg-card/70 sm:p-8">
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
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div><p className="text-sm font-bold tracking-[0.16em] text-gold-700 uppercase">{t("whyEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("whyTitle")}</h2></div>
          <div className="space-y-5 text-base leading-8 text-brand-900/75 dark:text-brand-100/75 sm:text-lg"><p>{t("whyBody1")}</p><p>{t("whyBody2")}</p></div>
        </div>
      </section>

      <section className="border-y border-gold-100 bg-[#f5f2e9] px-5 py-16 dark:bg-card/40 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24"><div><p className="text-sm font-bold tracking-[0.16em] text-gold-700 uppercase">{t("visionEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("visionTitle")}</h2></div><p className="text-lg leading-9 text-brand-900/75 dark:text-brand-100/75 sm:text-xl">{t("visionBody")}</p></div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1200px]"><div className="max-w-2xl"><p className="text-sm font-bold tracking-[0.16em] text-gold-700 uppercase">{t("approachEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-brand-950 dark:text-foreground sm:text-5xl">{t("approachTitle")}</h2><p className="mt-4 leading-8 text-brand-900/70 dark:text-brand-100/70">{t("approachDescription")}</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{principles.map((key, index) => <article key={key} className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm"><span className="flex size-10 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-5 font-heading text-xl font-bold text-card-foreground">{t(`principles.${key}.title`)}</h3><p className="mt-3 text-sm leading-7 text-brand-800 dark:text-brand-100/70">{t(`principles.${key}.body`)}</p></article>)}</div></div></section>

      <section className="border-y border-gold-100 bg-foreground px-5 py-16 text-background dark:bg-background dark:text-foreground sm:px-8 lg:py-24"><div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24"><div><p className="text-sm font-bold tracking-[0.16em] text-gold-300 uppercase">{t("audienceEyebrow")}</p><h2 className="mt-4 font-heading text-3xl font-bold sm:text-5xl">{t("audienceTitle")}</h2></div><div className="grid gap-4 sm:grid-cols-3">{[[GraduationCapIcon, "teachers"], [UsersIcon, "learners"], [HeartHandshakeIcon, "institutions"]].map(([Icon, key]) => <div key={key as string} className="rounded-2xl border border-white/15 bg-white/5 p-5"><span className="flex size-10 items-center justify-center rounded-full bg-gold-300 text-brand-950"><Icon /></span><h3 className="mt-5 font-bold">{t(`audiences.${key}.title`)}</h3><p className="mt-2 text-sm leading-7 text-background/70 dark:text-muted-foreground">{t(`audiences.${key}.body`)}</p></div>)}</div></div></section>

      <section className="px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-3xl text-center"><TargetIcon className="mx-auto size-11 text-gold-600" strokeWidth={1.5} /><h2 className="mt-5 font-heading text-3xl font-bold text-brand-950 dark:text-foreground sm:text-5xl">{t("principlesTitle")}</h2><p className="mt-4 leading-8 text-brand-900/70 dark:text-brand-100/70">{t("principlesDescription")}</p><div className="mt-8 flex flex-wrap justify-center gap-3">{["value", "clarity", "respect", "improvement"].map((key) => <span key={key} className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-2 text-sm font-semibold text-brand-900 dark:border-border dark:bg-secondary dark:text-foreground"><CheckIcon className="size-4 text-gold-600" />{t(`values.${key}`)}</span>)}</div></div></section>

      <section className="mx-5 mb-16 rounded-[2rem] bg-[#f3f7f2] px-6 py-12 text-center dark:bg-card/50 sm:mx-8 sm:px-10 lg:mb-24 lg:py-16"><h2 className="font-heading text-3xl font-bold text-brand-950 dark:text-foreground sm:text-5xl">{t("closingTitle")}</h2><p className="mx-auto mt-4 max-w-2xl leading-8 text-brand-900/70 dark:text-brand-100/70">{t("closingDescription")}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button size="lg" className="bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground" nativeButton={false} render={<Link href={ROUTES.products} />}>{t("closingPrimary")}</Button><Button size="lg" variant="outline" nativeButton={false} render={<Link href={ROUTES.help} />}>{t("closingSecondary")}</Button></div></section>
    </div>
  );
}
