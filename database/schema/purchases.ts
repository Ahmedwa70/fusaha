import { pgTable, uuid, integer, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { creditPackages } from "./credit-packages";

export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "completed", "failed"]);

// One row per checkout attempt. `paddleTransactionId` is the idempotency
// anchor: the webhook only credits a purchase once, guarded by the pending ->
// ... status transition (see actions/purchases.ts).
export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  packageId: uuid("package_id")
    .notNull()
    .references(() => creditPackages.id),
  creditsAmount: integer("credits_amount").notNull(),
  price: integer("price").notNull(),
  currency: text("currency").notNull(),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  paddleTransactionId: text("paddle_transaction_id").notNull(),
  paddlePaymentMethod: text("paddle_payment_method"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
