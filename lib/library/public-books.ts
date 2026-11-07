import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { libraryBooks } from "@/database/schema";
import type { LocalizedText } from "@/lib/localized-text";

// Public catalog reads: the public library pages are the only consumers.
// Only records that passed the admin review workflow (published + verified)
// are visible; drafts and unverified records must never leave the admin
// area. The admin workflow itself lives in actions/library.ts and is
// untouched by this module.

export type PublicLibraryBook = {
  slug: string;
  displayTitle: LocalizedText;
  description: LocalizedText;
  longDescription: LocalizedText | null;
  authors: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string;
  audience: string;
  level: string;
  coverUrl: string | null;
  coverAlt: LocalizedText | null;
  sourceName: string;
  sourceUrl: string;
  accessStatus: string;
  accessNotes: LocalizedText | null;
  publishedAt: Date | null;
};

const publicBookFields = {
  slug: libraryBooks.slug,
  displayTitle: libraryBooks.displayTitle,
  description: libraryBooks.description,
  longDescription: libraryBooks.longDescription,
  authors: libraryBooks.authors,
  publisher: libraryBooks.publisher,
  publicationYear: libraryBooks.publicationYear,
  category: libraryBooks.category,
  audience: libraryBooks.audience,
  level: libraryBooks.level,
  coverUrl: libraryBooks.coverUrl,
  coverAlt: libraryBooks.coverAlt,
  sourceName: libraryBooks.sourceName,
  sourceUrl: libraryBooks.sourceUrl,
  accessStatus: libraryBooks.accessStatus,
  accessNotes: libraryBooks.accessNotes,
  publishedAt: libraryBooks.publishedAt,
};

// Single source of truth for the public visibility rule: a book appears in
// the public catalog only when the admin workflow marked it published AND
// verified. Tests assert on this exact condition.
const publishedAndVerified = and(
  eq(libraryBooks.publicationStatus, "published"),
  eq(libraryBooks.reviewStatus, "verified"),
);

export async function listPublishedLibraryBooks(): Promise<PublicLibraryBook[]> {
  return db
    .select(publicBookFields)
    .from(libraryBooks)
    .where(publishedAndVerified)
    .orderBy(desc(libraryBooks.publishedAt));
}

export async function getPublishedLibraryBookBySlug(slug: string): Promise<PublicLibraryBook | null> {
  const rows = await db
    .select(publicBookFields)
    .from(libraryBooks)
    .where(and(eq(libraryBooks.slug, slug), publishedAndVerified))
    .limit(1);
  return rows[0] ?? null;
}
