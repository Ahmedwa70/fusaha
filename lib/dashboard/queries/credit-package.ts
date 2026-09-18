import "server-only";
import { eq, asc } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { creditPackages } from "@/database/schema";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Locale } from "@/i18n/config";

export type CreditPackageOption = {
  id: string;
  name: string;
  creditsAmount: number;
  price: number;
  currency: string;
  badgeLabel: string | null;
  subtitle: string | null;
  footerText: string | null;
  features: string[];
  colorDark: string | null;
};

// The display fields are stored per locale (see
// database/schema/credit-packages.ts); they are resolved to the teacher's
// locale here so the pricing card only ever deals in plain strings.
export async function getActiveCreditPackages(): Promise<CreditPackageOption[]> {
  const locale = (await getLocale()) as Locale;
  const rows = await db
    .select({
      id: creditPackages.id,
      name: creditPackages.name,
      creditsAmount: creditPackages.creditsAmount,
      price: creditPackages.price,
      currency: creditPackages.currency,
      badgeLabel: creditPackages.badgeLabel,
      subtitle: creditPackages.subtitle,
      footerText: creditPackages.footerText,
      features: creditPackages.features,
      colorDark: creditPackages.colorDark,
    })
    .from(creditPackages)
    .where(eq(creditPackages.active, true))
    .orderBy(asc(creditPackages.creditsAmount));

  return rows.map((row) => {
    const badgeLabel = resolveLocalizedText(row.badgeLabel, locale);
    const subtitle = resolveLocalizedText(row.subtitle, locale);
    const footerText = resolveLocalizedText(row.footerText, locale);

    return {
      ...row,
      name: resolveLocalizedText(row.name, locale),
      badgeLabel: badgeLabel || null,
      subtitle: subtitle || null,
      footerText: footerText || null,
      features: row.features.map((feature) => resolveLocalizedText(feature, locale)).filter((text) => !!text),
    };
  });
}
