import { createHash } from "node:crypto";

// Content addressing for the library file store. The SHA-256 of the bytes
// is the single dedup identity: it is the database unique key, and it
// deterministically derives the R2 object key, so identical uploads always
// converge on one storage object and the DB constraints make that atomic.

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export const LIBRARY_PDF_CONTENT_TYPE = "application/pdf";

// Deterministic, non-guessable-by-content key: the hash itself is the key
// namespaced under library/. Two servers racing the same upload write the
// same key with identical bytes, so the race is harmless.
export function buildStorageKey(sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("storage keys can only be derived from a lowercase SHA-256 hex digest");
  }
  return `library/pdfs/${sha256.slice(0, 2)}/${sha256}.pdf`;
}

export const LIBRARY_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export function isAllowedUploadMime(contentType: string): boolean {
  return contentType === LIBRARY_PDF_CONTENT_TYPE;
}
