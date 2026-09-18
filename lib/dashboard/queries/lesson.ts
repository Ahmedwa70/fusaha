import "server-only";
import { and, eq, isNull, isNotNull, ne, inArray, desc, type SQL } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { lessons, lessonVersions, folders, shareLinks, schemaDefinitions, templates, LessonState } from "@/database/schema";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import type { Locale } from "@/i18n/config";

// The lesson-engine React player was removed — each template will define its
// own content shape, so this is untyped JSON until the templates system lands.
type LessonContent = unknown;

export type LessonListItem = {
  id: string;
  name: string;
  state: (typeof lessons.$inferSelect)["state"];
  level: string | null;
  folderName: string | null;
  updatedAt: Date;
};

// Phase 1 scale (a handful of lessons per teacher): fetch lessons, then
// fetch their versions in one IN query and pick the latest per lesson in
// JS, rather than a correlated subquery.
async function fetchLessonList(ownerId: string, folderCondition?: SQL): Promise<LessonListItem[]> {
  const locale = (await getLocale()) as Locale;
  const rows = await db
    .select({
      id: lessons.id,
      name: lessons.name,
      state: lessons.state,
      updatedAt: lessons.updatedAt,
      folderName: folders.name,
    })
    .from(lessons)
    .leftJoin(folders, eq(lessons.folderId, folders.id))
    .where(
      folderCondition
        ? and(eq(lessons.ownerId, ownerId), isNull(lessons.deletedAt), folderCondition)
        : and(eq(lessons.ownerId, ownerId), isNull(lessons.deletedAt))
    )
    .orderBy(desc(lessons.updatedAt));

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
    id: r.id,
    name: r.name,
    state: r.state,
    level: latestByLesson.get(r.id)?.level ?? null,
    folderName: r.folderName,
    updatedAt: r.updatedAt,
  }));
}

// folderId: undefined = all lessons, null = unfiled only, a string = that folder only.
export async function getTeacherLessons(ownerId: string, folderId?: string | null): Promise<LessonListItem[]> {
  const condition =
    folderId === undefined ? undefined : folderId === null ? isNull(lessons.folderId) : eq(lessons.folderId, folderId);
  return fetchLessonList(ownerId, condition);
}

// Lessons that already belong to a *different* folder — used by the "move
// lesson" picker so a folder can pull in lessons currently filed elsewhere.
export async function getLessonsInOtherFolders(ownerId: string, excludeFolderId: string): Promise<LessonListItem[]> {
  return fetchLessonList(ownerId, and(isNotNull(lessons.folderId), ne(lessons.folderId, excludeFolderId)));
}

export type LessonDetail = {
  id: string;
  name: string;
  state: (typeof lessons.$inferSelect)["state"];
  folderId: string | null;
  folderName: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: {
    id: string;
    versionNumber: number;
    status: (typeof lessonVersions.$inferSelect)["status"];
    level: string;
    createdAt: Date;
    approvedAt: Date | null;
    content: LessonContent;
  }[];
  shareLink: { token: string; active: boolean } | null;
};

export async function getLessonDetail(ownerId: string, lessonId: string): Promise<LessonDetail | null> {
  const [lesson] = await db
    .select({
      id: lessons.id,
      name: lessons.name,
      state: lessons.state,
      folderId: lessons.folderId,
      folderName: folders.name,
      createdAt: lessons.createdAt,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .leftJoin(folders, eq(lessons.folderId, folders.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.ownerId, ownerId), isNull(lessons.deletedAt)))
    .limit(1);

  if (!lesson) return null;

  const locale = (await getLocale()) as Locale;
  const versionRows = await db
    .select({
      id: lessonVersions.id,
      versionNumber: lessonVersions.versionNumber,
      status: lessonVersions.status,
      level: schemaDefinitions.level,
      createdAt: lessonVersions.createdAt,
      approvedAt: lessonVersions.approvedAt,
      content: lessonVersions.content,
    })
    .from(lessonVersions)
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .where(eq(lessonVersions.lessonId, lessonId))
    .orderBy(desc(lessonVersions.versionNumber));

  const versions = versionRows.map((v) => ({ ...v, level: resolveLevelLabel(v.level, locale) }));

  const [shareLink] = await db
    .select({ token: shareLinks.token, active: shareLinks.active })
    .from(shareLinks)
    .where(eq(shareLinks.lessonId, lessonId))
    .limit(1);

  return { ...lesson, versions, shareLink: shareLink ?? null };
}

export type PlayableLesson = {
  name: string;
  content: LessonContent;
  htmlPlayer: string;
};

// For the "Play Lesson" run route (app/dashboard/lessons/[id]/run): only the
// currently-approved version is playable, scoped to the owning teacher.
export async function getApprovedLessonForPlay(ownerId: string, lessonId: string): Promise<PlayableLesson | null> {
  const [row] = await db
    .select({
      name: lessons.name,
      state: lessons.state,
      content: lessonVersions.content,
      htmlPlayer: templates.htmlPlayer,
    })
    .from(lessons)
    .innerJoin(lessonVersions, eq(lessons.currentApprovedVersionId, lessonVersions.id))
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .innerJoin(templates, eq(schemaDefinitions.templateId, templates.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.ownerId, ownerId), isNull(lessons.deletedAt)))
    .limit(1);

  if (!row || row.state !== LessonState.Approved) return null;
  return { name: row.name, content: row.content as LessonContent, htmlPlayer: row.htmlPlayer };
}

// For the public share-link viewer (app/l/[token]): no owner scoping — the
// token itself is the authorization.
export async function getApprovedLessonByShareToken(token: string): Promise<PlayableLesson | null> {
  const [row] = await db
    .select({
      name: lessons.name,
      state: lessons.state,
      deletedAt: lessons.deletedAt,
      content: lessonVersions.content,
      htmlPlayer: templates.htmlPlayer,
    })
    .from(shareLinks)
    .innerJoin(lessons, eq(shareLinks.lessonId, lessons.id))
    .innerJoin(lessonVersions, eq(lessons.currentApprovedVersionId, lessonVersions.id))
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .innerJoin(templates, eq(schemaDefinitions.templateId, templates.id))
    .where(and(eq(shareLinks.token, token), eq(shareLinks.active, true)))
    .limit(1);

  if (!row || row.deletedAt !== null || row.state !== LessonState.Approved) return null;
  return { name: row.name, content: row.content as LessonContent, htmlPlayer: row.htmlPlayer };
}
