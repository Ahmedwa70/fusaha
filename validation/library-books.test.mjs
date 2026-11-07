// Regression tests: the update path must carry the lifecycle fields and the
// shared transition rule must block publishing without the publication gate
// (verified + known accessStatus) — exactly like the dedicated publish action.
import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

register(new URL("./library-books.test-hooks.mjs", import.meta.url).href);

const { updateLibraryBookSchema, canTransitionToPublished } = await import("./library-books.ts");

const validBook = {
  slug: "test-book",
  originalTitle: "Test",
  authors: "Author",
  originalLanguage: "ar",
  category: "cat",
  audience: "aud",
  level: "lvl",
  skills: [],
  displayTitle: { ar: "عنوان", en: "Title" },
  description: { ar: "وصف", en: "Desc" },
  sourceName: "Source",
  sourceUrl: "https://example.com",
  destinationType: "publisher",
  accessStatus: "free_reading",
  publicationStatus: "draft",
  reviewStatus: "needs_review",
};

describe("updateLibraryBookSchema lifecycle invariants", () => {
  test("rejects publishing without verified review status", () => {
    const parsed = updateLibraryBookSchema.safeParse({
      ...validBook,
      publicationStatus: "published",
      reviewStatus: "needs_review",
    });
    assert.equal(parsed.success, false);
  });

  test("accepts a fully-qualified publish payload", () => {
    const parsed = updateLibraryBookSchema.safeParse({
      ...validBook,
      publicationStatus: "published",
      reviewStatus: "verified",
    });
    assert.equal(parsed.success, true);
  });

  test("carries the lifecycle fields instead of silently stripping them", () => {
    const parsed = updateLibraryBookSchema.safeParse({
      ...validBook,
      publicationStatus: "unpublished",
      reviewStatus: "verified",
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.publicationStatus, "unpublished");
    assert.equal(parsed.data.reviewStatus, "verified");
  });
});

describe("canTransitionToPublished — shared with the dedicated publish action", () => {
  test("draft → published with unknown accessStatus is blocked", () => {
    assert.equal(
      canTransitionToPublished({ publicationStatus: "draft" }, { publicationStatus: "published", reviewStatus: "verified", accessStatus: "unknown" }),
      false,
    );
  });

  test("draft → published requires verified review status", () => {
    assert.equal(
      canTransitionToPublished({ publicationStatus: "draft" }, { publicationStatus: "published", reviewStatus: "needs_review", accessStatus: "free_reading" }),
      false,
    );
  });

  test("draft → published passes with verified + known accessStatus", () => {
    assert.equal(
      canTransitionToPublished({ publicationStatus: "draft" }, { publicationStatus: "published", reviewStatus: "verified", accessStatus: "free_reading" }),
      true,
    );
  });

  test("re-publishing an already-published book is not blocked by accessStatus", () => {
    assert.equal(
      canTransitionToPublished({ publicationStatus: "published" }, { publicationStatus: "published", reviewStatus: "verified", accessStatus: "unknown" }),
      true,
    );
  });

  test("non-publish transitions are unaffected", () => {
    assert.equal(
      canTransitionToPublished({ publicationStatus: "published" }, { publicationStatus: "unpublished", reviewStatus: "needs_review", accessStatus: "unknown" }),
      true,
    );
  });
});
