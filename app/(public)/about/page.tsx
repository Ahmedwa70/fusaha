import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AboutPage } from "./_components/about-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default function Page() {
  return <AboutPage />;
}
