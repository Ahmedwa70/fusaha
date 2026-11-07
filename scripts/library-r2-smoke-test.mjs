#!/usr/bin/env node
// Smoke test for the library's private Cloudflare R2 connection.
//
//   node --experimental-transform-types scripts/library-r2-smoke-test.mjs
//
// Reads credentials ONLY from .env.library-r2.local (gitignored), uploads a
// tiny generated PDF under a unique diagnostics key, downloads it back,
// verifies the bytes and SHA-256 match, then deletes exactly that one test
// object. Nothing else in the bucket is touched, and no secret value is
// ever printed.
//
// When the credentials file (or any key in it) is missing — e.g. on CI —
// the test prints SKIPPED and exits 0 so it never fails automated runs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The app code omits .ts on relative imports (fine for the Next bundler);
// this resolver lets raw Node load it for this standalone script.
register(new URL("./ts-extension-resolver.mjs", import.meta.url).href);
const envPath = path.join(projectRoot, ".env.library-r2.local");

function skip(reason) {
  console.log(`SKIPPED: ${reason}`);
  console.log("To run this test, create .env.library-r2.local with: LIBRARY_R2_ACCOUNT_ID, LIBRARY_R2_ACCESS_KEY_ID, LIBRARY_R2_SECRET_ACCESS_KEY, LIBRARY_R2_BUCKET_NAME");
  process.exit(0);
}

function loadLocalEnv() {
  let parsed = {};
  try {
    parsed = Object.fromEntries(
      readFileSync(envPath, "utf-8")
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
        })
    );
  } catch {
    skip(`no local credentials file at ${envPath}`);
  }
  for (const key of ["LIBRARY_R2_ACCOUNT_ID", "LIBRARY_R2_ACCESS_KEY_ID", "LIBRARY_R2_SECRET_ACCESS_KEY", "LIBRARY_R2_BUCKET_NAME"]) {
    if (!parsed[key]) {
      skip(`missing ${key} in ${envPath}`);
    }
    process.env[key] = parsed[key];
  }
}

loadLocalEnv();

const { getLibraryR2Config, libraryR2Host, putLibraryObject, getLibraryObject } = await import("../lib/library/storage/r2-client.ts");
const { signRequest } = await import("../lib/library/storage/sigv4.ts");
const { buildStorageKey, sha256Hex } = await import("../lib/library/storage/content-addressing.ts");

const config = getLibraryR2Config();
const run = Date.now();
const marker = `R2-SMOKE-${run}`;
const pdf = Buffer.from(
  `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
    `4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (${marker}) Tj ET\nendstream\nendobj\n` +
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`
);
const sha = sha256Hex(pdf);
const key = buildStorageKey(sha);

async function deleteObject(keyToDelete) {
  const host = libraryR2Host(config);
  const path = `/${config.bucket}/${keyToDelete.split("/").map(encodeURIComponent).join("/")}`;
  const signed = signRequest({ method: "DELETE", host, path, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey });
  return fetch(`https://${host}${path}`, { method: "DELETE", headers: signed.headers });
}

let cleaned = false;
try {
  await putLibraryObject(key, pdf, "application/pdf");
  console.log(`PUT    ${key} (${pdf.byteLength} bytes) — OK`);

  const object = await getLibraryObject(key);
  const chunks = [];
  for await (const chunk of object.body) chunks.push(Buffer.from(chunk));
  const roundtrip = Buffer.concat(chunks);

  const match = roundtrip.equals(pdf);
  console.log(`GET    ${key} — ${roundtrip.byteLength} bytes, content-type=${object.contentType}`);
  console.log(`SHA-256 local=${sha}`);
  console.log(`SHA-256 r2   =${sha256Hex(roundtrip)}`);
  if (!match) {
    console.error("FAIL: round-trip bytes do not match");
    process.exitCode = 1;
  } else {
    console.log("VERIFY bytes match — OK");
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  const response = await deleteObject(key);
  cleaned = response.ok || response.status === 204 || response.status === 404;
  console.log(`CLEANUP DELETE ${key} — HTTP ${response.status} ${cleaned ? "OK" : "CHECK MANUALLY"}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log("SMOKE TEST PASSED");
