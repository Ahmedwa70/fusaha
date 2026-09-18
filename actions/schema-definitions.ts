"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { schemaDefinitions, lessonVersions } from "@/database/schema";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { ROUTES } from "@/constants/routes";
import { createSchemaDefinitionSchema, type CreateSchemaDefinitionValues } from "@/validation/schema-definitions";

export type SchemaDefinitionActionState = { error: string } | { success: true };

// levelKey is a stable, non-translated identifier (e.g. "level-a1b2c3d4")
// used for uniqueness/lookups — never entered by an admin. Generated here by
// picking a random candidate and looping until it doesn't collide.
async function generateLevelKey(): Promise<string> {
  let candidate: string;
  let taken: boolean;
  do {
    candidate = `level-${crypto.randomUUID().slice(0, 8)}`;
    const [row] = await db
      .select({ id: schemaDefinitions.id })
      .from(schemaDefinitions)
      .where(eq(schemaDefinitions.levelKey, candidate))
      .limit(1);
    taken = !!row;
  } while (taken);
  return candidate;
}

export async function createSchemaDefinition(
  data: CreateSchemaDefinitionValues,
  // Passed only when adding a new version to an already-existing level (see
  // SchemaDefinitionFormDialog's `initialLevelKey` prop) — the level's
  // display names may be edited, but its identity stays the same. Left
  // undefined when creating a brand-new level, in which case a fresh key is
  // generated below.
  existingLevelKey?: string
): Promise<SchemaDefinitionActionState> {
  const admin = await requirePermission(Permissions.schemaCreate);

  const tValidation = await getTranslations("validation.schemaDefinitions");
  const tErrors = await getTranslations("admin.schema.errors");
  const parsed = createSchemaDefinitionSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { level, version, content, templateId, active } = parsed.data;

  const levelKey = existingLevelKey ?? (await generateLevelKey());

  const [existing] = await db
    .select({ id: schemaDefinitions.id, active: schemaDefinitions.active })
    .from(schemaDefinitions)
    .where(and(eq(schemaDefinitions.levelKey, levelKey), eq(schemaDefinitions.version, version)))
    .limit(1);
  // Resubmitting the currently active version for a level updates that record
  // in place instead of failing as a duplicate. A historical, inactive
  // version at the same level+version still blocks as versionExists.
  if (existing && !existing.active) return { error: tErrors("versionExists") };

  if (active) {
    await db.transaction(async (tx) => {
      await tx
        .update(schemaDefinitions)
        .set({ active: false })
        .where(and(eq(schemaDefinitions.levelKey, levelKey), eq(schemaDefinitions.active, true)));
      if (existing) {
        await tx
          .update(schemaDefinitions)
          .set({ level, content, templateId, active: true })
          .where(eq(schemaDefinitions.id, existing.id));
      } else {
        await tx.insert(schemaDefinitions).values({ levelKey, level, version, content, templateId, active: true });
      }
    });
  } else if (existing) {
    await db
      .update(schemaDefinitions)
      .set({ level, content, templateId, active: false })
      .where(eq(schemaDefinitions.id, existing.id));
  } else {
    await db.insert(schemaDefinitions).values({ levelKey, level, version, content, templateId, active: false });
  }

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.schemaCreate,
    resourceType: "schema-definition",
    resourceId: `${levelKey}/${version}`,
    newValues: { levelKey, level, version, active, contentLength: content.length },
  });

  revalidatePath(ROUTES.adminSchema);
  return { success: true };
}

export async function deleteSchemaDefinition(id: string): Promise<SchemaDefinitionActionState> {
  const admin = await requirePermission(Permissions.schemaDelete);

  const tErrors = await getTranslations("admin.schema.errors");
  const [existing] = await db
    .select({
      levelKey: schemaDefinitions.levelKey,
      level: schemaDefinitions.level,
      version: schemaDefinitions.version,
      active: schemaDefinitions.active,
    })
    .from(schemaDefinitions)
    .where(eq(schemaDefinitions.id, id))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  // lesson_versions.schema_definition_id is ON DELETE RESTRICT — a version
  // that already generated lessons is part of their history, so it is kept
  // rather than deleted out from under them.
  const [linkedLessonVersion] = await db
    .select({ id: lessonVersions.id })
    .from(lessonVersions)
    .where(eq(lessonVersions.schemaDefinitionId, id))
    .limit(1);
  if (linkedLessonVersion) return { error: tErrors("schemaInUse") };

  await db.delete(schemaDefinitions).where(eq(schemaDefinitions.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.schemaDelete,
    resourceType: "schema-definition",
    resourceId: `${existing.levelKey}/${existing.version}`,
    oldValues: existing,
  });

  revalidatePath(ROUTES.adminSchema);
  return { success: true };
}
