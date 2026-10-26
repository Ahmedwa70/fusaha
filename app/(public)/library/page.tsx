import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookOpenIcon, LibraryBigIcon } from "lucide-react";
import { LibraryBrowser } from "@/app/(public)/library/_components/library-browser";
import { localeDirections } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("libraryPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LibraryPage() {
  const locale = await getLocale();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  const t = await getTranslations("libraryPage");
  return <div dir={direction} className="min-h-full overflow-hidden bg-background text-foreground"><main><section className="border-y border-border bg-background px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-4xl text-center"><LibraryBigIcon className="mx-auto size-12 text-gold-600" aria-hidden="true" /><p className="mt-4 text-sm font-bold text-gold-700 dark:text-gold-300">{t("eyebrow")}</p><h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl">{t("title")}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{t("description")}</p></div></section><section className="px-5 py-12 sm:px-8 lg:py-16"><div className="mx-auto max-w-6xl"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{t("catalog")}</p><h2 className="mt-2 font-heading text-3xl font-bold text-foreground">{t("explore")}</h2></div><BookOpenIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" /></div><LibraryBrowser /></div></section></main></div>;
}
