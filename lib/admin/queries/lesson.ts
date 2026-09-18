import "server-only";
import { eq, inArray, desc, count } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { lessons, lessonVersions, folders, users, schemaDefinitions } from "@/database/schema";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import type { Locale } from "@/i18n/config";

export type AdminLessonListItem = {
  id: string;
  name: string;
  state: (typeof lessons.$inferSelect)["state"];
  deletedAt: Date | null;
  level: string | null;
  folderName: string | null;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
};

// Admin-wide equivalent of getTeacherLessons (lib/dashboard/queries.ts):
// same two-query-then-merge-in-JS technique for picking each lesson's
// latest version, but unscoped by owner and including soft-deleted rows
// (admin needs to see and restore those).
export async function getAdminLessons(): Promise<AdminLessonListItem[]> {
  const locale = (await getLocale()) as Locale;
  const rows = await db
    .select({
      id: lessons.id,
      name: lessons.name,
      state: lessons.state,
      deletedAt: lessons.deletedAt,
      createdAt: lessons.createdAt,
      updatedAt: lessons.updatedAt,
      folderName: folders.name,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(lessons)
    .innerJoin(users, eq(lessons.ownerId, users.id))
    .leftJoin(folders, eq(lessons.folderId, folders.id))
    .orderBy(desc(lessons.createdAt));

  if (rows.length === 0) return [];

  const lessonIds = rows.map((r) => r.id);
  const versions = await db
    .select({
      lessonId: lessonVersions.lessonId,
      level: schemaDefinitions.level,
      versionNumber: lessonVersions.versionNumber,
    })
    .from(lessonVersions)
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .where(inArray(lessonVersions.lessonId, lessonIds));

  const latestByLesson = new Map<string, { level: string; versionNumber: number }>();
  for (const v of versions) {
    const existing = latestByLesson.get(v.lessonId);
    if (!existing || v.versionNumber > existing.versionNumber) {
      latestByLesson.set(v.lessonId, { level: resolveLevelLabel(v.level, locale), versionNumber: v.versionNumber });
    }
  }

  return rows.map((r) => ({
    ...r,
    level: latestByLesson.get(r.id)?.level ?? null,
  }));
}

export type AdminLessonDetail = {
  id: string;
  name: string;
  state: (typeof lessons.$inferSelect)["state"];
  deletedAt: Date | null;
  level: string | null;
  folderName: string | null;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  versionCount: number;
};

export async function getAdminLessonById(id: string): Promise<AdminLessonDetail | null> {
  const [lesson] = await db
    .select({
      id: lessons.id,
      name: lessons.name,
      state: lessons.state,
      deletedAt: lessons.deletedAt,
      createdAt: lessons.createdAt,
      updatedAt: lessons.updatedAt,
      folderName: folders.name,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(lessons)
    .innerJoin(users, eq(lessons.ownerId, users.id))
    .leftJoin(folders, eq(lessons.folderId, folders.id))
    .where(eq(lessons.id, id))
    .limit(1);

  if (!lesson) return null;

  // Mirrors the count() idiom in getTeacherFolders (lib/dashboard/queries.ts),
  // grouped down to a single row for this one lesson.
  const [versionStats] = await db
    .select({ count: count(lessonVersions.id) })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, id));

  const locale = (await getLocale()) as Locale;
  const [latestVersion] = await db
    .select({ level: schemaDefinitions.level })
    .from(lessonVersions)
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .where(eq(lessonVersions.lessonId, id))
    .orderBy(desc(lessonVersions.versionNumber))
    .limit(1);

  return {
    ...lesson,
    level: latestVersion ? resolveLevelLabel(latestVersion.level, locale) : null,
    versionCount: versionStats?.count ?? 0,
  };
}
