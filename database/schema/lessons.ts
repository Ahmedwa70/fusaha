import { pgTable, uuid, text, smallint, timestamp } from "drizzle-orm/pg-core";
import { LessonState } from "./enums";
import { users } from "./users";
import { folders } from "./folders";

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currentApprovedVersionId: uuid("current_approved_version_id"),
  state: smallint("state").notNull().default(LessonState.Draft).$type<LessonState>(),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
