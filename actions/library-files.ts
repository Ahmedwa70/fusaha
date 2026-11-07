"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { libraryBooks } from "@/database/schema";
import { Permissions } from "@/constants/permissions";
import { requirePermission } from "@/lib/auth/dal";
import { recordAuditLog } from "@/lib/admin/audit-log";
import {
  buildStorageKey,
  isAllowedUploadMime,
  LIBRARY_PDF_CONTENT_TYPE,
  LIBRARY_UPLOAD_MAX_BYTES,
  sha256Hex,
} from "@/lib/library/storage/content-addressing";
import { putLibraryObject } from "@/lib/library/storage/r2-client";
import {
  deleteDownloadGrant,
  findLibraryFileBySha256,
  findUserByEmail,
  getBookFileByBookId,
  insertDownloadGrant,
  insertLibraryFile,
  upsertBookFileLink,
} from "@/lib/library/book-files";

// Admin file management for the library: uploading a book's PDF (content-
// addressed, deduplicated atomically by the database unique constraints)
// and granting/revoking per-user download rights. Reading is governed
// separately by accessStatus; download grants never widen automatically.

type FileActionState = { success: true; deduplicated: boolean; sizeBytes: number } | { error: string };

async function errorMessage(key: "notFound" | "invalidFile" | "notPdf" | "fileTooLarge" | "userNotFound" | "unexpected") {
  const t = await getTranslations("admin.library.errors");
  return t(key);
}

export async function uploadLibraryBookFile(bookId: string, formData: FormData): Promise<FileActionState> {
  const admin = await requirePermission(Permissions.libraryUpdate);
  const [book] = await db.select({ id: libraryBooks.id, slug: libraryBooks.slug }).from(libraryBooks).where(eq(libraryBooks.id, bookId)).limit(1);
  if (!book) return { error: await errorMessage("notFound") };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: await errorMessage("invalidFile") };
  if (!isAllowedUploadMime(file.type)) return { error: await errorMessage("notPdf") };
  if (file.size === 0 || file.size > LIBRARY_UPLOAD_MAX_BYTES) return { error: await errorMessage("fileTooLarge") };

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = sha256Hex(buffer);

  // Dedup: identical bytes already on record? Link the existing file and
  // skip the storage round-trip entirely.
  const existing = await findLibraryFileBySha256(sha256);
  let deduplicated = !!existing;

  if (!existing) {
    const storageKey = buildStorageKey(sha256);
    await putLibraryObject(storageKey, buffer, LIBRARY_PDF_CONTENT_TYPE);
    // UNIQUE(sha256) makes the insert atomic: a racing identical upload
    // takes the DO NOTHING branch and both sides link the same row.
    await insertLibraryFile({
      sha256,
      storageKey,
      sizeBytes: buffer.byteLength,
      contentType: LIBRARY_PDF_CONTENT_TYPE,
      originalFilename: file.name,
      uploadedBy: admin.id,
    });
  }

  const fileRow = await findLibraryFileBySha256(sha256);
  if (!fileRow) return { error: await errorMessage("unexpected") };
  await upsertBookFileLink(bookId, fileRow.id);

  await recordAuditLog({
    userId: admin.id,
    action: "library.file.upload",
    resourceType: "library-book",
    resourceId: bookId,
    newValues: {
      fileId: fileRow.id,
      sha256,
      sizeBytes: buffer.byteLength,
      originalFilename: file.name,
      deduplicated,
    },
  });

  revalidatePath(`/admin/library/${bookId}`);
  revalidatePath(`/library/${book.slug}`);
  revalidatePath(`/library/${book.slug}/read`);
  return { success: true, deduplicated, sizeBytes: buffer.byteLength };
}

export async function grantLibraryDownload(bookId: string, email: string): Promise<{ success: true } | { error: string }> {
  const admin = await requirePermission(Permissions.libraryUpdate);
  const bundle = await getBookFileByBookId(bookId);
  if (!bundle) return { error: await errorMessage("notFound") };
  const target = await findUserByEmail(email.trim().toLowerCase());
  if (!target) return { error: await errorMessage("userNotFound") };

  const inserted = await insertDownloadGrant(bookId, target.id, admin.id);
  if (inserted) {
    await recordAuditLog({
      userId: admin.id,
      action: "library.download.grant",
      resourceType: "library-book",
      resourceId: bookId,
      newValues: { grantedTo: target.id, email: target.email },
    });
  }
  revalidatePath(`/admin/library/${bookId}`);
  return { success: true };
}

export async function revokeLibraryDownload(bookId: string, grantId: string): Promise<{ success: true } | { error: string }> {
  const admin = await requirePermission(Permissions.libraryUpdate);
  const removed = await deleteDownloadGrant(grantId);
  if (removed) {
    await recordAuditLog({
      userId: admin.id,
      action: "library.download.revoke",
      resourceType: "library-book",
      resourceId: bookId,
      oldValues: { grantId },
    });
  }
  revalidatePath(`/admin/library/${bookId}`);
  return { success: true };
}
