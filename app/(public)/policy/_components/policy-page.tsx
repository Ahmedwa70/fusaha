import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon, BookOpenIcon } from "lucide-react";
import { ROUTES } from "@/constants/routes";

const sectionIds = ["purpose", "use", "property", "library", "materials", "reports", "external", "updates"] as const;

export async function PolicyPage() {
  const t = await getTranslations("policyPage");
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">
      <header className="max-w-3xl border-b border-border pb-10">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300"><BookOpenIcon aria-hidden="true" /></div>
        <p className="mt-6 text-sm font-bold text-gold-700 dark:text-gold-300">{t("eyebrow")}</p>
        <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-brand-950 dark:text-brand-50 sm:text-5xl">{t("title")}</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={t("contentsLabel")} className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="font-heading text-base font-bold">{t("contents")}</h2>
          <ol className="mt-4 flex flex-col gap-2 border-s-2 border-gold-200 ps-4 text-sm text-muted-foreground dark:border-border">
            {sectionIds.map((id, index) => <li key={id}><a className="block leading-6 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`#${id}`}>{index + 1}. {t(`sections.${id}.title`)}</a></li>)}
          </ol>
        </nav>

        <div className="max-w-3xl">
          <p className="mb-8 rounded-xl border border-gold-200 bg-gold-50 px-5 py-4 text-sm leading-7 text-brand-900 dark:border-border dark:bg-card dark:text-muted-foreground">{t("notice")}</p>
          <div className="flex flex-col gap-10">
            {sectionIds.map((id, index) => (
              <section key={id} id={id} className="scroll-mt-8 border-b border-border pb-10 last:border-b-0" aria-labelledby={`${id}-heading`}>
                <p className="text-sm font-bold text-gold-700 dark:text-gold-300">{String(index + 1).padStart(2, "0")}</p>
                <h2 id={`${id}-heading`} className="mt-2 font-heading text-2xl font-bold text-brand-950 dark:text-brand-50">{t(`sections.${id}.title`)}</h2>
                <div className="mt-4 flex flex-col gap-4 text-[0.98rem] leading-8 text-muted-foreground">{t.raw(`sections.${id}.paragraphs`).map((paragraph: string) => <p key={paragraph}>{paragraph}</p>)}</div>
              </section>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href={ROUTES.home} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t("backHome")} <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" /></Link>
            <Link href={ROUTES.help} className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t("helpLink")}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
