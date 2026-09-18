"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import {
  lessons,
  lessonVersions,
  folders,
  shareLinks,
  schemaDefinitions,
  templates,
  LessonState,
  VersionStatus,
} from "@/database/schema";
import { requirePermission, requireTeacher } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { composePlayerHtml } from "@/lib/templates/compose-player-html";

export type LessonActionState = { error: string } | { success: true };

export type UpdateLessonVersionContentResult =
  | { error: string }
  | { success: true; html: string };

// Teacher-facing soft delete (§14): removes the lesson from the teacher's
// account immediately and cannot be undone by the teacher. The row is kept
// (deleted_at set) so admin can restore it from backup — see restoreLesson.
export async function deleteLesson(id: string): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ deletedAt: lessons.deletedAt })
    .from(lessons)
    .where(and(eq(lessons.id, id), eq(lessons.ownerId, teacher.id)))
    .limit(1);
  if (!lesson || lesson.deletedAt !== null)
    return { error: tErrors("notFound") };

  await db
    .update(lessons)
    .set({ deletedAt: new Date() })
    .where(eq(lessons.id, id));

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/lessons/${id}`);
  return { success: true };
}

// Admin-only hard delete: permanently removes the row (lesson_versions and
// share_links cascade). Works on any lesson regardless of deleted_at — this
// is the one irreversible operation in the system, distinct from the
// teacher's soft delete / admin's restore-from-backup above.
export async function hardDeleteLesson(id: string): Promise<LessonActionState> {
  const admin = await requirePermission(Permissions.lessonsDelete);
  const tErrors = await getTranslations("admin.lessons.errors");

  const [lesson] = await db
    .select({ name: lessons.name, deletedAt: lessons.deletedAt })
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  await db.delete(lessons).where(eq(lessons.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.lessonsDelete,
    resourceType: "lesson",
    resourceId: id,
    oldValues: lesson,
  });

  revalidatePath("/admin/lessons");
  return { success: true };
}

export async function restoreLesson(id: string): Promise<LessonActionState> {
  const admin = await requirePermission(Permissions.lessonsRestore);
  const tErrors = await getTranslations("admin.lessons.errors");

  const [lesson] = await db
    .select({ deletedAt: lessons.deletedAt })
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };
  if (lesson.deletedAt === null) return { error: tErrors("notDeleted") };

  await db.update(lessons).set({ deletedAt: null }).where(eq(lessons.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.lessonsRestore,
    resourceType: "lesson",
    resourceId: id,
    oldValues: { deletedAt: lesson.deletedAt },
    newValues: { deletedAt: null },
  });

  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${id}`);
  return { success: true };
}

// §13: a lesson can have at most one share-link row at a time. Creating one
// is only allowed for approved lessons; stopping/starting reuses the same
// token rather than issuing a new one, so a previously shared URL keeps
// working if re-enabled.
export async function createShareLink(
  lessonId: string,
): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ state: lessons.state })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.ownerId, teacher.id),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };
  if (lesson.state !== LessonState.Approved)
    return { error: tErrors("notApproved") };

  const token = randomBytes(24).toString("base64url");
  await db.insert(shareLinks).values({ lessonId, token });

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  revalidatePath("/dashboard/shared");
  return { success: true };
}

export async function setShareLinkActive(
  lessonId: string,
  active: boolean,
): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.ownerId, teacher.id)))
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  const updated = await db
    .update(shareLinks)
    .set({ active })
    .where(eq(shareLinks.lessonId, lessonId))
    .returning({ id: shareLinks.id });
  if (updated.length === 0) return { error: tErrors("shareLinkNotFound") };

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  revalidatePath("/dashboard/shared");
  return { success: true };
}

// §8: assigns/moves a lesson into a folder, or unfiles it when folderId is
// null. Folders are per-teacher, so a target folder must belong to the same
// teacher as the lesson.
export async function moveLessonToFolder(
  lessonId: string,
  folderId: string | null,
): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.ownerId, teacher.id),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  if (folderId !== null) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, teacher.id)))
      .limit(1);
    if (!folder) return { error: tErrors("folderNotFound") };
  }

  await db.update(lessons).set({ folderId }).where(eq(lessons.id, lessonId));

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/folders");
  return { success: true };
}

// §11: approves the lesson's latest version (always the highest version
// number — there is only ever one draft awaiting approval at a time) and
// makes it the lesson's current approved version.
export async function approveLesson(
  lessonId: string,
): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.ownerId, teacher.id),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  const [latestVersion] = await db
    .select({ id: lessonVersions.id, status: lessonVersions.status })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, lessonId))
    .orderBy(desc(lessonVersions.versionNumber))
    .limit(1);
  if (!latestVersion) return { error: tErrors("noDraftVersion") };
  if (latestVersion.status === VersionStatus.Approved)
    return { error: tErrors("alreadyApproved") };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(lessonVersions)
      .set({ status: VersionStatus.Approved, approvedAt: now })
      .where(eq(lessonVersions.id, latestVersion.id));
    await tx
      .update(lessons)
      .set({
        state: LessonState.Approved,
        currentApprovedVersionId: latestVersion.id,
      })
      .where(eq(lessons.id, lessonId));
  });

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

// §11: restoring an older version never rewrites history — it copies that
// version's content into a brand-new draft version (next version number),
// which goes through the same approve flow as any other draft. The lesson
// drops back to Draft state since its latest version is unapproved again;
// currentApprovedVersionId is left pointing at whatever was last approved
// until the restored draft is approved in turn.
export async function restoreLessonVersion(
  lessonId: string,
  versionId: string,
): Promise<LessonActionState> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.ownerId, teacher.id),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  const [source] = await db
    .select({
      schemaDefinitionId: lessonVersions.schemaDefinitionId,
      content: lessonVersions.content,
      sourceType: lessonVersions.sourceType,
    })
    .from(lessonVersions)
    .where(
      and(
        eq(lessonVersions.id, versionId),
        eq(lessonVersions.lessonId, lessonId),
      ),
    )
    .limit(1);
  if (!source) return { error: tErrors("versionNotFound") };

  await db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ versionNumber: lessonVersions.versionNumber })
      .from(lessonVersions)
      .where(eq(lessonVersions.lessonId, lessonId))
      .orderBy(desc(lessonVersions.versionNumber))
      .limit(1);

    await tx.insert(lessonVersions).values({
      lessonId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      status: VersionStatus.Draft,
      schemaDefinitionId: source.schemaDefinitionId,
      content: source.content,
      sourceType: source.sourceType,
    });

    await tx
      .update(lessons)
      .set({ state: LessonState.Draft })
      .where(eq(lessons.id, lessonId));
  });

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateLessonVersionContent(
  lessonId: string,
  versionId: string,
  content: unknown,
): Promise<UpdateLessonVersionContentResult> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.lessonDetail.errors");

  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.ownerId, teacher.id),
        isNull(lessons.deletedAt),
      ),
    )
    .limit(1);
  if (!lesson) return { error: tErrors("notFound") };

  const [version] = await db
    .select({
      id: lessonVersions.id,
      lessonId: lessonVersions.lessonId,
      status: lessonVersions.status,
      htmlPlayer: templates.htmlPlayer,
    })
    .from(lessonVersions)
    .innerJoin(
      schemaDefinitions,
      eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id),
    )
    .innerJoin(templates, eq(schemaDefinitions.templateId, templates.id))
    .where(eq(lessonVersions.id, versionId))
    .limit(1);
  if (!version || version.lessonId !== lessonId)
    return { error: tErrors("versionNotFound") };

  const [latestVersion] = await db
    .select({ id: lessonVersions.id })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, lessonId))
    .orderBy(desc(lessonVersions.versionNumber))
    .limit(1);

  // Defense in depth: there should only ever be one draft (see approveLesson
  // above), but confirm this is actually the latest version rather than
  // trusting that invariant blindly.
  if (
    version.status !== VersionStatus.Draft ||
    latestVersion?.id !== version.id
  ) {
    return { error: tErrors("cannotEditApprovedVersion") };
  }

  await db
    .update(lessonVersions)
    .set({ content })
    .where(eq(lessonVersions.id, versionId));

  const html = composePlayerHtml(version.htmlPlayer, content);

  revalidatePath(`/dashboard/lessons/${lessonId}`);
  return { success: true, html };
}
