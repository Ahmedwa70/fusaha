import "server-only";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { lessons, lessonVersions, schemaDefinitions } from "@/database/schema";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import type { Locale } from "@/i18n/config";

export type VersionHistoryItem = {
  id: string;
  lessonId: string;
  lessonName: string;
  versionNumber: number;
  status: (typeof lessonVersions.$inferSelect)["status"];
  level: string;
  createdAt: Date;
  approvedAt: Date | null;
};

// Flat, cross-lesson feed — Phase 1 scale, so a simple limit is enough
// (no pagination yet).
export async function getVersionHistory(ownerId: string, limit = 50): Promise<VersionHistoryItem[]> {
  const locale = (await getLocale()) as Locale;
  const rows = await db
    .select({
      id: lessonVersions.id,
      lessonId: lessonVersions.lessonId,
      lessonName: lessons.name,
      versionNumber: lessonVersions.versionNumber,
      status: lessonVersions.status,
      level: schemaDefinitions.level,
      createdAt: lessonVersions.createdAt,
      approvedAt: lessonVersions.approvedAt,
    })
    .from(lessonVersions)
    .innerJoin(lessons, eq(lessonVersions.lessonId, lessons.id))
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .where(and(eq(lessons.ownerId, ownerId), isNull(lessons.deletedAt)))
    .orderBy(desc(lessonVersions.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    level: resolveLevelLabel(row.level, locale),
  }));
}
