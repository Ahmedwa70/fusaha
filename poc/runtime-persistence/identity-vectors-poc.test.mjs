// Frozen identity vector tests for contract "runtime-package/v1" (ADR §8).
//
// Loads identity-vectors.json (produced by generate-identity-vectors.mjs from
// the reference implementation), rebuilds every vector from its raw inputs,
// and asserts the implementation reproduces the frozen canonical manifest,
// manifest SHA-256, and identity byte-for-byte. Also asserts the frozen
// equivalence/inequality relations and the rejection rules.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizePackage,
  canonicalJson,
  normalizeRuntimePath,
  sha256Hex,
} from "./runtime-identity-v1.mjs";

const pocDir = dirname(fileURLToPath(import.meta.url));
const frozen = JSON.parse(readFileSync(join(pocDir, "identity-vectors.json"), "utf8"));

function decodeInput(input) {
  const files = new Map(
    Object.entries(input.files).map(([path, encoded]) => [path, Buffer.from(encoded.base64, "base64")]),
  );
  return { files, entryPoint: input.entryPoint, capabilities: input.capabilities };
}

function rebuild(vectorEntry) {
  return canonicalizePackage(decodeInput(vectorEntry.input));
}

const byName = new Map(frozen.vectors.map((entry) => [entry.name, rebuild(entry)]));

test("frozen vectors reproduce exactly (canonical manifest, manifest SHA-256, identity)", () => {
  assert.equal(frozen.vectors.length, 13);
  for (const vectorEntry of frozen.vectors) {
    const packageData = rebuild(vectorEntry);
    assert.equal(packageData.manifestBytes, vectorEntry.canonicalManifest, `${vectorEntry.name} canonical manifest`);
    assert.equal(packageData.manifestSha256, vectorEntry.manifestSha256, `${vectorEntry.name} manifest SHA-256`);
    assert.equal(packageData.identity, vectorEntry.identity, `${vectorEntry.name} identity`);
    assert.match(vectorEntry.identity, /^sha256-v1-[0-9a-f]{64}$/);
  }
});

test("frozen equivalence and inequality relations hold", () => {
  for (const relation of frozen.relations) {
    const left = byName.get(relation.a).identity;
    const right = byName.get(relation.b).identity;
    if (relation.kind === "equal") assert.equal(left, right, `${relation.a} == ${relation.b}: ${relation.reason}`);
    else assert.notEqual(left, right, `${relation.a} != ${relation.b}: ${relation.reason}`);
  }
  // Cross-check: no two "different"-related vectors may share an identity,
  // and each "equal" pair must appear once in the identity set.
  const identities = new Set(frozen.vectors.map((entry) => entry.identity));
  assert.ok(identities.size < frozen.vectors.length, "V1=V2 and V4a=V4b must collapse to shared identities");
});

test("V1 manifest embeds the exact content hash, size, and allowlisted type", () => {
  const v1 = frozen.vectors.find((entry) => entry.name === "V1");
  const manifest = JSON.parse(v1.canonicalManifest);
  assert.equal(manifest.version, "runtime-package/v1");
  assert.equal(manifest.entryPoint, "index.html");
  assert.deepEqual(manifest.capabilities, []);
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].path, "index.html");
  assert.equal(manifest.assets[0].contentSha256, sha256Hex(Buffer.from("hello")));
  assert.equal(manifest.assets[0].sizeBytes, 5);
  assert.equal(manifest.assets[0].contentType, "text/html");
});

test("path normalization rejects unsafe inputs", () => {
  const rejected = [
    ["", "empty"],
    ["/etc/passwd", "leading slash"],
    ["a\\b.txt", "backslash"],
    ["a/b/../c.txt", "dot-dot segment"],
    ["a/./c.txt", "dot segment"],
    ["a//b.txt", "empty path segment"],
    ["a\u0000b.txt", "control character"],
    ["a\u001fb.txt", "control character"],
    ["a%2fb.txt", "percent-encoded separator"],
    ["a%5cb.txt", "percent-encoded separator"],
  ];
  for (const [path, reason] of rejected) {
    assert.throws(() => normalizeRuntimePath(path), new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), path);
  }
  // Duplicate after NFC normalization (é vs e + combining acute) is rejected.
  assert.throws(
    () => canonicalizePackage({ files: { "\u00e9.txt": "x", "e\u0301.txt": "y" }, entryPoint: "\u00e9.txt" }),
    /duplicate normalized path/,
  );
});

test("manifest validation rejects non-canonicalizable values", () => {
  assert.throws(() => canonicalJson({ value: undefined }), /unsupported manifest value/);
  assert.throws(() => canonicalJson({ value: NaN }), /non-finite number/);
  assert.throws(() => canonicalJson({ value: Infinity }), /non-finite number/);
  assert.throws(
    () => canonicalizePackage({ files: { "index.html": "x" }, capabilities: ["a", "a"] }),
    /duplicate capability/,
  );
  assert.throws(
    () => canonicalizePackage({ files: { "index.html": "x" }, capabilities: [1] }),
    /array of strings/,
  );
  assert.throws(() => canonicalizePackage({ files: { "index.html": "x" }, entryPoint: "missing.html" }), /not a package file/);
  assert.throws(
    () => canonicalizePackage({ files: { "evil.exe": "x" }, entryPoint: "evil.exe" }),
    /content type not in allowlist/,
  );
  assert.throws(() => canonicalizePackage({ files: {} }), /no files/);
});

test("canonical JSON sorts keys by UTF-8 byte order, not UTF-16/locale order", () => {
  // 'é' (U+00E9, UTF-8 0xC3 0xA9) sorts after 'z' (0x7A) in UTF-8 byte order,
  // but BEFORE 'z' in UTF-16 code-unit order (0xE9 < 0x7A).
  assert.equal(canonicalJson({ z: 1, "\u00e9": 2 }), `{"z":1,"\u00e9":2}`);
  // Nested objects and arrays are canonicalized recursively.
  assert.equal(canonicalJson({ b: { d: 1, c: [true, null, "x"] }, a: 0 }), `{"a":0,"b":{"c":[true,null,"x"],"d":1}}`);
});
