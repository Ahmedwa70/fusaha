import { pgTable, uuid, integer, smallint, jsonb, timestamp } from "drizzle-orm/pg-core";
import { VersionStatus, SourceType } from "./enums";
import { lessons } from "./lessons";
import { schemaDefinitions } from "./schema-definitions";

// a draft is a LessonVersion with status = "draft"
export const lessonVersions = pgTable("lesson_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  status: smallint("status").notNull().default(VersionStatus.Draft).$type<VersionStatus>(),
  // The level (§4/§6) is whatever schema_definitions.level says — admin-
  // defined free text, not a fixed 1/2/3, and new levels can be added later.
  // No separate level column here: this FK is the single source of truth,
  // joined against wherever a version's level needs to be displayed.
  schemaDefinitionId: uuid("schema_definition_id")
    .notNull()
    .references(() => schemaDefinitions.id, { onDelete: "restrict" }),
  content: jsonb("content").notNull(),
  sourceType: smallint("source_type").$type<SourceType>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});
