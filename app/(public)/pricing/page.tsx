import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PricingPage } from "./_components/pricing-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricingPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default function Page() {
  return <PricingPage />;
}
