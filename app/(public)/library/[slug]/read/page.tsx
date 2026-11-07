import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublishedLibraryBookBySlug } from "@/lib/library/public-books";
import { resolveLibraryBookAccess } from "@/lib/library/viewer";
import { resolveLocalizedText } from "@/lib/localized-text";
import { ROUTES } from "@/constants/routes";
import { localeDirections, type Locale } from "@/i18n/config";

// In-platform PDF reader. The iframe loads only the same-origin stream
// route, which enforces the read policy and proxies bytes from the private
// bucket — the R2 object URL is never exposed to the browser.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/library/[slug]/read">): Promise<Metadata> {
  const t = await getTranslations("libraryPage");
  const locale = (await getLocale()) as Locale;
  const book = await getPublishedLibraryBookBySlug((await params).slug);
  const title = book ? resolveLocalizedText(book.displayTitle, locale) : "";
  return book ? { title: `${title} | ${t("readerTitleSuffix")}` } : { title: t("notFoundTitle") };
}

export default async function LibraryBookReaderPage({ params }: PageProps<"/library/[slug]/read">) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("libraryPage");
  const [book, access] = await Promise.all([getPublishedLibraryBookBySlug(slug), resolveLibraryBookAccess(slug)]);
  if (!book) redirect(ROUTES.library);
  if (!access.viewer) redirect(ROUTES.login);
  const direction = localeDirections[locale];
  const title = resolveLocalizedText(book.displayTitle, locale);
  const denied = !access.read.allowed;
  return (
    <div dir={direction} className="flex min-h-full flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 sm:px-8">
        <Link href={`/library/${book.slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:text-gold-600">
          <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
          {t("readerBackToBook")}
        </Link>
        <h1 className="font-heading text-lg font-bold">{title}</h1>
        {access.download.allowed ? (
          <a href={`/api/library/books/${book.slug}/download`} className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            {t("downloadBook")}
          </a>
        ) : <span className="w-24" aria-hidden="true" />}
      </header>
      <main className="flex-1 px-3 py-4 sm:px-6">
        {denied ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <p className="font-bold">{t("accessTitle")}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("readRequiresAccess")}</p>
          </div>
        ) : (
          <iframe title={title} src={`/api/library/books/${book.slug}/stream`} className="h-[82vh] w-full rounded-2xl border border-border bg-card" />
        )}
      </main>
    </div>
  );
}
