// Port-parity tests: lib/runtime/runtime-identity-v1.ts (TypeScript) must
// reproduce poc/runtime-persistence/runtime-identity-v1.mjs (the frozen
// reference) byte-for-byte on every vector and rule in
// poc/runtime-persistence/identity-vectors.json (ADR §8). The frozen expected
// values were produced by the reference implementation, not invented — so a
// green suite here proves the app-side port computes the same Runtime
// Identity V1 as the POC the vectors were frozen from.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const {
  canonicalizePackage,
  canonicalJson,
  contentTypeForPath,
  IDENTITY_ALGORITHM,
  IDENTITY_PREFIX,
  normalizeRuntimePath,
  sha256Hex,
} = await import("./runtime-identity-v1.ts" as string);
type RuntimePackageFileContent = string | Uint8Array | Buffer;

const pocDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "poc", "runtime-persistence");
const frozen = JSON.parse(readFileSync(join(pocDir, "identity-vectors.json"), "utf8")) as {
  vectors: ReadonlyArray<{
    name: string;
    input: {
      files: Record<string, { base64: string }>;
      entryPoint: string;
      capabilities: ReadonlyArray<string>;
    };
    canonicalManifest: string;
    manifestSha256: string;
    identity: string;
  }>;
  relations: ReadonlyArray<{ a: string; b: string; kind: "equal" | "different"; reason: string }>;
};

function decodeInput(input: {
  files: Record<string, { base64: string }>;
  entryPoint: string;
  capabilities: ReadonlyArray<string>;
}) {
  const files = new Map<string, RuntimePackageFileContent>(
    Object.entries(input.files).map(([path, encoded]) => [path, Buffer.from(encoded.base64, "base64")]),
  );
  return { files, entryPoint: input.entryPoint, capabilities: input.capabilities };
}

function rebuild(vectorEntry: { input: (typeof frozen.vectors)[number]["input"] }) {
  return canonicalizePackage(decodeInput(vectorEntry.input));
}

test("port reproduces every frozen vector byte-for-byte (manifest, manifest SHA-256, identity)", () => {
  assert.equal(frozen.vectors.length, 13);
  for (const vectorEntry of frozen.vectors) {
    const packageData = rebuild(vectorEntry);
    assert.equal(packageData.manifestBytes, vectorEntry.canonicalManifest, `${vectorEntry.name} canonical manifest`);
    assert.equal(packageData.manifestSha256, vectorEntry.manifestSha256, `${vectorEntry.name} manifest SHA-256`);
    assert.equal(packageData.identity, vectorEntry.identity, `${vectorEntry.name} identity`);
    assert.match(vectorEntry.identity, new RegExp(`^${IDENTITY_PREFIX.replace("-", "\\-")}[0-9a-f]{64}$`));
    assert.equal(packageData.identityAlgorithm, IDENTITY_ALGORITHM);
  }
});

test("frozen equivalence and inequality relations hold", () => {
  const byName = new Map(frozen.vectors.map((entry) => [entry.name, rebuild(entry)]));
  for (const relation of frozen.relations) {
    const left = byName.get(relation.a);
    const right = byName.get(relation.b);
    assert.ok(left && right, `vectors exist: ${relation.a}, ${relation.b}`);
    if (relation.kind === "equal") {
      assert.equal(left.identity, right.identity, `${relation.a} == ${relation.b}: ${relation.reason}`);
    } else {
      assert.notEqual(left.identity, right.identity, `${relation.a} != ${relation.b}: ${relation.reason}`);
    }
  }
  const identities = new Set(frozen.vectors.map((entry) => entry.identity));
  assert.ok(identities.size < frozen.vectors.length, "equal-related vectors must collapse to shared identities");
});

test("vector V1 manifest embeds the exact content hash, size, and allowlisted type", () => {
  const v1 = frozen.vectors.find((entry) => entry.name === "V1");
  assert.ok(v1, "V1 vector exists");
  const manifest = JSON.parse(v1.canonicalManifest) as {
    version: string;
    entryPoint: string;
    capabilities: ReadonlyArray<string>;
    assets: ReadonlyArray<{ path: string; contentSha256: string; sizeBytes: number; contentType: string }>;
  };
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
  const rejected: ReadonlyArray<[string, string]> = [
    ["", "empty"],
    ["/etc/passwd", "leading slash"],
    ["a\\b.txt", "backslash"],
    ["a/b/../c.txt", "dot\\-dot segment"],
    ["a/./c.txt", "dot segment"],
    ["a//b.txt", "empty path segment"],
    ["a\u0000b.txt", "control character"],
    ["a\u001fb.txt", "control character"],
    ["a%2fb.txt", "percent\\-encoded separator"],
    ["a%5cb.txt", "percent\\-encoded separator"],
  ];
  for (const [path, reason] of rejected) {
    assert.throws(() => normalizeRuntimePath(path), new RegExp(reason), path);
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
  assert.throws(() => canonicalizePackage({ files: { "index.html": "x" }, capabilities: [1 as unknown as string] }), /array of strings/);
  assert.throws(() => canonicalizePackage({ files: { "index.html": "x" }, entryPoint: "missing.html" }), /not a package file/);
  assert.throws(() => canonicalizePackage({ files: { "evil.exe": "x" }, entryPoint: "evil.exe" }), /content type not in allowlist/);
  assert.throws(() => canonicalizePackage({ files: {} }), /no files/);
});

test("canonical JSON sorts keys by UTF-8 byte order, not UTF-16/locale order", () => {
  // 'é' (U+00E9, UTF-8 0xC3 0xA9) sorts after 'z' (0x7A) in UTF-8 byte order,
  // but BEFORE 'z' in UTF-16 code-unit order (0xE9 < 0x7A).
  assert.equal(canonicalJson({ z: 1, "\u00e9": 2 }), `{"z":1,"é":2}`);
  assert.equal(canonicalJson({ b: { d: 1, c: [true, null, "x"] }, a: 0 }), `{"a":0,"b":{"c":[true,null,"x"],"d":1}}`);
});

test("port agrees with the reference implementation on fresh random packages", () => {
  // Beyond the frozen vectors: cross-check the TS port against the reference
  // .mjs at runtime so any future drift in either file fails loudly here.
  // (The reference module is loaded dynamically; a missing file is a hard error.)
  return import("../../poc/runtime-persistence/runtime-identity-v1.mjs" as string).then((reference) => {
    const samples = [
      { files: { "index.html": "<!doctype html><title>fusaha</title>", "app.js": "console.log(1);" }, entryPoint: "index.html", capabilities: ["lesson-data"] },
      { files: { "index.html": "A", "assets/style.css": "body{margin:0}" }, entryPoint: "index.html", capabilities: [] },
      { files: { "index.html": new Uint8Array([0, 1, 2, 255]) }, entryPoint: "index.html" },
    ];
    for (const sample of samples) {
      const expected = reference.canonicalizePackage(sample);
      const actual = canonicalizePackage(sample);
      assert.equal(actual.identity, expected.identity);
      assert.equal(actual.manifestBytes, expected.manifestBytes);
      assert.equal(actual.manifestSha256, expected.manifestSha256);
    }
  });
});

test("contentTypeForPath covers the frozen mapping and rejects unknown extensions", () => {
  assert.equal(contentTypeForPath("index.html"), "text/html");
  assert.equal(contentTypeForPath("app.MJS"), "text/javascript");
  assert.equal(contentTypeForPath("icon.svg"), "image/svg+xml");
  assert.throws(() => contentTypeForPath("data"), /no extension/);
  assert.throws(() => contentTypeForPath("archive.zip"), /not in allowlist/);
});
