import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Admin-managed secrets (e.g. the DeepSeek API key) that must never live in
// `.env` — encrypted at rest with APP_KEY (see lib/crypto/secret-box.ts) so
// even direct DB access doesn't expose the plaintext value.
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  encryptedValue: text("encrypted_value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});
