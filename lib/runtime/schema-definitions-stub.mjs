// Minimal stand-in for database/schema/schema-definitions.ts. The real module
// imports "@/i18n/config" (unresolvable under plain Node). Column definitions
// mirror the real table so inserts through this stub hit the real database
// correctly; the missing Locale typing is type-level only and irrelevant here.
import { pgTable, uuid, text, jsonb, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { templates } from "../../database/schema/templates.ts";

export const schemaDefinitions = pgTable(
  "schema_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    levelKey: text("level_key").notNull(),
    level: jsonb("level").notNull(),
    version: text("version").notNull(),
    content: text("content").notNull(),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.levelKey, table.version)],
);
