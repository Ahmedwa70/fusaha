import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { libraryBooks, libraryFiles, libraryDownloadGrants, users } from "@/database/schema";

// Read-only admin catalog queries for the library dashboard: paged book
// listing with filters, member lookup by email fragment, and aggregate
// stats. Every caller MUST be a permission-checked Server Action — this
// layer deliberately does no authorization of its own.

export const LIBRARY_BOOK_LIST_MAX_PAGE_SIZE = 100;
export const LIBRARY_MEMBER_SEARCH_LIMIT = 10;

export type LibraryBookListFilters = {
  query?: string;
  publicationStatus?: string;
  reviewStatus?: string;
};

// Escape user input for use inside an ILIKE pattern so a member-typed %, _
// or backslash can never widen the match.
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Pure condition builder — kept separate so the exact WHERE semantics are
// unit-testable without a database.
export function buildBookListConditions(filters: LibraryBookListFilters) {
  const conditions = [];
  if (filters.publicationStatus) {
    conditions.push(eq(libraryBooks.publicationStatus, filters.publicationStatus));
  }
  if (filters.reviewStatus) {
    conditions.push(eq(libraryBooks.reviewStatus, filters.reviewStatus));
  }
  if (filters.query) {
    const pattern = `%${escapeIlikePattern(filters.query)}%`;
    conditions.push(or(ilike(libraryBooks.originalTitle, pattern), ilike(libraryBooks.slug, pattern)));
  }
  return conditions;
}

export function computePagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type LibraryBookListRow = {
  id: string;
  slug: string;
  originalTitle: string;
  publicationStatus: string;
  reviewStatus: string;
  updatedAt: Date;
};

export async function listLibraryBookRows(
  filters: LibraryBookListFilters,
  page: number,
  pageSize: number,
): Promise<{ books: LibraryBookListRow[]; total: number }> {
  const conditions = buildBookListConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: libraryBooks.id,
        slug: libraryBooks.slug,
        originalTitle: libraryBooks.originalTitle,
        publicationStatus: libraryBooks.publicationStatus,
        reviewStatus: libraryBooks.reviewStatus,
        updatedAt: libraryBooks.updatedAt,
      })
      .from(libraryBooks)
      .where(where)
      .orderBy(desc(libraryBooks.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(libraryBooks).where(where),
  ]);
  return { books: rows, total: totals[0]?.total ?? 0 };
}

export type LibraryMemberSearchRow = {
  id: string;
  email: string;
  name: string;
};

// Partial, case-insensitive email match — used by the grants panel to find
// the member being granted access. Escaped so fragments cannot act as
// wildcards.
export async function searchMembersByEmail(fragment: string): Promise<LibraryMemberSearchRow[]> {
  const pattern = `%${escapeIlikePattern(fragment)}%`;
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(ilike(users.email, pattern))
    .orderBy(users.email)
    .limit(LIBRARY_MEMBER_SEARCH_LIMIT);
}

const PUBLICATION_STATUSES = ["draft", "pending_review", "published", "unpublished", "archived"] as const;

export type LibraryStatsSnapshot = {
  totalBooks: number;
  byPublicationStatus: Record<(typeof PUBLICATION_STATUSES)[number], number>;
  totalGrants: number;
  grantsPerBook: Array<{ bookId: string; originalTitle: string; count: number }>;
  totalFiles: number;
  totalBytes: number;
};

export async function getLibraryStatsSnapshot(): Promise<LibraryStatsSnapshot> {
  const [bookCounts, grantCounts, fileTotals] = await Promise.all([
    db
      .select({ publicationStatus: libraryBooks.publicationStatus, total: count() })
      .from(libraryBooks)
      .groupBy(libraryBooks.publicationStatus),
    db
      .select({
        bookId: libraryDownloadGrants.bookId,
        originalTitle: libraryBooks.originalTitle,
        total: count(),
      })
      .from(libraryDownloadGrants)
      .innerJoin(libraryBooks, eq(libraryBooks.id, libraryDownloadGrants.bookId))
      .groupBy(libraryDownloadGrants.bookId, libraryBooks.originalTitle),
    db
      .select({
        totalFiles: count(),
        totalBytes: sql<number>`coalesce(sum(${libraryFiles.sizeBytes}), 0)`,
      })
      .from(libraryFiles),
  ]);

  const byPublicationStatus = Object.fromEntries(PUBLICATION_STATUSES.map((status) => [status, 0])) as Record<(typeof PUBLICATION_STATUSES)[number], number>;
  let totalBooks = 0;
  for (const row of bookCounts) {
    const status = row.publicationStatus as (typeof PUBLICATION_STATUSES)[number];
    if (status in byPublicationStatus) {
      byPublicationStatus[status] = row.total;
      totalBooks += row.total;
    }
  }

  let totalGrants = 0;
  const grantsPerBook = grantCounts.map((row) => {
    totalGrants += row.total;
    return { bookId: row.bookId, originalTitle: row.originalTitle, count: row.total };
  });

  return {
    totalBooks,
    byPublicationStatus,
    totalGrants,
    grantsPerBook,
    totalFiles: fileTotals[0]?.totalFiles ?? 0,
    totalBytes: Number(fileTotals[0]?.totalBytes ?? 0),
  };
}
