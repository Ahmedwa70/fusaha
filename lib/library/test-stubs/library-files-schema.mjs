// Minimal real-Drizzle stand-in for the schema tables book-files.ts touches,
// so the WHERE condition builders operate on genuine column objects.
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const libraryBooks = pgTable("library_books", {
  id: uuid("id").primaryKey(),
});

export const libraryFiles = pgTable("library_files", {
  id: uuid("id").primaryKey(),
  sha256: text("sha256").notNull(),
});

export const libraryBookFiles = pgTable("library_book_files", {
  id: uuid("id").primaryKey(),
  bookId: uuid("book_id").notNull(),
  fileId: uuid("file_id").notNull(),
});

export const libraryDownloadGrants = pgTable("library_download_grants", {
  id: uuid("id").primaryKey(),
  bookId: uuid("book_id").notNull(),
  userId: uuid("user_id").notNull(),
  grantedBy: uuid("granted_by"),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});
