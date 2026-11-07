// Unit tests for the pure pieces of the admin catalog queries: LIKE
// escaping, pagination math, and the exact WHERE conditions the filters
// build. No database is touched.
import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

register(new URL("./admin-queries.test-hooks.mjs", import.meta.url).href);

const { escapeIlikePattern, computePagination, buildBookListConditions } = await import("./admin-queries.ts");

// Flattens a Drizzle SQL tree like test-stubs/db-recorder.mjs, but also
// captures literal string fragments — drizzle inlines some values instead
// of binding them as Params.
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

describe("escapeIlikePattern", () => {
  test("escapes LIKE wildcards and backslashes", () => {
    assert.equal(escapeIlikePattern("100%_off\\sale"), "100\\%\\_off\\\\sale");
  });

  test("leaves ordinary text (including CJK/Arabic) untouched", () => {
    assert.equal(escapeIlikePattern("في العسل شفاء"), "في العسل شفاء");
  });
});

describe("computePagination", () => {
  test("computes totalPages and clamps to at least one", () => {
    assert.deepEqual(computePagination(1, 20, 0), { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    assert.deepEqual(computePagination(2, 10, 25), { page: 2, pageSize: 10, total: 25, totalPages: 3 });
  });
});

describe("buildBookListConditions", () => {
  test("no filters produce no conditions", () => {
    assert.deepEqual(buildBookListConditions({}), []);
  });

  test("publication and review filters become equality conditions", () => {
    const conditions = buildBookListConditions({ publicationStatus: "published", reviewStatus: "verified" });
    assert.equal(conditions.length, 2);
    const { columns, params } = flattenAll(conditions[0]);
    assert.deepEqual(columns, ["publication_status"]);
    assert.deepEqual(params, ["published"]);
  });

  test("a query matches originalTitle OR slug with escaped wildcards", () => {
    const conditions = buildBookListConditions({ query: "علم%" });
    assert.equal(conditions.length, 1);
    const { columns, params } = flattenAll(conditions[0]);
    assert.deepEqual(columns.sort(), ["original_title", "slug"]);
    assert.deepEqual(params, ["%علم\\%%", "%علم\\%%"]);
  });
});
