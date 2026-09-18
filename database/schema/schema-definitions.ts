import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { templates } from "./templates";
import type { Locale } from "@/i18n/config";

export const schemaDefinitions = pgTable(
  "schema_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable, non-translated identifier for a level (e.g. "level-1"),
    // generated server-side on create (see actions/schema-definitions.ts).
    // Used for uniqueness/lookups/joins — never edited or shown in the admin
    // form, which only exposes the localized display names below.
    levelKey: text("level_key").notNull(),
    // Localized display name, keyed by locale (see i18n/config.ts locales).
    level: jsonb("level").notNull().$type<Partial<Record<Locale, string>>>(),
    version: text("version").notNull(),
    content: text("content").notNull(),
    // Which template (HTML player + shape) this level/version generates for.
    // Independent axis from level: a template can be reused across levels.
    // Nullable for now: no seed/demo data links existing rows to a template.
    // Admins link a template from the schema-definition form going forward;
    // pre-existing rows stay null until an admin edits them.
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.levelKey, table.version)],
);
