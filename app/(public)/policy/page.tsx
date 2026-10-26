import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { localeDirections } from "@/i18n/config";
import { PolicyPage } from "./_components/policy-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policyPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PlatformPolicyPage() {
  const locale = await getLocale();
  const direction = localeDirections[locale as keyof typeof localeDirections];
  return <div dir={direction} className="min-h-full bg-background text-foreground"><PolicyPage /></div>;
}
