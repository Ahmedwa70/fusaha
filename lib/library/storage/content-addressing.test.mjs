import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { buildStorageKey, isAllowedUploadMime, LIBRARY_UPLOAD_MAX_BYTES, sha256Hex } from "./content-addressing.ts";

describe("content addressing", () => {
  test("sha256Hex matches the well-known SHA-256 test vector", () => {
    assert.equal(sha256Hex(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.equal(sha256Hex(Buffer.from("")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  test("buildStorageKey derives a deterministic namespaced key", () => {
    const sha = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    assert.equal(buildStorageKey(sha), `library/pdfs/ba/${sha}.pdf`);
    assert.equal(buildStorageKey(sha), buildStorageKey(sha));
  });

  test("buildStorageKey rejects anything that is not a lowercase SHA-256 hex digest", () => {
    for (const bad of ["XYZ781bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "abc", "ba7816bf"]) {
      assert.throws(() => buildStorageKey(bad));
    }
  });

  test("upload gate accepts PDF only and enforces the size ceiling", () => {
    assert.ok(isAllowedUploadMime("application/pdf"));
    assert.ok(!isAllowedUploadMime("application/zip"));
    assert.ok(!isAllowedUploadMime("image/png"));
    assert.ok(LIBRARY_UPLOAD_MAX_BYTES === 100 * 1024 * 1024);
  });

  test("the storage key is derivable from the same hash the DB unique key uses", () => {
    const bytes = Buffer.from("identical bytes always converge");
    const sha = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha, sha256Hex(bytes));
    assert.equal(buildStorageKey(sha256Hex(bytes)).includes(sha), true);
  });
});
