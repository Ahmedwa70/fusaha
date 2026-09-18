"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { templates, schemaDefinitions } from "@/database/schema";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { ROUTES } from "@/constants/routes";
import {
  createTemplateSchema,
  updateTemplateSchema,
  type CreateTemplateValues,
  type UpdateTemplateValues,
} from "@/validation/templates";
import { bundleTemplateZip, type BundleReport, type BundleError } from "@/lib/templates/bundle-zip";

export type TemplateActionState = { error: string } | { success: true };

export type BundleTemplateZipState =
  | { error: BundleError }
  | { success: true; html: string; blueprint: string; validationScript: string; report: BundleReport };

export async function bundleTemplateZipAction(formData: FormData): Promise<BundleTemplateZipState> {
  await requirePermission(Permissions.templatesCreate);

  const file = formData.get("zip");
  if (!(file instanceof File) || file.size === 0) return { error: "invalidZip" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await bundleTemplateZip(buffer);
  if (!result.ok) return { error: result.error };
  return { success: true, html: result.html, blueprint: result.blueprint, validationScript: result.validationScript, report: result.report };
}

export async function createTemplate(data: CreateTemplateValues): Promise<TemplateActionState> {
  const admin = await requirePermission(Permissions.templatesCreate);

  const tValidation = await getTranslations("validation.templates");
  const tErrors = await getTranslations("admin.templates.errors");
  const parsed = createTemplateSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, htmlPlayer, blueprint, validationScript, previewImage, active } = parsed.data;

  const [created] = await db
    .insert(templates)
    .values({ name, htmlPlayer, blueprint, validationScript, previewImage, active })
    .returning({ id: templates.id });

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.templatesCreate,
    resourceType: "template",
    resourceId: created.id,
    newValues: { name, active },
  });

  revalidatePath(ROUTES.adminTemplates);
  return { success: true };
}

export async function updateTemplate(id: string, data: UpdateTemplateValues): Promise<TemplateActionState> {
  const admin = await requirePermission(Permissions.templatesUpdate);

  const tValidation = await getTranslations("validation.templates");
  const tErrors = await getTranslations("admin.templates.errors");
  const parsed = updateTemplateSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, htmlPlayer, blueprint, validationScript, previewImage, active } = parsed.data;

  const [existing] = await db
    .select({ name: templates.name, active: templates.active })
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  await db
    .update(templates)
    .set({ name, htmlPlayer, blueprint, validationScript, previewImage, active, updatedAt: new Date() })
    .where(eq(templates.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.templatesUpdate,
    resourceType: "template",
    resourceId: id,
    oldValues: existing,
    newValues: { name, active },
  });

  revalidatePath(ROUTES.adminTemplates);
  return { success: true };
}

export async function deleteTemplate(id: string): Promise<TemplateActionState> {
  const admin = await requirePermission(Permissions.templatesDelete);

  const tErrors = await getTranslations("admin.templates.errors");
  const [existing] = await db
    .select({ name: templates.name, active: templates.active })
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  // schema_definitions.template_id is ON DELETE RESTRICT — check first so the
  // admin gets a sentence explaining why instead of a raw FK violation.
  const [linkedSchema] = await db
    .select({ id: schemaDefinitions.id })
    .from(schemaDefinitions)
    .where(eq(schemaDefinitions.templateId, id))
    .limit(1);
  if (linkedSchema) return { error: tErrors("templateInUse") };

  await db.delete(templates).where(eq(templates.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.templatesDelete,
    resourceType: "template",
    resourceId: id,
    oldValues: existing,
  });

  revalidatePath(ROUTES.adminTemplates);
  return { success: true };
}
