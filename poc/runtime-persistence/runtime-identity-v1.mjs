// Frozen Runtime Identity — contract "runtime-package/v1".
//
// Implements PERSISTENT_RUNTIME_STORAGE_ADR.md §8 (frozen amendment): canonical
// package canonicalization, byte-safe framed hashing, and content-type
// allowlisting. This module is the normative reference implementation for the
// frozen identity vectors in identity-vectors.json; the expected SHA-256
// values in that file were produced by running this code, not invented.
//
// Byte mode: files are byte arrays (Buffer/Uint8Array). Text callers convert
// to UTF-8 at the boundary. This is the ADR §8.1 "contract v2 byte mode"
// decision, proven by vector V6.

import { createHash } from "node:crypto";

export const IDENTITY_ALGORITHM = "runtime-package/v1";
export const IDENTITY_PREFIX = "sha256-v1-";

// Frozen allowlist (ADR §8.2 step 8). Bare MIME tokens only; parameters such
// as "; charset=utf-8" are a delivery-layer concern and never enter identity.
export const CONTENT_TYPE_ALLOWLIST = Object.freeze([
  "application/json",
  "application/octet-stream",
  "application/wasm",
  "font/woff2",
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "text/css",
  "text/html",
  "text/javascript",
  "text/plain",
]);

// Frozen extension -> content type mapping. Unknown extensions are rejected.
export const EXTENSION_CONTENT_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".bin": "application/octet-stream",
  ".css": "text/css",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
});

export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const utf8 = (text) => Buffer.from(text, "utf8");

// Unsigned lexicographic byte order over UTF-8 encodings (ADR §8.2 step 5).
// Buffer.compare compares unsigned bytes lexicographically — never locale sort.
const compareUtf8 = (left, right) => utf8(left).compare(utf8(right));

export function normalizeRuntimePath(raw) {
  const invalid = (reason) => {
    throw Object.assign(new Error(`invalid runtime path (${reason}): ${JSON.stringify(raw)}`), { code: "INVALID_PATH" });
  };
  if (typeof raw !== "string") invalid("not a string");
  if (raw.length === 0) invalid("empty");
  if (raw.includes("\\")) invalid("backslash separator");
  if (raw.startsWith("/")) invalid("leading slash");
  if (/[\x00-\x1f\x7f]/.test(raw)) invalid("control character");
  // Ambiguous percent-encoded separators must never reach object keys.
  if (/%(2f|5c)/i.test(raw)) invalid("percent-encoded separator");
  const segments = raw.split("/");
  if (segments.some((segment) => segment === "")) invalid("empty path segment");
  if (segments.includes(".")) invalid("dot segment");
  if (segments.includes("..")) invalid("dot-dot segment");
  // Unicode NFC, then everything above already enforced relative POSIX form.
  return raw.normalize("NFC");
}

// Canonical JSON: keys sorted by UTF-8 byte order at every level, no
// insignificant whitespace, and only JSON-representable finite values
// (rejects undefined, NaN, Infinity, functions, symbols — ADR §8.2 step 7).
export function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`non-finite number in manifest: ${value}`);
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort(compareUtf8);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error(`unsupported manifest value of type ${typeof value}`);
}

export function contentTypeForPath(path) {
  const dot = path.lastIndexOf(".");
  if (dot < 0) {
    throw Object.assign(new Error(`no extension for content type allowlist: ${path}`), { code: "INVALID_CONTENT_TYPE" });
  }
  const contentType = EXTENSION_CONTENT_TYPES[path.slice(dot).toLowerCase()];
  if (!contentType || !CONTENT_TYPE_ALLOWLIST.includes(contentType)) {
    throw Object.assign(new Error(`content type not in allowlist: ${path}`), { code: "INVALID_CONTENT_TYPE" });
  }
  return contentType;
}

const uint64BE = (number) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(number));
  return bytes;
};

// Canonical package: { files: Map<string, string|Uint8Array>, entryPoint, capabilities }.
// Returns the frozen manifest plus identity inputs; identity covers the
// canonical manifest AND every file's exact bytes (ADR §8.2 steps 9–11).
export function canonicalizePackage({ files, entryPoint = "index.html", capabilities = [] }) {
  const entries = files instanceof Map ? [...files.entries()] : Object.entries(files ?? {});
  if (entries.length === 0) throw new Error("package has no files");

  const normalized = new Map();
  for (const [rawPath, content] of entries) {
    const path = normalizeRuntimePath(rawPath);
    if (normalized.has(path)) throw new Error(`duplicate normalized path: ${path}`);
    const bytes = Buffer.isBuffer(content)
      ? content
      : content instanceof Uint8Array
        ? Buffer.from(content)
        : typeof content === "string"
          ? utf8(content)
          : null;
    if (!bytes) throw new Error(`unsupported file content for ${path}: ${typeof content}`);
    normalized.set(path, bytes);
  }

  const entryPath = normalizeRuntimePath(entryPoint);
  if (!normalized.has(entryPath)) throw new Error(`entryPoint is not a package file: ${entryPoint}`);

  if (!Array.isArray(capabilities) || capabilities.some((capability) => typeof capability !== "string")) {
    throw new Error("capabilities must be an array of strings");
  }
  const sortedCapabilities = [...capabilities].sort(compareUtf8);
  if (new Set(sortedCapabilities).size !== sortedCapabilities.length) throw new Error("duplicate capability");

  const assets = [...normalized.keys()].sort(compareUtf8).map((path) => {
    const bytes = normalized.get(path);
    return {
      path,
      contentSha256: sha256Hex(bytes),
      sizeBytes: bytes.length,
      contentType: contentTypeForPath(path),
    };
  });

  const manifest = {
    assets,
    capabilities: sortedCapabilities,
    entryPoint: entryPath,
    version: IDENTITY_ALGORITHM,
  };
  const manifestBytes = utf8(canonicalJson(manifest));
  const framed = [utf8(`${IDENTITY_ALGORITHM}\0`), uint64BE(manifestBytes.length), manifestBytes];
  for (const asset of assets) {
    const pathBytes = utf8(asset.path);
    framed.push(uint64BE(pathBytes.length), pathBytes, uint64BE(asset.sizeBytes), normalized.get(asset.path));
  }
  const identity = `${IDENTITY_PREFIX}${sha256Hex(Buffer.concat(framed))}`;

  return {
    identity,
    identityAlgorithm: IDENTITY_ALGORITHM,
    manifest,
    manifestBytes: manifestBytes.toString("utf8"),
    manifestSha256: sha256Hex(manifestBytes),
    files: normalized,
  };
}
