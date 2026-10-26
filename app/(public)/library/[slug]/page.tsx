import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getLibraryBook, libraryBooks } from "@/content/library";
import { ROUTES } from "@/constants/routes";
import { localeDirections } from "@/i18n/config";

export function generateStaticParams() { return libraryBooks.filter((book) => book.reviewStatus === "verified").map((book) => ({ slug: book.slug })); }
export async function generateMetadata({ params }: PageProps<"/library/[slug]">): Promise<Metadata> {
  const t = await getTranslations("libraryPage");
  const book = getLibraryBook((await params).slug);
  return book && book.reviewStatus === "verified" ? { title: `${t(`books.${book.slug}.title`)} | ${t("metaTitle")}`, description: t(`books.${book.slug}.description`) } : { title: t("notFoundTitle") };
}

export default async function LibraryBookPage({ params }: PageProps<"/library/[slug]">) {
  const locale = await getLocale();
  const t = await getTranslations("libraryPage");
  const book = getLibraryBook((await params).slug);
  if (!book || book.reviewStatus !== "verified") notFound();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  const title = t(`books.${book.slug}.title`);
  const sourceLabel = book.source ? <p className="mt-4 text-sm text-muted-foreground">{t("source")}: {book.source.name}</p> : null;
  return <div dir={direction} className="min-h-full bg-background text-foreground"><main className="px-5 py-12 sm:px-8 lg:py-20"><div className="mx-auto max-w-5xl"><Link href={ROUTES.library} className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:text-gold-600"><ArrowRightIcon data-icon="inline-start" aria-hidden="true" />{t("backToLibrary")}</Link><article className="mt-8 grid overflow-hidden rounded-3xl border border-gold-200 bg-card shadow-sm dark:border-border lg:grid-cols-[0.8fr_1.2fr]"><div className="relative flex min-h-72 items-center justify-center overflow-hidden bg-secondary">{book.cover ? <Image src={book.cover} alt={t(`books.${book.slug}.coverAlt`)} fill className="object-cover" sizes="(min-width: 1024px) 40vw, 100vw" /> : <BookOpenIcon className="size-20 text-gold-600" aria-hidden="true" />}</div><div className="p-6 text-start sm:p-10"><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t(`categories.${book.category}`)}</p><h1 className="mt-3 font-heading text-3xl font-bold text-card-foreground sm:text-4xl">{title}</h1><p className="mt-3 text-muted-foreground">{t("by")}: {t(`books.${book.slug}.author`)}</p>{book.publisher ? <p className="mt-2 text-muted-foreground">{t("publisher")}: {book.publisher}</p> : null}<div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{t("level")}: {t(`levels.${book.level}`)}</span><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{t("audience")}: {t(`books.${book.slug}.audience`)}</span></div><p className="mt-7 leading-8 text-muted-foreground">{t(`books.${book.slug}.description`)}</p>{sourceLabel}<div className="mt-8 rounded-2xl border border-gold-200 bg-gold-50/50 p-5 dark:border-border dark:bg-secondary/50"><p className="font-bold">{t("accessTitle")}</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`access.${book.access.status}`)}</p>{book.source && book.access.href ? <a href={book.access.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">{t("accessAction")}<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" /></a> : null}</div></div></article></div></main></div>;
}
