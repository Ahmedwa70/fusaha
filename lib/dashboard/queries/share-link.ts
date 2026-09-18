import "server-only";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, folders, shareLinks } from "@/database/schema";
import type { LessonListItem } from "@/lib/dashboard/queries/lesson";

export async function getActiveShareLinkCount(ownerId: string): Promise<number> {
  const rows = await db
    .select({ id: shareLinks.id })
    .from(shareLinks)
    .innerJoin(lessons, eq(shareLinks.lessonId, lessons.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(shareLinks.active, true)));
  return rows.length;
}

export type SharedLessonItem = LessonListItem & { shareToken: string };

// A lesson can have at most one active share link at a time in the current
// flow (§13), so an inner join is safe here.
export async function getSharedLessons(ownerId: string): Promise<SharedLessonItem[]> {
  const rows = await db
    .select({
      id: lessons.id,
      name: lessons.name,
      state: lessons.state,
      updatedAt: lessons.updatedAt,
      folderName: folders.name,
      shareToken: shareLinks.token,
    })
    .from(shareLinks)
    .innerJoin(lessons, eq(shareLinks.lessonId, lessons.id))
    .leftJoin(folders, eq(lessons.folderId, folders.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(shareLinks.active, true), isNull(lessons.deletedAt)))
    .orderBy(desc(lessons.updatedAt));

  return rows.map((r) => ({ ...r, level: null }));
}
