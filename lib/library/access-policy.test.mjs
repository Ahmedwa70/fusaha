import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canDownloadLibraryBook, canReadLibraryBook } from "./access-policy.ts";

const viewer = { userId: "u1", canManageLibrary: false };
const admin = { userId: "a1", canManageLibrary: true };
const published = { hasFile: true, isPublished: true };
const draft = { hasFile: true, isPublished: false };

describe("read policy", () => {
  test("unauthenticated users are denied", () => {
    assert.deepEqual(canReadLibraryBook(null, { ...published, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "unauthenticated" });
  });

  test("free_reading grants in-platform reading to any signed-in user", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { ...published, accessStatus: "free_reading", hasGrant: false }), { allowed: true });
  });

  test("non-free books require a grant", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { ...published, accessStatus: "purchase", hasGrant: false }), { allowed: false, reason: "access_status" });
    assert.deepEqual(canReadLibraryBook(viewer, { ...published, accessStatus: "purchase", hasGrant: true }), { allowed: true });
  });

  test("library managers can read published books", () => {
    assert.deepEqual(canReadLibraryBook(admin, { ...published, accessStatus: "unknown", hasGrant: false }), { allowed: true });
  });

  test("a book without a file cannot be read", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { hasFile: false, isPublished: true, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "no_file" });
  });

  test("drafts and unverified books are denied to everyone, including managers", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { ...draft, accessStatus: "free_reading", hasGrant: true }), { allowed: false, reason: "not_published" });
    assert.deepEqual(canReadLibraryBook(admin, { ...draft, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "not_published" });
  });
});

describe("download policy — deliberately separated from read", () => {
  test("free_reading NEVER implies download", () => {
    assert.deepEqual(canDownloadLibraryBook(viewer, { ...published, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "no_grant" });
  });

  test("an explicit grant unlocks download", () => {
    assert.deepEqual(canDownloadLibraryBook(viewer, { ...published, accessStatus: "free_reading", hasGrant: true }), { allowed: true });
  });

  test("library managers can download published books", () => {
    assert.deepEqual(canDownloadLibraryBook(admin, { ...published, accessStatus: "unknown", hasGrant: false }), { allowed: true });
  });

  test("unauthenticated users and books without files are denied", () => {
    assert.deepEqual(canDownloadLibraryBook(null, { ...published, accessStatus: "free_reading", hasGrant: true }), { allowed: false, reason: "unauthenticated" });
    assert.deepEqual(canDownloadLibraryBook(viewer, { hasFile: false, isPublished: true, accessStatus: "free_reading", hasGrant: true }), { allowed: false, reason: "no_file" });
  });

  test("drafts cannot be downloaded even with a grant or manager role", () => {
    assert.deepEqual(canDownloadLibraryBook(viewer, { ...draft, accessStatus: "purchase", hasGrant: true }), { allowed: false, reason: "not_published" });
    assert.deepEqual(canDownloadLibraryBook(admin, { ...draft, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "not_published" });
  });

  test("revoking the grant flips the next decision to denied", () => {
    const before = { ...published, accessStatus: "purchase", hasGrant: true };
    const after = { ...published, accessStatus: "purchase", hasGrant: false };
    assert.deepEqual(canDownloadLibraryBook(viewer, before), { allowed: true });
    assert.deepEqual(canDownloadLibraryBook(viewer, after), { allowed: false, reason: "no_grant" });
    assert.deepEqual(canReadLibraryBook(viewer, after), { allowed: false, reason: "access_status" });
  });
});
