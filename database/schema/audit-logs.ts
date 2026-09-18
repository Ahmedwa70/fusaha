import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// Application-level "who did what" trail for admin actions. userId is
// nullable and set-null on delete — an audit trail must survive the actor
// being deleted later, never cascade-delete history.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  // Plain text, not an FK — the referenced table varies by resourceType and
  // the row itself may later be deleted.
  resourceId: text("resource_id").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
