// Deferred for later phases — not wired into the app yet (billing, generation
// pipeline, admin-editable content). Kept here, commented out, so the shape
// is not lost. Uncomment a table (and its enum, if any) and re-export it from
// ./index.ts when you're ready to build that part.

// import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
// import { users } from "./users";
// import { lessonVersions } from "./lesson-versions";

// creditsLedgerEntries moved to ./credits-ledger-entries.ts (active schema,
// no longer deferred) — reasons "generation"/"correction" will be added
// there once the generation pipeline exists.
// purchases moved to ./purchases.ts (active schema, no longer deferred) —
// provider is read off the Paddle transaction's payment method rather than a
// separate enum.

// export const generationJobStatusEnum = pgEnum("generation_job_status", [
//   "queued",
//   "running",
//   "succeeded",
//   "failed",
// ]);

// creditPackages moved to ./credit-packages.ts (active schema, no longer deferred).

// export const generationJobs = pgTable("generation_jobs", {
//   id: uuid("id").primaryKey().defaultRandom(),
//   lessonVersionId: uuid("lesson_version_id").notNull().references(() => lessonVersions.id, { onDelete: "cascade" }),
//   status: generationJobStatusEnum("status").notNull().default("queued"),
//   sourceRefs: jsonb("source_refs"),
//   attempts: integer("attempts").notNull().default(0),
//   correctionUnitsCarried: integer("correction_units_carried").notNull().default(0),
//   startedAt: timestamp("started_at", { withTimezone: true }),
//   finishedAt: timestamp("finished_at", { withTimezone: true }),
// });

// export const levelDefinitions = pgTable("level_definitions", {
//   levelNumber: integer("level_number").primaryKey(),
//   definition: jsonb("definition").notNull(),
//   updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
// });

// export const schemaDefinitions = pgTable("schema_definitions", {
//   version: text("version").primaryKey(),
//   content: text("content").notNull(),
//   createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
// });

// export const activityTypes = pgTable("activity_types", {
//   key: text("key").primaryKey(),
//   displayName: text("display_name").notNull(),
//   metadata: jsonb("metadata"),
//   active: boolean("active").notNull().default(true),
// });
