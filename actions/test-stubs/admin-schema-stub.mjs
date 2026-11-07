// Minimal stand-in for the schema the dashboard queries touch.
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const libraryBooks = pgTable("library_books", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  originalTitle: text("original_title").notNull(),
  publicationStatus: text("publication_status").notNull(),
  reviewStatus: text("review_status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const libraryFiles = pgTable("library_files", {
  id: uuid("id").primaryKey(),
  sizeBytes: integer("size_bytes").notNull(),
});

export const libraryDownloadGrants = pgTable("library_download_grants", {
  id: uuid("id").primaryKey(),
  bookId: uuid("book_id").notNull(),
  userId: uuid("user_id").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
});
