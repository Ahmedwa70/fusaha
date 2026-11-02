import { pgTable, uuid, integer, smallint, jsonb, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { VersionStatus, SourceType, RuntimeBindingStatus } from "./enums";
import { lessons } from "./lessons";
import { schemaDefinitions } from "./schema-definitions";
import { runtimeVersions } from "./runtime-versions";

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
  // Expand phase of the immutable runtime registry (design doc §3.6):
  // nullable during migration; existing rows stay Unbound and render exactly
  // as today until the classified backfill binds them. Bound/Legacy require a
  // runtime reference — enforced by the check below.
  runtimeVersionId: uuid("runtime_version_id").references(() => runtimeVersions.id, { onDelete: "restrict" }),
  runtimeBindingStatus: smallint("runtime_binding_status")
    .notNull()
    .default(RuntimeBindingStatus.Unbound)
    .$type<RuntimeBindingStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
}, (table) => [
  // Unbound(0)/Quarantined(3)/Unrecoverable(4) may be null; Bound(1)/Legacy(2) require one.
  check("lesson_versions_binding_chk", sql`${table.runtimeBindingStatus} IN (0, 3, 4) OR ${table.runtimeVersionId} IS NOT NULL`),
  index("lesson_versions_runtime_idx").on(table.runtimeVersionId),
]);
