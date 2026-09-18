import { pgTable, uuid, text, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Internal slug — matched literally in lib/auth/dal.ts. Do not repurpose.
    name: text("name").notNull(),
    // Human display name shown in the admin panel.
    title: text("title").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
  },
  (table) => [uniqueIndex("roles_name_idx").on(table.name)],
);
