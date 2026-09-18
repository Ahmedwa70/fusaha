import "server-only";
import { db } from "@/lib/db";
import { creditPackages } from "@/database/schema";
import type { LocalizedText } from "@/lib/localized-text";

export type CreditPackageListItem = {
  id: string;
  name: LocalizedText;
  creditsAmount: number;
  price: number;
  currency: string;
  active: boolean;
  createdAt: Date;
  paddlePriceId: string | null;
  badgeLabel: LocalizedText | null;
  subtitle: LocalizedText | null;
  footerText: LocalizedText | null;
  features: LocalizedText[];
  colorDark: string | null;
};

export async function getCreditPackages(): Promise<CreditPackageListItem[]> {
  const rows = await db
    .select({
      id: creditPackages.id,
      name: creditPackages.name,
      creditsAmount: creditPackages.creditsAmount,
      price: creditPackages.price,
      currency: creditPackages.currency,
      active: creditPackages.active,
      createdAt: creditPackages.createdAt,
      paddlePriceId: creditPackages.paddlePriceId,
      badgeLabel: creditPackages.badgeLabel,
      subtitle: creditPackages.subtitle,
      footerText: creditPackages.footerText,
      features: creditPackages.features,
      colorDark: creditPackages.colorDark,
    })
    .from(creditPackages)
    .orderBy(creditPackages.createdAt);

  return rows;
}
