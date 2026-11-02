// Regenerates identity-vectors.json from the frozen reference implementation
// (runtime-identity-v1.mjs). Every expected SHA-256 / identity below is
// COMPUTED, never hand-written. Run: node generate-identity-vectors.mjs
// The generated file is committed with the POC as the frozen vector spec.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizePackage } from "./runtime-identity-v1.mjs";

const pocDir = dirname(fileURLToPath(import.meta.url));

function encodeFiles(files) {
  return Object.fromEntries(
    [...files.entries()].map(([path, bytes]) => [path, { base64: Buffer.from(bytes).toString("base64") }]),
  );
}

function vector(name, description, { files, entryPoint, capabilities }) {
  const input = {
    files: encodeFiles(files),
    entryPoint: entryPoint ?? "index.html",
    capabilities: capabilities ?? [],
  };
  const packageData = canonicalizePackage({ files, entryPoint: input.entryPoint, capabilities: input.capabilities });
  return { name, description, input, canonicalManifest: packageData.manifestBytes, manifestSha256: packageData.manifestSha256, identity: packageData.identity };
}

const v1Files = new Map([["index.html", Buffer.from("hello", "utf8")]]);

const vectors = [
  vector("V1", "single UTF-8 file: manifest {entryPoint:index.html, assets:[index.html sha256(hello) size 5 text/html]} and bytes hello", { files: v1Files }),
  vector("V2", "V1 supplied with reversed file insertion order: digest must equal V1", {
    files: new Map([...v1Files].reverse()),
  }),
  vector("V3a", "one file a.txt = ab", { files: new Map([["a.txt", Buffer.from("ab")], ["index.html", Buffer.from("entry")]]) }),
  vector("V3b", "two files a.txt = a and b.txt = b: framed boundaries differ from V3a even though concatenated bytes match", { files: new Map([["a.txt", Buffer.from("a")], ["b.txt", Buffer.from("b")]]), entryPoint: "a.txt" }),
  vector("V4a", "NFC path e-acute: é.txt with identical bytes", { files: new Map([["index.html", Buffer.from("entry")], ["\u00e9.txt", Buffer.from("identical bytes")]]) }),
  vector("V4b", "NFD path e + combining acute: é.txt with identical bytes: digest equals V4a", { files: new Map([["index.html", Buffer.from("entry")], ["e\u0301.txt", Buffer.from("identical bytes")]]) }),
  vector("V5", "Arabic content containing <, &, quotes, and a literal </script>: bytes are hashed exactly, independent of HTML escaping", {
    files: new Map([["index.html", Buffer.from('نص عربي فيه < و & و "اقتباس" و </script> حرفيًا', "utf8")]]),
  }),
  vector("V5b", "V5 with HTML-escaped entities (&lt; &quot;): digest differs from V5", {
    files: new Map([["index.html", Buffer.from("نص عربي فيه &lt; و &amp; و &quot;اقتباس&quot; و &lt;/script&gt; حرفيًا", "utf8")]]),
  }),
  vector("V6", "binary bytes 00 ff 10 80 in blob.bin: byte mode, digest stable and differs from any UTF-8 decoding", {
    files: new Map([["index.html", Buffer.from("entry")], ["blob.bin", Buffer.from([0x00, 0xff, 0x10, 0x80])]]),
  }),
  vector("V6b", "V6 bytes re-encoded through UTF-8 replacement decoding: digest differs from V6 (byte mode proven)", {
    files: new Map([["index.html", Buffer.from("entry")], ["blob.bin", Buffer.from(Buffer.from([0x00, 0xff, 0x10, 0x80]).toString("utf8"), "utf8")]]),
  }),
  vector("V7a", "V1 bytes plus capability media-playback: digest differs from V1", { files: v1Files, capabilities: ["media-playback"] }),
  vector("V7b", "V1 bytes plus capability network-fetch: digest differs from V7a", { files: v1Files, capabilities: ["network-fetch"] }),
  vector("V7c", "V1 bytes with entryPoint index.html unchanged but file renamed to main.html: digest differs from V1", { files: new Map([["main.html", Buffer.from("hello")]]), entryPoint: "main.html" }),
];

const relations = [
  { kind: "equal", a: "V1", b: "V2", reason: "order independence of files and capabilities" },
  { kind: "equal", a: "V4a", b: "V4b", reason: "Unicode NFC/NFD path normalization" },
  { kind: "different", a: "V1", b: "V3a", reason: "different packages" },
  { kind: "different", a: "V3a", b: "V3b", reason: "framed path/content boundaries distinguish concatenations" },
  { kind: "different", a: "V5", b: "V5b", reason: "byte-exact hashing: HTML escaping changes bytes" },
  { kind: "different", a: "V6", b: "V6b", reason: "byte mode: UTF-8 replacement decoding is not identity-preserving" },
  { kind: "different", a: "V1", b: "V7a", reason: "manifest capability change" },
  { kind: "different", a: "V7a", b: "V7b", reason: "different capability values" },
  { kind: "different", a: "V1", b: "V7c", reason: "path set change changes the manifest" },
];

const frozen = {
  frozen: "2026-11-01",
  algorithm: "runtime-package/v1",
  identityFormat: "sha256-v1-<64 lowercase hex>",
  producedBy: "generate-identity-vectors.mjs over runtime-identity-v1.mjs (computed values, never invented)",
  vectors,
  relations,
};

writeFileSync(join(pocDir, "identity-vectors.json"), `${JSON.stringify(frozen, null, 2)}\n`);
console.log(`wrote ${vectors.length} vectors, ${relations.length} relations`);
for (const entry of vectors) console.log(`${entry.name}  ${entry.identity}`);
