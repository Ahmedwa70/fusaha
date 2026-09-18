import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

// A template bundles everything one lesson "shape" needs to render and be
// generated: the HTML player (reads content from `window.LESSON_DATA`), a
// fully-filled blueprint example (sent to the AI as few-shot context), a
// validation script that checks generated content against this template's
// shape, and a preview image. Independent from schema_definitions (level +
// AI instructions) — schema_definitions.templateId points here.
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  htmlPlayer: text("html_player").notNull(),
  blueprint: text("blueprint").notNull(),
  validationScript: text("validation_script").notNull(),
  // data: URI — no blob/S3 storage exists in this app yet (PRD §19.5 is
  // still open), so this is stored as text like every other template asset.
  previewImage: text("preview_image"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
