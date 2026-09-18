"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { creditPackages } from "@/database/schema";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import {
  createCreditPackageSchema,
  updateCreditPackageSchema,
  type CreateCreditPackageValues,
  type UpdateCreditPackageValues,
} from "@/validation/credit-packages";

export type CreditPackageActionState = { error: string } | { success: true };

export async function createCreditPackage(data: CreateCreditPackageValues): Promise<CreditPackageActionState> {
  const admin = await requirePermission(Permissions.creditPackagesCreate);

  const tValidation = await getTranslations("validation.creditPackages");
  const tErrors = await getTranslations("admin.creditPackages.errors");
  const parsed = createCreditPackageSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, creditsAmount, price, paddlePriceId, badgeLabel, subtitle, footerText, features, colorDark } =
    parsed.data;
  const priceCents = Math.round(price * 100);

  const [created] = await db
    .insert(creditPackages)
    .values({
      name,
      creditsAmount,
      price: priceCents,
      active: true,
      paddlePriceId,
      badgeLabel,
      subtitle,
      footerText,
      features,
      colorDark,
    })
    .returning({ id: creditPackages.id });

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.creditPackagesCreate,
    resourceType: "credit-package",
    resourceId: created.id,
    newValues: {
      name,
      creditsAmount,
      price: priceCents,
      paddlePriceId,
      badgeLabel,
      subtitle,
      footerText,
      features,
      colorDark,
    },
  });

  revalidatePath("/admin/credit-packages");
  return { success: true };
}

export async function updateCreditPackage(
  id: string,
  data: UpdateCreditPackageValues
): Promise<CreditPackageActionState> {
  const admin = await requirePermission(Permissions.creditPackagesUpdate);

  const tValidation = await getTranslations("validation.creditPackages");
  const tErrors = await getTranslations("admin.creditPackages.errors");
  const parsed = updateCreditPackageSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, creditsAmount, price, active, paddlePriceId, badgeLabel, subtitle, footerText, features, colorDark } =
    parsed.data;
  const priceCents = Math.round(price * 100);

  const [existing] = await db
    .select({
      name: creditPackages.name,
      creditsAmount: creditPackages.creditsAmount,
      price: creditPackages.price,
      active: creditPackages.active,
      paddlePriceId: creditPackages.paddlePriceId,
      badgeLabel: creditPackages.badgeLabel,
      subtitle: creditPackages.subtitle,
      footerText: creditPackages.footerText,
      features: creditPackages.features,
      colorDark: creditPackages.colorDark,
    })
    .from(creditPackages)
    .where(eq(creditPackages.id, id))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  await db
    .update(creditPackages)
    .set({
      name,
      creditsAmount,
      price: priceCents,
      active,
      paddlePriceId,
      badgeLabel,
      subtitle,
      footerText,
      features,
      colorDark,
    })
    .where(eq(creditPackages.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.creditPackagesUpdate,
    resourceType: "credit-package",
    resourceId: id,
    oldValues: existing,
    newValues: {
      name,
      creditsAmount,
      price: priceCents,
      active,
      paddlePriceId,
      badgeLabel,
      subtitle,
      footerText,
      features,
      colorDark,
    },
  });

  revalidatePath("/admin/credit-packages");
  return { success: true };
}

export async function deleteCreditPackage(id: string): Promise<CreditPackageActionState> {
  const admin = await requirePermission(Permissions.creditPackagesDelete);

  const tErrors = await getTranslations("admin.creditPackages.errors");
  const [existing] = await db
    .select({
      name: creditPackages.name,
      creditsAmount: creditPackages.creditsAmount,
      price: creditPackages.price,
      currency: creditPackages.currency,
      active: creditPackages.active,
    })
    .from(creditPackages)
    .where(eq(creditPackages.id, id))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  await db.delete(creditPackages).where(eq(creditPackages.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.creditPackagesDelete,
    resourceType: "credit-package",
    resourceId: id,
    oldValues: existing,
  });

  revalidatePath("/admin/credit-packages");
  return { success: true };
}
