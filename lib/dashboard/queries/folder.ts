import "server-only";
import { and, eq, isNull, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, folders } from "@/database/schema";

export type FolderListItem = { id: string; name: string; lessonCount: number };

export async function getTeacherFolders(ownerId: string): Promise<FolderListItem[]> {
  const rows = await db
    .select({ id: folders.id, name: folders.name, lessonCount: count(lessons.id) })
    .from(folders)
    .leftJoin(lessons, and(eq(lessons.folderId, folders.id), isNull(lessons.deletedAt)))
    .where(eq(folders.ownerId, ownerId))
    .groupBy(folders.id, folders.name)
    .orderBy(folders.name);

  return rows;
}

export type FolderItem = { id: string; name: string };

export async function getFolderById(ownerId: string, folderId: string): Promise<FolderItem | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.ownerId, ownerId)))
    .limit(1);

  return folder ?? null;
}
