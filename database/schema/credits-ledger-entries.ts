import { pgTable, uuid, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const ledgerReasonEnum = pgEnum("ledger_reason", ["purchase", "admin_adjustment", "generation"]);

// §9/§16: an append-only ledger so the credits balance is always
// reconstructable/auditable, even though teachers only ever see the balance
// itself. `refId` points at the purchases row (reason "purchase") or is null
// for a manual admin adjustment.
export const creditsLedgerEntries = pgTable("credits_ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: ledgerReasonEnum("reason").notNull(),
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
