import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublishedLibraryBookBySlug } from "@/lib/library/public-books";
import { resolveLibraryBookAccess } from "@/lib/library/viewer";
import { resolveLocalizedText } from "@/lib/localized-text";
import { ROUTES } from "@/constants/routes";
import { localeDirections, type Locale } from "@/i18n/config";

// Detail pages resolve from library_books at request time; the slug space is
// open-ended, so there is nothing meaningful to pre-render.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/library/[slug]">): Promise<Metadata> {
  const t = await getTranslations("libraryPage");
  const locale = (await getLocale()) as Locale;
  const book = await getPublishedLibraryBookBySlug((await params).slug);
  const title = book ? resolveLocalizedText(book.displayTitle, locale) : "";
  const description = book ? resolveLocalizedText(book.description, locale) : "";
  return book ? { title: `${title} | ${t("metaTitle")}`, description } : { title: t("notFoundTitle") };
}

export default async function LibraryBookPage({ params }: PageProps<"/library/[slug]">) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("libraryPage");
  const book = await getPublishedLibraryBookBySlug((await params).slug);
  if (!book) notFound();
  const direction = localeDirections[locale];
  const title = resolveLocalizedText(book.displayTitle, locale);
  const description = resolveLocalizedText(book.longDescription, locale) || resolveLocalizedText(book.description, locale);
  const coverAlt = resolveLocalizedText(book.coverAlt, locale) || title;
  const accessNotes = resolveLocalizedText(book.accessNotes, locale);
  const access = await resolveLibraryBookAccess(book.slug);
  const gatedButtons = access.read.allowed
    ? <Link href={`/library/${book.slug}/read`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90">{t("readBook")}</Link>
    : access.viewer
      ? null
      : <Link href={ROUTES.login} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90">{t("signInToRead")}</Link>;
  const downloadButton = access.download.allowed
    ? <a href={`/api/library/books/${book.slug}/download`} className="ms-2 mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary">{t("downloadBook")}</a>
    : null;
  return <div dir={direction} className="min-h-full bg-background text-foreground"><main className="px-5 py-12 sm:px-8 lg:py-20"><div className="mx-auto max-w-5xl"><Link href={ROUTES.library} className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:text-gold-600"><ArrowRightIcon data-icon="inline-start" aria-hidden="true" />{t("backToLibrary")}</Link><article className="mt-8 grid overflow-hidden rounded-3xl border border-gold-200 bg-card shadow-sm dark:border-border lg:grid-cols-[0.8fr_1.2fr]"><div className="relative flex min-h-72 items-center justify-center overflow-hidden bg-secondary">{book.coverUrl ? <Image src={book.coverUrl} alt={coverAlt} fill className="object-cover" sizes="(min-width: 1024px) 40vw, 100vw" /> : <BookOpenIcon className="size-20 text-gold-600" aria-hidden="true" />}</div><div className="p-6 text-start sm:p-10"><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{book.category}</p><h1 className="mt-3 font-heading text-3xl font-bold text-card-foreground sm:text-4xl">{title}</h1><p className="mt-3 text-muted-foreground">{t("by")}: {book.authors}</p>{book.publisher ? <p className="mt-2 text-muted-foreground">{t("publisher")}: {book.publisher}</p> : null}<div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{t("level")}: {book.level}</span><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{t("audience")}: {book.audience}</span></div><p className="mt-7 leading-8 text-muted-foreground">{description}</p><p className="mt-4 text-sm text-muted-foreground">{t("source")}: {book.sourceName}</p><div className="mt-8 rounded-2xl border border-gold-200 bg-gold-50/50 p-5 dark:border-border dark:bg-secondary/50"><p className="font-bold">{t("accessTitle")}</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`access.${book.accessStatus}`)}</p>{accessNotes ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{accessNotes}</p> : null}<a href={book.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">{t("accessAction")}<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" /></a>{gatedButtons}{downloadButton}</div></div></article></div></main></div>;
}
