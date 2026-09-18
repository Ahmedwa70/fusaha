import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generationEvents, users, lessons, type SourceType } from "@/database/schema";

export type GenerationEventListItem = {
  id: string;
  lessonId: string | null;
  lessonName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  sourceType: SourceType | null;
  success: boolean;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

// Same simple bound as getAuditLogs: newest 200, no pagination system yet.
export async function getGenerationEvents(): Promise<GenerationEventListItem[]> {
  const rows = await db
    .select({
      id: generationEvents.id,
      lessonId: generationEvents.lessonId,
      lessonName: lessons.name,
      teacherId: generationEvents.teacherId,
      teacherName: users.name,
      teacherEmail: users.email,
      sourceType: generationEvents.sourceType,
      success: generationEvents.success,
      durationMs: generationEvents.durationMs,
      promptTokens: generationEvents.promptTokens,
      completionTokens: generationEvents.completionTokens,
      totalTokens: generationEvents.totalTokens,
      errorMessage: generationEvents.errorMessage,
      createdAt: generationEvents.createdAt,
    })
    .from(generationEvents)
    .leftJoin(users, eq(generationEvents.teacherId, users.id))
    .leftJoin(lessons, eq(generationEvents.lessonId, lessons.id))
    .orderBy(desc(generationEvents.createdAt))
    .limit(200);

  return rows;
}
