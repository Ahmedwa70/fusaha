import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { HelpBrowser } from "@/app/(public)/help/_components/help-browser";
import { localeDirections } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("helpPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function HelpPage() {
  const locale = await getLocale();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  return (
    <div dir={direction} className="min-h-full bg-background text-foreground">
            <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-6 sm:px-8 lg:gap-6 lg:pb-24 lg:pt-10">
        <HelpBrowser />
      </main>
    </div>
  );
}
