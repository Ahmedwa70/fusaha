"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpenIcon, RotateCcwIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { libraryCategories, libraryLevels, publishedLibraryBooks, type LibraryBook } from "@/content/library";

function BookCard({ book, t }: { book: LibraryBook; t: (key: string, values?: Record<string, string | number>) => string }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold-200 bg-card shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg dark:border-border">
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-secondary">
        {book.cover ? <Image src={book.cover} alt={t(`books.${book.slug}.coverAlt`)} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" /> : <BookOpenIcon className="size-14 text-gold-600" aria-hidden="true" />}
        <Badge className="absolute inset-e-4 top-4 bg-card/95 text-foreground shadow-sm dark:text-card-foreground">{t(`books.${book.slug}.level`)}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-5 text-start">
        <div className="flex items-start justify-between gap-3"><h2 className="font-heading text-xl font-bold text-foreground dark:text-card-foreground">{t(`books.${book.slug}.title`)}</h2><BookOpenIcon className="mt-1 size-5 shrink-0 text-gold-600" aria-hidden="true" /></div>
        <p className="mt-2 text-sm text-muted-foreground">{t(`books.${book.slug}.author`)}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{t(`categories.${book.category}`)}</Badge><Badge variant="outline">{t(`books.${book.slug}.audience`)}</Badge></div>
        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">{t(`books.${book.slug}.description`)}</p>
        {book.source ? <p className="mt-4 text-xs text-muted-foreground">{t("source")}: {book.source.name}</p> : null}
        <Link href={`/library/${book.slug}`} className="mt-5 inline-flex w-fit items-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90">{t("viewDetails")}</Link>
      </div>
    </article>
  );
}

export function LibraryBrowser() {
  const t = useTranslations("libraryPage");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const books = useMemo(() => publishedLibraryBooks.map((book) => ({ ...book, title: t(`books.${book.slug}.title`), author: t(`books.${book.slug}.author`), category: t(`categories.${book.category}`), level: t(`levels.${book.level}`), audience: t(`books.${book.slug}.audience`), description: t(`books.${book.slug}.description`) })), [t]);
  const filteredBooks = useMemo(() => books.filter((book) => `${book.title} ${book.author} ${book.category} ${book.level} ${book.audience} ${book.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (category === "all" || book.category === category) && (level === "all" || book.level === level)), [books, category, level, query]);
  const resetFilters = () => { setQuery(""); setCategory("all"); setLevel("all"); };

  return <>
    <section className="rounded-2xl border border-gold-200 bg-card p-4 shadow-sm dark:border-border sm:p-5" aria-label={t("filtersLabel")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <label className="relative flex-1"><span className="sr-only">{t("searchLabel")}</span><SearchIcon className="absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} className="h-11 ps-10" /></label>
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><SlidersHorizontalIcon className="size-4" aria-hidden="true" /><span>{t("filter")}</span></div>
        <label><span className="sr-only">{t("categoryLabel")}</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">{t("all")}</option>{libraryCategories.map((item) => <option key={item} value={t(`categories.${item}`)}>{t(`categories.${item}`)}</option>)}</select></label>
        <label><span className="sr-only">{t("levelLabel")}</span><select value={level} onChange={(event) => setLevel(event.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">{t("all")}</option>{libraryLevels.map((item) => <option key={item} value={t(`levels.${item}`)}>{t(`levels.${item}`)}</option>)}</select></label>
        <Button type="button" variant="outline" size="sm" onClick={resetFilters}><RotateCcwIcon data-icon="inline-start" aria-hidden="true" />{t("reset")}</Button>
      </div>
    </section>
    <p className="mt-6 text-sm text-muted-foreground">{t("publishedCount", { count: filteredBooks.length })}</p>
    {filteredBooks.length > 0 ? <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{filteredBooks.map((book) => <BookCard key={book.slug} book={book} t={t} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-14 text-center"><BookOpenIcon className="mx-auto size-10 text-gold-600" aria-hidden="true" /><p className="mt-4 font-bold">{t("emptyTitle")}</p><p className="mt-2 text-sm text-muted-foreground">{t("emptyDescription")}</p></div>}
  </>;
}
