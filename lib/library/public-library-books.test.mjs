import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./public-library-books.test-hooks.mjs", import.meta.url).href);

const { listPublishedLibraryBooks, getPublishedLibraryBookBySlug } = await import("./public-books.ts");
const { selectCalls, resetSelectCalls, flattenSql } = await import("./test-stubs/db-recorder.mjs");

describe("public library catalog queries", () => {
  beforeEach(() => resetSelectCalls());

  test("listPublishedLibraryBooks filters to published + verified and orders by publishedAt desc", async () => {
    await listPublishedLibraryBooks();
    assert.equal(selectCalls.length, 1);
    const call = selectCalls[0];
    const where = flattenSql(call.where);
    assert.ok(where.columns.includes("publication_status"), "WHERE must reference publication_status");
    assert.ok(where.columns.includes("review_status"), "WHERE must reference review_status");
    assert.ok(where.params.includes("published"), "WHERE must require publication_status = published");
    assert.ok(where.params.includes("verified"), "WHERE must require review_status = verified");
    // Drafts and unverified records are excluded by the same condition — no
    // separate code path may widen it.
    assert.equal(where.params.filter((param) => param === "published" || param === "verified" || param === "draft").length, 2);
    const orderBy = flattenSql(call.orderBy);
    assert.ok(orderBy.columns.includes("published_at"), "ORDER BY must reference published_at");
    assert.equal(call.limit, undefined);
  });

  test("listPublishedLibraryBooks projects only public-safe fields", async () => {
    await listPublishedLibraryBooks();
    const fields = Object.keys(selectCalls[0].fields).sort();
    for (const forbidden of ["createdBy", "updatedBy", "isbn", "originalLanguage", "originalTitle"]) {
      assert.ok(!fields.includes(forbidden), `public projection must not include ${forbidden}`);
    }
    for (const required of ["slug", "displayTitle", "description", "authors", "category", "audience", "level", "sourceName", "sourceUrl", "accessStatus", "coverUrl", "publishedAt"]) {
      assert.ok(fields.includes(required), `public projection must include ${required}`);
    }
  });

  test("getPublishedLibraryBookBySlug adds the slug condition on top of published + verified", async () => {
    const rows = await getPublishedLibraryBookBySlug("some-book");
    assert.equal(rows, null, "empty result set resolves to null");
    assert.equal(selectCalls.length, 1);
    const call = selectCalls[0];
    const where = flattenSql(call.where);
    assert.ok(where.columns.includes("slug"), "WHERE must reference slug");
    assert.ok(where.params.includes("some-book"), "WHERE must bind the requested slug");
    assert.ok(where.params.includes("published"), "slug lookup must still require published");
    assert.ok(where.params.includes("verified"), "slug lookup must still require verified");
    assert.equal(call.limit, 1);
  });
});
