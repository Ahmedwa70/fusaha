// Tests for the three dashboard Server Actions: permission rejection must
// happen before any database access, invalid input must be rejected with an
// error state, and valid calls must issue the expected read-only queries.
import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./library-admin.test-hooks.mjs", import.meta.url).href);

const dalState = (await import("./test-stubs/dal-stub.mjs")).dalState;
const recorder = await import("./test-stubs/select-recorder.mjs");
const { listLibraryBooks, searchLibraryMembers, getLibraryStats } = await import("./library.ts");

// Like the recorder's flattenSql, but also captures literal string fragments
// (drizzle inlines some values instead of binding them as Params).
function flattenAll(node) {
  const columns = [];
  const params = [];
  const walk = (chunk) => {
    if (chunk == null) return;
    if (Array.isArray(chunk)) return chunk.forEach(walk);
    if (typeof chunk === "string") {
      if (chunk.trim()) params.push(chunk);
      return;
    }
    if (chunk.constructor?.name === "SQL") return walk(chunk.queryChunks);
    if (typeof chunk.name === "string" && chunk.table) return columns.push(chunk.name);
    if (chunk.constructor?.name === "Param") return params.push(chunk.value);
    walk(chunk.queryChunks);
  };
  walk(node?.queryChunks ?? node);
  return { columns, params };
}

beforeEach(() => {
  dalState.deny = false;
  recorder.resetSelectCalls();
});

describe("listLibraryBooks", () => {
  test("rejects without library.list permission and never queries the db", async () => {
    dalState.deny = true;
    await assert.rejects(() => listLibraryBooks({ page: 1 }), /unauthorized/);
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("rejects invalid input (page 0) without querying the db", async () => {
    const result = await listLibraryBooks({ page: 0 });
    assert.deepEqual(result, { error: "invalidData" });
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("rejects an unknown publication status", async () => {
    const result = await listLibraryBooks({ publicationStatus: "bogus" });
    assert.deepEqual(result, { error: "invalidData" });
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("valid filters issue a paged, filtered, read-only pair of queries", async () => {
    const result = await listLibraryBooks({ publicationStatus: "published", query: "fusaha", page: 2, pageSize: 10 });
    assert.equal(result.success, true);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 10);
    assert.equal(result.totalPages, 1);
    assert.equal(recorder.selectCalls.length, 2);
    const [rowsQuery, countQuery] = recorder.selectCalls;
    assert.equal(rowsQuery.limit, 10);
    assert.equal(rowsQuery.offset, 10);
    const { columns, params } = recorder.flattenSql(rowsQuery.where);
    assert.ok(columns.includes("publication_status"));
    assert.ok(params.includes("published"));
    assert.ok(columns.includes("original_title"));
    assert.ok(columns.includes("slug"));
    assert.ok(params.every((p) => typeof p !== "string" || !p.includes("fusaha%") || p.includes("\\")));
    recorder.flattenSql(countQuery.where);
  });
});

describe("searchLibraryMembers", () => {
  test("rejects without library.update permission and never queries the db", async () => {
    dalState.deny = true;
    await assert.rejects(() => searchLibraryMembers({ query: "ahmed" }), /unauthorized/);
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("rejects an empty query", async () => {
    const result = await searchLibraryMembers({ query: "   " });
    assert.deepEqual(result, { error: "invalidData" });
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("valid fragment queries users.email with an escaped pattern", async () => {
    const result = await searchLibraryMembers({ query: "a%b" });
    assert.equal(result.success, true);
    assert.deepEqual(result.members, []);
    assert.equal(recorder.selectCalls.length, 1);
    const { columns, params } = flattenAll(recorder.selectCalls[0].where);
    assert.deepEqual(columns, ["email"]);
    assert.deepEqual(params, ["%a\\%b%"]);
  });
});

describe("getLibraryStats", () => {
  test("rejects without library.list permission and never queries the db", async () => {
    dalState.deny = true;
    await assert.rejects(() => getLibraryStats(), /unauthorized/);
    assert.equal(recorder.selectCalls.length, 0);
  });

  test("returns the full snapshot shape from three aggregate queries", async () => {
    const result = await getLibraryStats();
    assert.equal(result.success, true);
    assert.deepEqual(result.stats, {
      totalBooks: 0,
      byPublicationStatus: { draft: 0, pending_review: 0, published: 0, unpublished: 0, archived: 0 },
      totalGrants: 0,
      grantsPerBook: [],
      totalFiles: 0,
      totalBytes: 0,
    });
    assert.equal(recorder.selectCalls.length, 3);
    const [bookCounts, grantCounts, fileTotals] = recorder.selectCalls;
    assert.ok(bookCounts.groupBy, "book counts must group by publication status");
    assert.ok(grantCounts.innerJoin, "grant counts must join library_books");
    assert.ok(grantCounts.groupBy, "grant counts must group by book");
    assert.equal(fileTotals.groupBy ?? null, null);
    recorder.flattenSql(grantCounts.where ?? grantCounts.innerJoin);
  });
});
