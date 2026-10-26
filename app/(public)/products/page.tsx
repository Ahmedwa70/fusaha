import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon, PenLineIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";
import { localeDirections } from "@/i18n/config";
import { ROUTES } from "@/constants/routes";

export default async function ProductsPage() {
  const locale = await getLocale();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  const t = await getTranslations("products");
  const products = [
    {
      title: t("interactiveTitle"),
      description: t("interactiveDescription"),
      status: t("available"),
      image: "/images/hero-illustration.jpeg",
      icon: WandSparklesIcon,
      href: ROUTES.dashboardCreate,
      action: t("interactiveAction"),
      featured: true,
    },
    {
      title: t("writingTitle"),
      description: t("writingDescription"),
      status: t("informational"),
      image: "/images/features-illustration.jpeg",
      icon: PenLineIcon,
      href: ROUTES.lessonStudio,
      action: t("writingAction"),
      featured: false,
    },
  ];

  return (
    <div dir={direction} className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <main>
        <section className="border-y border-border bg-background px-6 py-16 sm:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t("eyebrow")}</p>
            <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-brand-950 dark:text-brand-50 sm:text-5xl">{t("title")}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{t("description")}</p>
          </div>
        </section>

        <section className="px-6 py-14 sm:px-10 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            {products.map(({ title, description, status, image, icon: Icon, href, action, featured }) => (
              <article key={title} className={`overflow-hidden rounded-3xl border p-3 shadow-sm ${featured ? "border-foreground bg-foreground text-background shadow-xl dark:border-border dark:bg-card dark:text-card-foreground" : "border-border bg-card"}`}>
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-brand-50 dark:bg-secondary">
                  <Image src={image} alt={t("productImageAlt", { title })} fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
                </div>
                <div className="p-5 text-start sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${featured ? "bg-gold-300 text-brand-950" : "bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300"}`}>{status}</span>
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${featured ? "bg-gold-300 text-brand-950" : "bg-gold-100 text-gold-700"}`}><Icon /></span>
                  </div>
                  <h2 className="mt-5 font-heading text-2xl font-bold">{title}</h2>
                  <p className={`mt-3 min-h-14 leading-8 ${featured ? "text-background/80 dark:text-muted-foreground" : "text-muted-foreground"}`}>{description}</p>
                  <Button className="mt-5" variant={featured ? "secondary" : "outline"} nativeButton={false} render={<Link href={href} />}>{action}<ArrowLeftIcon data-icon="inline-end" /></Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border px-6 py-14 sm:px-10 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-gold-100 text-gold-700"><BookOpenIcon /></span>
              <h2 className="mt-4 font-heading text-2xl font-bold text-brand-950 dark:text-foreground">{t("developmentTitle")}</h2>
              <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">{t("developmentDescription")}</p>
            </div>
            <article className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-sm">
              <div className="relative overflow-hidden rounded-2xl bg-secondary">
                <Image src="/images/arabic-letter-engine-light.png" alt={t("engineLightAlt")} width={2048} height={1152} className="h-auto w-full dark:hidden" />
                <Image src="/images/arabic-letter-engine-dark.png" alt={t("engineDarkAlt")} width={2048} height={1152} className="hidden h-auto w-full dark:block" />
              </div>
              <div className="p-5 text-start sm:p-6">
                <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-800 dark:bg-gold-500/15 dark:text-gold-300">{t("inDevelopment")}</span>
                <h3 className="mt-5 font-heading text-2xl font-bold">{t("engineTitle")}</h3>
                <p className="mt-3 leading-8 text-muted-foreground">{t("engineDescription")}</p>
              </div>
            </article>
          </div>
        </section>
      </main>

    </div>
  );
}
