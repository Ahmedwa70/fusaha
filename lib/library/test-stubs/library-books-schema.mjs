import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Minimal real-Drizzle stand-in for database/schema/library-books.ts so the
// condition builders under test (eq/and/desc) operate on genuine column
// objects. Only the columns public-books.ts selects are defined.
export const libraryBooks = pgTable("library_books", {
  slug: text("slug").notNull(),
  displayTitle: jsonb("display_title").notNull(),
  description: jsonb("description").notNull(),
  longDescription: jsonb("long_description"),
  authors: text("authors").notNull(),
  publisher: text("publisher"),
  publicationYear: integer("publication_year"),
  category: text("category").notNull(),
  audience: text("audience").notNull(),
  level: text("level").notNull(),
  coverUrl: text("cover_url"),
  coverAlt: jsonb("cover_alt"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  accessStatus: text("access_status").notNull(),
  accessNotes: jsonb("access_notes"),
  publicationStatus: text("publication_status").notNull(),
  reviewStatus: text("review_status").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});
