import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canDownloadLibraryBook, canReadLibraryBook } from "./access-policy.ts";

const viewer = { userId: "u1", canManageLibrary: false };
const admin = { userId: "a1", canManageLibrary: true };

describe("read policy", () => {
  test("unauthenticated users are denied", () => {
    assert.deepEqual(canReadLibraryBook(null, { hasFile: true, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "unauthenticated" });
  });

  test("free_reading grants in-platform reading to any signed-in user", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { hasFile: true, accessStatus: "free_reading", hasGrant: false }), { allowed: true });
  });

  test("non-free books require a grant", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { hasFile: true, accessStatus: "purchase", hasGrant: false }), { allowed: false, reason: "access_status" });
    assert.deepEqual(canReadLibraryBook(viewer, { hasFile: true, accessStatus: "purchase", hasGrant: true }), { allowed: true });
  });

  test("library managers can always read", () => {
    assert.deepEqual(canReadLibraryBook(admin, { hasFile: true, accessStatus: "unknown", hasGrant: false }), { allowed: true });
  });

  test("a book without a file cannot be read", () => {
    assert.deepEqual(canReadLibraryBook(viewer, { hasFile: false, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "no_file" });
  });
});

describe("download policy — deliberately separated from read", () => {
  test("free_reading NEVER implies download", () => {
    assert.deepEqual(canDownloadLibraryBook(viewer, { hasFile: true, accessStatus: "free_reading", hasGrant: false }), { allowed: false, reason: "no_grant" });
  });

  test("an explicit grant unlocks download", () => {
    assert.deepEqual(canDownloadLibraryBook(viewer, { hasFile: true, accessStatus: "free_reading", hasGrant: true }), { allowed: true });
  });

  test("library managers can always download", () => {
    assert.deepEqual(canDownloadLibraryBook(admin, { hasFile: true, accessStatus: "unknown", hasGrant: false }), { allowed: true });
  });

  test("unauthenticated users and books without files are denied", () => {
    assert.deepEqual(canDownloadLibraryBook(null, { hasFile: true, accessStatus: "free_reading", hasGrant: true }), { allowed: false, reason: "unauthenticated" });
    assert.deepEqual(canDownloadLibraryBook(viewer, { hasFile: false, accessStatus: "free_reading", hasGrant: true }), { allowed: false, reason: "no_file" });
  });
});
