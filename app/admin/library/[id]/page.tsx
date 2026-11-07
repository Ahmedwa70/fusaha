import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { db } from "@/lib/db";
import { libraryBooks } from "@/database/schema";
import { LibraryBookForm } from "../_components/library-book-form";
import { LibraryLifecycleActions } from "../_components/library-lifecycle-actions";
import { LibraryFilePanel } from "../_components/library-file-panel";
import { LibraryDownloadGrantsPanel } from "../_components/library-download-grants";
import { getBookFileByBookId, listDownloadGrants } from "@/lib/library/book-files";

export default async function EditLibraryBookPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(Permissions.libraryUpdate);
  const { id } = await params;
  const [book] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!book) notFound();
  const localized = (value: Record<string, string> | null | undefined) => ({ ar: value?.ar ?? "", en: value?.en ?? "", zh: value?.zh ?? "" });
  const initialValues = {
    slug: book.slug, originalTitle: book.originalTitle, authors: book.authors, publisher: book.publisher ?? undefined,
    publicationYear: book.publicationYear ?? undefined, originalLanguage: book.originalLanguage, isbn: book.isbn ?? undefined,
    category: book.category, audience: book.audience, level: book.level, skills: book.skills,
    displayTitle: localized(book.displayTitle), description: localized(book.description),
    longDescription: book.longDescription ? localized(book.longDescription) : undefined,
    sourceName: book.sourceName, sourceUrl: book.sourceUrl, destinationType: book.destinationType as "publisher" | "author" | "institution" | "library" | "other",
    accessStatus: book.accessStatus as "free_reading" | "preview" | "purchase" | "institutional_access" | "unknown",
    accessNotes: book.accessNotes ? localized(book.accessNotes) : undefined, coverUrl: book.coverUrl ?? undefined,
    coverAlt: book.coverAlt ? localized(book.coverAlt) : undefined,
  };
  const [bundle, grants] = await Promise.all([getBookFileByBookId(id), listDownloadGrants(id)]);
  const attachedFile = bundle
    ? { originalFilename: bundle.file.originalFilename, sizeBytes: bundle.file.sizeBytes, sha256: bundle.file.sha256, createdAt: bundle.file.createdAt.toISOString() }
    : null;
  const grantItems = grants.map((grant) => ({ id: grant.id, userEmail: grant.userEmail, createdAt: grant.createdAt.toISOString() }));
  return <div className="space-y-6"><LibraryBookForm mode="edit" id={id} initialValues={initialValues} lifecycle={{ publicationStatus: book.publicationStatus as "draft" | "pending_review" | "published" | "unpublished" | "archived", reviewStatus: book.reviewStatus as "needs_review" | "verified" }} /><LibraryFilePanel bookId={id} file={attachedFile} /><LibraryDownloadGrantsPanel bookId={id} grants={grantItems} /><LibraryLifecycleActions id={id} status={book.publicationStatus} /></div>;
}
