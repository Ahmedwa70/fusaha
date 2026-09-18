import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { roles } from "./roles";

// id matches the Supabase auth.users id (uuid) — auth/session/password
// handling lives entirely in Supabase Auth; this row only carries the
// app-specific profile: role, credits.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  creditsBalance: integer("credits_balance").notNull().default(0),
  paddleCustomerId: text("paddle_customer_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
