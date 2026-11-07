import { bigint, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { libraryBooks } from "./library-books";
import { users } from "./users";

// Library file storage — a private Cloudflare R2 bucket that is completely
// separate from the lesson Runtime storage. Only metadata and content
// addresses live here; file bytes live in R2 under a SHA-256-derived key,
// so the unique constraints below are the atomic dedup guarantee: two
// uploads of identical bytes always converge on one storage object.

export const libraryFiles = pgTable("library_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Content hash — the dedup identity. Unique at the database level.
  sha256: text("sha256").notNull().unique(),
  // R2 object key, derived deterministically from sha256. Unique so a hash
  // always maps to exactly one object.
  storageKey: text("storage_key").notNull().unique(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  contentType: text("content_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Link between a catalog book and its file. One file per book; many books
// may share the same content-addressed file. Deleting a book cascades this
// link but never the file itself (no garbage collection by design).
export const libraryBookFiles = pgTable("library_book_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => libraryBooks.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull().references(() => libraryFiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("library_book_files_book_unique").on(table.bookId),
]);

// Explicit per-user download entitlement. Reading and downloading are
// separate permissions: free_reading grants in-platform reading only, never
// download. This table is also the anchor for future purchase fulfillment —
// a completed purchase inserts a grant row.
export const libraryDownloadGrants = pgTable("library_download_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => libraryBooks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedBy: uuid("granted_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("library_download_grants_book_user_unique").on(table.bookId, table.userId),
]);

export type LibraryFileRow = typeof libraryFiles.$inferSelect;
export type LibraryBookFileRow = typeof libraryBookFiles.$inferSelect;
export type LibraryDownloadGrantRow = typeof libraryDownloadGrants.$inferSelect;
