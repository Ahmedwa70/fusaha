import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeftIcon, BookOpenIcon, PenLineIcon, WandSparklesIcon } from "lucide-react";
import { ResourceCard } from "@/app/(public)/resources/_components/resource-card";
import { resourceCatalog } from "@/content/resources";
import { ROUTES } from "@/constants/routes";
import { localeDirections } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("resourcesPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const tools = resourceCatalog.filter((resource) => resource.kind === "tool");
const educationalResources = resourceCatalog.filter((resource) => resource.kind === "educational");

export default async function ResourcesPage() {
  const locale = await getLocale();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  const t = await getTranslations("resourcesPage");
  return (
    <div dir={direction} className="min-h-full overflow-hidden bg-background text-foreground">
            <main>
        <section className="border-y border-border bg-background px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t("eyebrow")}</p>
            <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-foreground dark:text-brand-50 sm:text-5xl">{t("title")}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{t("description")}</p>
            <Link href={ROUTES.dashboardCreate} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t("heroAction")} <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 lg:py-20" aria-labelledby="tools-heading">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4 border-b border-gold-200 pb-5 dark:border-border">
              <div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t("availableEyebrow")}</p><h2 id="tools-heading" className="mt-2 font-heading text-3xl font-bold text-foreground dark:text-foreground">{t("toolsTitle")}</h2></div>
              <WandSparklesIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" />
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2">{tools.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
          </div>
        </section>

        <section className="border-y border-gold-100 bg-[#f7f4eb] px-5 py-14 dark:border-border dark:bg-background sm:px-8 lg:py-20" aria-labelledby="educational-heading">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4 border-b border-gold-200 pb-5 dark:border-border">
              <div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t("educationalEyebrow")}</p><h2 id="educational-heading" className="mt-2 font-heading text-3xl font-bold text-foreground dark:text-foreground">{t("educationalTitle")}</h2></div>
              <BookOpenIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" />
            </div>
            {educationalResources.length > 0 ? <div className="mt-8 grid gap-6 md:grid-cols-2">{educationalResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center"><BookOpenIcon className="mx-auto size-10 text-gold-600" aria-hidden="true" /><h3 className="mt-4 font-heading text-xl font-bold text-foreground dark:text-foreground">{t("emptyTitle")}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-foreground/75 dark:text-brand-100/70">{t("emptyDescription")}</p></div>}
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 lg:py-20"><div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl border border-transparent bg-foreground px-6 py-12 text-center text-background shadow-xl dark:border-border dark:bg-background dark:text-foreground sm:px-10"><PenLineIcon className="size-9 text-gold-300" aria-hidden="true" /><h2 className="mt-4 font-heading text-3xl font-bold">{t("ctaTitle")}</h2><p className="mt-3 max-w-xl leading-7 text-background/80 dark:text-muted-foreground">{t("ctaDescription")}</p><Link href={ROUTES.lessonStudio} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t("ctaAction")} <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" /></Link></div></section>
      </main>
    </div>
  );
}
