import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  libraryBooks,
  libraryFiles,
  libraryBookFiles,
  libraryDownloadGrants,
  users,
} from "@/database/schema";
import type { LibraryFileRow } from "@/database/schema";

// Data layer for library files and download grants. All callers (server
// actions, API routes, pages) go through these helpers so the joins between
// books, content-addressed files, and grants stay in one place.

export type BookFileBundle = {
  book: typeof libraryBooks.$inferSelect;
  bookFile: typeof libraryBookFiles.$inferSelect;
  file: LibraryFileRow;
};

export async function getBookFileBySlug(slug: string): Promise<BookFileBundle | null> {
  const [row] = await db
    .select({ book: libraryBooks, bookFile: libraryBookFiles, file: libraryFiles })
    .from(libraryBooks)
    .innerJoin(libraryBookFiles, eq(libraryBookFiles.bookId, libraryBooks.id))
    .innerJoin(libraryFiles, eq(libraryFiles.id, libraryBookFiles.fileId))
    .where(eq(libraryBooks.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getBookFileByBookId(bookId: string): Promise<BookFileBundle | null> {
  const [row] = await db
    .select({ book: libraryBooks, bookFile: libraryBookFiles, file: libraryFiles })
    .from(libraryBooks)
    .innerJoin(libraryBookFiles, eq(libraryBookFiles.bookId, libraryBooks.id))
    .innerJoin(libraryFiles, eq(libraryFiles.id, libraryBookFiles.fileId))
    .where(eq(libraryBooks.id, bookId))
    .limit(1);
  return row ?? null;
}

export async function findLibraryFileBySha256(sha256: string): Promise<LibraryFileRow | null> {
  const [row] = await db.select().from(libraryFiles).where(eq(libraryFiles.sha256, sha256)).limit(1);
  return row ?? null;
}

// Insert is protected by the UNIQUE(sha256) constraint: concurrent uploads
// of identical bytes race on the same key, the loser takes the DO NOTHING
// branch, and both callers link the same file row. That is the atomic
// dedup guarantee.
export async function insertLibraryFile(values: {
  sha256: string;
  storageKey: string;
  sizeBytes: number;
  contentType: string;
  originalFilename: string;
  uploadedBy: string;
}): Promise<LibraryFileRow> {
  await db.insert(libraryFiles).values(values).onConflictDoNothing({ target: libraryFiles.sha256 });
  const existing = await findLibraryFileBySha256(values.sha256);
  if (!existing) throw new Error("library file insert did not produce a readable row");
  return existing;
}

// One file slot per book: replacing a book's file updates the link; the old
// content-addressed file row stays (no garbage collection by design).
export async function upsertBookFileLink(bookId: string, fileId: string): Promise<void> {
  await db
    .insert(libraryBookFiles)
    .values({ bookId, fileId })
    .onConflictDoUpdate({ target: libraryBookFiles.bookId, set: { fileId } });
}

export async function hasDownloadGrant(bookId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: libraryDownloadGrants.id })
    .from(libraryDownloadGrants)
    .where(and(eq(libraryDownloadGrants.bookId, bookId), eq(libraryDownloadGrants.userId, userId)))
    .limit(1);
  return !!row;
}

export type DownloadGrantListing = {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: Date;
};

export async function listDownloadGrants(bookId: string): Promise<DownloadGrantListing[]> {
  return db
    .select({
      id: libraryDownloadGrants.id,
      userId: libraryDownloadGrants.userId,
      userEmail: users.email,
      createdAt: libraryDownloadGrants.createdAt,
    })
    .from(libraryDownloadGrants)
    .innerJoin(users, eq(users.id, libraryDownloadGrants.userId))
    .where(eq(libraryDownloadGrants.bookId, bookId));
}

export async function insertDownloadGrant(bookId: string, userId: string, grantedBy: string): Promise<boolean> {
  const result = await db
    .insert(libraryDownloadGrants)
    .values({ bookId, userId, grantedBy })
    .onConflictDoNothing({ target: [libraryDownloadGrants.bookId, libraryDownloadGrants.userId] })
    .returning({ id: libraryDownloadGrants.id });
  return result.length > 0;
}

export async function deleteDownloadGrant(grantId: string): Promise<boolean> {
  const result = await db.delete(libraryDownloadGrants).where(eq(libraryDownloadGrants.id, grantId)).returning({ id: libraryDownloadGrants.id });
  return result.length > 0;
}

export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const [row] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}
