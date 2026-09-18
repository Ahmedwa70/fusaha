import { pgTable, uuid, integer, smallint, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { SourceType } from "./enums";
import { users } from "./users";
import { lessons } from "./lessons";

// One row per generation attempt (src/trigger/generate-lesson.ts) — lets
// admins monitor real DeepSeek token usage/cost and latency per teacher from
// our own admin panel, instead of digging through Trigger.dev's run logs.
// lessonId/teacherId are set-null on delete so this history survives the
// lesson or account being removed later.
export const generationEvents = pgTable("generation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  sourceType: smallint("source_type").$type<SourceType>(),
  success: boolean("success").notNull(),
  durationMs: integer("duration_ms"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
