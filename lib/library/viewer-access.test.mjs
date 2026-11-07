// Shared-path regression tests: the REAL resolveLibraryBookAccess (with the
// real access policy) must deny unpublished/unverified books on both read and
// download, and must flip to denied on the next resolution after revocation.
import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./viewer-access.test-hooks.mjs", import.meta.url).href);

const { dalState } = await import("./test-stubs/auth-dal-stub.mjs");
const { bookFilesState } = await import("./test-stubs/book-files-stub.mjs");
const { resolveLibraryBookAccess } = await import("./viewer.ts");

const signedInViewer = { userId: "u1", roleId: "r-member" };
const managerViewer = { userId: "a1", roleId: "r-admin" };

const makeBook = (overrides = {}) => ({
  id: "b1",
  slug: "test-book",
  accessStatus: "free_reading",
  publicationStatus: "published",
  reviewStatus: "verified",
  ...overrides,
});

const makeBundle = (book) => ({
  book,
  bookFile: { bookId: book.id, fileId: "f1" },
  file: { id: "f1", storageKey: "library/pdfs/ab/abcdef.pdf" },
});

beforeEach(() => {
  dalState.user = signedInViewer;
  dalState.permissionKeys = new Set();
  bookFilesState.bundle = makeBundle(makeBook());
  bookFilesState.grant = false;
});

describe("resolveLibraryBookAccess — published+verified books", () => {
  test("free_reading: read allowed, download denied without a grant", async () => {
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: true });
    assert.deepEqual(access.download, { allowed: false, reason: "no_grant" });
  });

  test("explicit grant unlocks both read (non-free book) and download", async () => {
    bookFilesState.bundle = makeBundle(makeBook({ accessStatus: "purchase" }));
    bookFilesState.grant = true;
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: true });
    assert.deepEqual(access.download, { allowed: true });
  });

  test("revocation takes effect on the next resolution", async () => {
    bookFilesState.bundle = makeBundle(makeBook({ accessStatus: "purchase" }));
    bookFilesState.grant = true;
    const before = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(before.download, { allowed: true });
    bookFilesState.grant = false; // grant row deleted between requests
    const after = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(after.download, { allowed: false, reason: "no_grant" });
    assert.deepEqual(after.read, { allowed: false, reason: "access_status" });
  });
});

describe("resolveLibraryBookAccess — publication gate", () => {
  test("a draft book is denied on read and download", async () => {
    bookFilesState.bundle = makeBundle(makeBook({ publicationStatus: "draft" }));
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: false, reason: "not_published" });
    assert.deepEqual(access.download, { allowed: false, reason: "not_published" });
  });

  test("an unverified published book is denied on read and download", async () => {
    bookFilesState.bundle = makeBundle(makeBook({ reviewStatus: "needs_review" }));
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: false, reason: "not_published" });
    assert.deepEqual(access.download, { allowed: false, reason: "not_published" });
  });

  test("the gate applies to library managers too", async () => {
    dalState.user = managerViewer;
    dalState.permissionKeys = new Set(["libraryUpdate"]);
    bookFilesState.bundle = makeBundle(makeBook({ publicationStatus: "draft" }));
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: false, reason: "not_published" });
    assert.deepEqual(access.download, { allowed: false, reason: "not_published" });
  });

  test("unauthenticated visitors are denied", async () => {
    dalState.user = null;
    const access = await resolveLibraryBookAccess("test-book");
    assert.deepEqual(access.read, { allowed: false, reason: "unauthenticated" });
    assert.deepEqual(access.download, { allowed: false, reason: "unauthenticated" });
  });
});
