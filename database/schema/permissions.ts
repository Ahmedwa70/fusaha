import { pgTable, uuid, text, uniqueIndex } from "drizzle-orm/pg-core";

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
  },
  (table) => [uniqueIndex("permissions_key_idx").on(table.key)],
);
