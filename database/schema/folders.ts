import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
