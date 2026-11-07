// Regression test: deleteDownloadGrant must scope the DELETE to BOTH the
// grant id and the book id, so a grant belonging to another book cannot be
// revoked through this path.
import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./book-files-grants.test-hooks.mjs", import.meta.url).href);

const { deleteCalls, resetDeleteCalls, flattenSql } = await import("./test-stubs/delete-recorder.mjs");
const { deleteDownloadGrant } = await import("./book-files.ts");

beforeEach(resetDeleteCalls);

describe("deleteDownloadGrant scoping", () => {
  test("the DELETE is constrained by grant id AND book id", async () => {
    const removed = await deleteDownloadGrant("book-1", "grant-9");
    assert.equal(removed, true);
    assert.equal(deleteCalls.length, 1);
    const { columns, params } = flattenSql(deleteCalls[0].condition);
    assert.ok(columns.includes("id"), "WHERE must constrain the grant id column");
    assert.ok(columns.includes("book_id"), "WHERE must constrain the book id column");
    assert.ok(params.includes("grant-9"), "WHERE must bind the grant id");
    assert.ok(params.includes("book-1"), "WHERE must bind the book id");
  });
});
