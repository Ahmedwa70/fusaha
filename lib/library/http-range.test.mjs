import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseByteRange } from "./http-range.ts";

describe("parseByteRange", () => {
  test("parses a closed range", () => {
    assert.deepEqual(parseByteRange("bytes=0-1023"), { header: "bytes=0-1023", start: 0, end: 1023 });
    assert.deepEqual(parseByteRange("bytes=500-999"), { header: "bytes=500-999", start: 500, end: 999 });
  });

  test("parses an open-ended range", () => {
    assert.deepEqual(parseByteRange("bytes=1024-"), { header: "bytes=1024-", start: 1024 });
  });

  test("returns null for missing or malformed headers", () => {
    assert.equal(parseByteRange(null), null);
    assert.equal(parseByteRange(""), null);
    assert.equal(parseByteRange("items=0-10"), null);
    assert.equal(parseByteRange("bytes=-500"), null); // suffix ranges not supported by the storage proxy
    assert.equal(parseByteRange("bytes=abc-def"), null);
    assert.equal(parseByteRange("bytes=100-50"), null); // inverted
    assert.equal(parseByteRange("bytes=0-1,5-6"), null); // multi-range not supported
  });

  test("tolerates surrounding whitespace", () => {
    assert.deepEqual(parseByteRange("  bytes=0-99 "), { header: "bytes=0-99", start: 0, end: 99 });
  });
});
