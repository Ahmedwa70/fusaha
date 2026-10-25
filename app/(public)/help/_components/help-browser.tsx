"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpenIcon, ChevronDownIcon, HeadphonesIcon, MessagesSquareIcon, SearchIcon, WrenchIcon } from "lucide-react";
import { helpArticles, helpCategories, type HelpCategory } from "@/content/help";

const categoryIcons = { book: BookOpenIcon, messages: MessagesSquareIcon, wrench: WrenchIcon, headphones: HeadphonesIcon } as const;

export function HelpBrowser() {
  const t = useTranslations("helpPage");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "all">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const articles = useMemo(() => helpArticles.map((article) => ({ ...article, question: t(`articles.${article.id}.question`), answer: t(`articles.${article.id}.answer`) })), [t]);
  const filteredArticles = useMemo(() => articles.filter((article) => {
    const matchesCategory = category === "all" || article.category === category;
    const searchable = `${article.question} ${article.answer}`.toLocaleLowerCase();
    return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [articles, category, normalizedQuery]);

  return (
    <>
      <section className="rounded-[2rem] border border-border bg-card/75 px-5 py-12 text-center shadow-sm sm:px-10 lg:py-16">
        <SearchIcon className="mx-auto size-10 text-gold-500" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">{t("description")}</p>
        <label className="mx-auto mt-8 flex max-w-4xl items-center gap-3 rounded-2xl border border-border bg-muted/70 px-5 py-4 text-start transition-colors focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/20">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t("searchLabel")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={t("searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" aria-label={t("searchLabel")} />
        </label>
      </section>

      <nav className="grid gap-4 sm:grid-cols-2" aria-label={t("categoriesLabel")}>
        {helpCategories.map((item) => {
          const Icon = categoryIcons[item.icon as keyof typeof categoryIcons];
          const isActive = item.id !== "contact" && category === item.id;
          return item.id === "contact" ? (
            <a key={item.id} href="#contact" className="group rounded-2xl border border-border bg-card p-6 text-start transition-colors hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
              <Icon className="size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold">{t(`categories.${item.id}.title`)}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`categories.${item.id}.description`)}</p>
            </a>
          ) : (
            <button key={item.id} type="button" onClick={() => setCategory(isActive ? "all" : item.id)} aria-pressed={isActive} className="group rounded-2xl border border-border bg-card p-6 text-start transition-colors hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 aria-pressed:border-gold-500 aria-pressed:bg-gold-500/5">
              <Icon className="size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold">{t(`categories.${item.id}.title`)}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`categories.${item.id}.description`)}</p>
            </button>
          );
        })}
      </nav>

      <section className="rounded-2xl border border-border bg-card px-5 sm:px-7" aria-labelledby="faq-heading">
        <div className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-gold-500">{t("verifiedEyebrow")}</p><h2 id="faq-heading" className="mt-2 text-2xl font-bold">{t("faqTitle")}</h2></div><span className="text-sm text-muted-foreground">{t("resultsCount", { count: filteredArticles.length })}</span></div>
        {filteredArticles.length > 0 ? <div>{filteredArticles.map((article) => <details key={article.id} className="group border-b border-border last:border-b-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-base font-semibold marker:hidden [&::-webkit-details-marker]:hidden"><span>{article.question}</span><ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="max-w-3xl pb-6 text-sm leading-8 text-muted-foreground"><p>{article.answer}</p>{article.href && <Link href={article.href} className="mt-3 inline-flex text-sm font-bold text-gold-600 underline-offset-4 hover:underline">{t("relatedLink")}</Link>}</div></details>)}</div> : <div className="py-14 text-center"><SearchIcon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-4 font-bold">{t("emptyTitle")}</p><p className="mt-2 text-sm text-muted-foreground">{t("emptyDescription")}</p></div>}
      </section>

      <section id="contact" className="scroll-mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center"><HeadphonesIcon className="mx-auto size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-4 text-xl font-bold">{t("contactTitle")}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{t("contactDescription")}</p></section>
    </>
  );
}
