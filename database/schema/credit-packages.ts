import { pgTable, uuid, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { LocalizedText } from "@/lib/localized-text";

export const creditPackages = pgTable("credit_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Every teacher-facing display field below is localized jsonb keyed by
  // locale (see lib/localized-text.ts) — the dashboard pricing card is read
  // in the teacher's own language, so a single-language text column would
  // show Arabic marketing copy under an English/Chinese UI.
  name: jsonb("name").notNull().$type<LocalizedText>(),
  creditsAmount: integer("credits_amount").notNull(),
  price: integer("price").notNull(), // minor currency units (cents/fen)
  currency: text("currency").notNull().default("USD"),
  active: boolean("active").notNull().default(true),
  // Paddle catalog price id (pri_...) this package checks out against.
  // Paddle prices are pre-created in the dashboard/API, unlike Stripe's
  // inline price_data — checkout is blocked until this is set.
  paddlePriceId: text("paddle_price_id"),
  // Marketing badge shown above the card on the dashboard (e.g. "الأفضل توازنًا"). Optional — no badge renders when unset.
  badgeLabel: jsonb("badge_label").$type<LocalizedText>(),
  // Short line shown under the package name on the dashboard card (e.g. "للاستخدام المكثف والمستمر").
  subtitle: jsonb("subtitle").$type<LocalizedText>(),
  // Tagline shown at the bottom of the dashboard card (e.g. "احصل على قيمة أكبر مقابل كل دولار").
  footerText: jsonb("footer_text").$type<LocalizedText>(),
  // Bullet points shown per package on the dashboard pricing card, admin-editable and independent per package.
  // One entry per bullet, each carrying that bullet's text in every locale —
  // kept aligned per bullet (rather than a separate list per locale) so the
  // bullets stay in the same order and count across languages.
  features: jsonb("features").notNull().default([]).$type<LocalizedText[]>(),
  // Hex accent color for the card (border/badge/icon/button). All the pale
  // background tints (card, icon, etc.) are derived from this single color at
  // render time via CSS color-mix — see credit-package-card.tsx. Falls back
  // to the default neutral card style when unset.
  colorDark: text("color_dark"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
