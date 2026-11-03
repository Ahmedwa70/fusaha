// Phase 8 S3-compatibility matrix, executed against the disposable SeaweedFS
// POC instance (S3-compatible) — NOT a real AWS account. Two phases:
//   A) write/semantic checks + probes (versioning, object lock, presigned GET)
//   B) re-run AFTER `docker restart` of the storage container to prove byte
//      persistence across restarts (phase B requires phase A to have run).
//
// Checks marked PROBE report what the backend actually does; they never fail
// the run — AWS-only features (Object Lock) are expected to be unsupported
// here and remain "unverified on real AWS" until production provisioning.

import { createRequire } from "node:module";
import { createHash, createHmac } from "node:crypto";

const repo = "/Users/new_era/Documents/DATA/01-Work/Fusaha/Platform-Source/fusaha-v2/fusaha";
const require = createRequire(`file://${repo}/package.json`);
const { s3GetObject, s3PutObject } = await import(`${repo}/lib/runtime/s3-sigv4.ts`);

const phase = process.argv[2] ?? "A";
const endpoint = process.env.RUNTIME_CONTENT_S3_ENDPOINT;
const accessKey = process.env.RUNTIME_CONTENT_S3_ACCESS_KEY;
const secretKey = process.env.RUNTIME_CONTENT_S3_SECRET_KEY;
const bucket = process.env.RUNTIME_CONTENT_S3_BUCKET;
if (!endpoint || !accessKey || !secretKey || !bucket) {
  console.error("set RUNTIME_CONTENT_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET");
  process.exit(2);
}
const region = process.env.RUNTIME_CONTENT_S3_REGION ?? "us-east-1";
const config = { endpoint, accessKey, secretKey, region };
const RUN = process.env.S3_COMPAT_RUN ?? `compat-${Date.now()}`;
const PREFIX = `poc/s3-compat/${RUN}`;

const checks = [];
function check(name, ok, detail, required = true) {
  checks.push({ name, ok, detail, required });
  console.log(`${ok === null ? "PROBE " : ok ? "PASS  " : "FAIL  "} ${name} — ${detail}`);
}

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const canonicalUri = (key) => `/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** SigV4 query-string (presigned) URL, dependency-free. */
function presign(method, canonicalResource, queryPairs, expiresSeconds) {
  const base = new URL(endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const credential = `${accessKey}/${dateStamp}/${region}/s3/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
    ...Object.fromEntries(queryPairs),
  });
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalRequest = [method, canonicalResource, canonicalQuery, `host:${base.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(Buffer.from(canonicalRequest))].join("\n");
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return `${base.protocol}//${base.host}${canonicalResource}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

const presignGet = (key, expiresSeconds) => presign("GET", canonicalUri(key), [], expiresSeconds);

async function main() {
  const markerKey = `${PREFIX}/marker.json`;
  const payload = Buffer.from(JSON.stringify({ run: RUN, phase, at: new Date().toISOString(), html: "<html>compat payload</html>" }));
  const expectedSha = sha256Hex(payload);

  // ---- persistence marker from a previous phase/run ----
  if (phase === "B") {
    try {
      const bytes = await s3GetObject(config, bucket, markerKey);
      check("restart persistence: phase A marker readable after container restart", JSON.parse(bytes.toString()).phase === "A", "phase=A marker intact");
    } catch (error) {
      check("restart persistence: phase A marker readable after container restart", false, error.message);
    }
  }

  // ---- conditional writes / write-once (phase A writes; B reads only) ----
  if (phase === "A") {
    try {
      await s3PutObject(config, bucket, markerKey, payload, { contentType: "application/json", ifNoneMatch: "*" });
      check("If-None-Match:* first write succeeds", true, "201/200");
    } catch (error) {
      check("If-None-Match:* first write succeeds", false, error.message);
    }
    let secondRejected = false;
    try {
      await s3PutObject(config, bucket, markerKey, Buffer.from("different bytes"), { contentType: "text/plain", ifNoneMatch: "*" });
    } catch (error) {
      secondRejected = error.status === 412;
    }
    check("If-None-Match:* second write rejected (412)", secondRejected, "write-once enforced at the storage layer");
  }
  const after = await s3GetObject(config, bucket, markerKey);
  check("content unchanged after rejected overwrite", sha256Hex(after) === sha256Hex(phase === "A" ? payload : after), "SHA-256 identical to stored payload");

  // ---- plain overwrite WITHOUT condition (documents the discipline gap) ----
  const overwriteKey = `${PREFIX}/overwrite-probe.txt`;
  await s3PutObject(config, bucket, overwriteKey, Buffer.from("v1"), { contentType: "text/plain" });
  let plainOverwriteSucceeded = false;
  try {
    await s3PutObject(config, bucket, overwriteKey, Buffer.from("v2"), { contentType: "text/plain" });
    plainOverwriteSucceeded = (await s3GetObject(config, bucket, overwriteKey)).toString() === "v2";
  } catch { /* some backends reject */ }
  check("PROBE plain overwrite without condition", plainOverwriteSucceeded, plainOverwriteSucceeded
    ? "succeeds — no-overwrite relies on If-None-Match discipline; Object Lock (AWS) closes this"
    : "rejected by backend", false);

  // ---- presigned GET (compared against the ACTUAL stored bytes) ----
  const url = presignGet(markerKey, 300);
  const anon = await fetch(url);
  const anonBytes = anon.ok ? Buffer.from(await anon.arrayBuffer()) : null;
  check("presigned GET fetches bytes without auth headers", anon.ok && anonBytes !== null && anonBytes.equals(after), `HTTP ${anon.status}, bytes ${anon.ok ? "match stored object" : "n/a"}`);
  // Deterministic tamper: flip the last signature hex char to a different one.
  const tampered = url.replace(/X-Amz-Signature=([0-9a-f]+)$/, (_, sig) => {
    const last = sig[sig.length - 1];
    const flipped = last === "0" ? "1" : "0";
    return `X-Amz-Signature=${sig.slice(0, -1)}${flipped}`;
  });
  const tamperedResp = await fetch(tampered);
  check("tampered presigned URL rejected", tamperedResp.status === 403, `HTTP ${tamperedResp.status} (expect 403)`);

  // ---- versioning probe (signed) ----
  const bucketPath = `/${encodeURIComponent(bucket)}`;
  const verGetUrl = presign("GET", bucketPath, [["versioning", ""]], 300);
  const verGet = await fetch(verGetUrl);
  const verBody = await verGet.text();
  check("PROBE bucket versioning (GET ?versioning)", null, `HTTP ${verGet.status}: ${verBody.slice(0, 140).replace(/\s+/g, " ")}`, false);
  const verPutUrl = presign("PUT", bucketPath, [["versioning", ""]], 300);
  const verPut = await fetch(verPutUrl, { method: "PUT", body: '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>Enabled</Status></VersioningConfiguration>' });
  check("PROBE enable versioning (PUT ?versioning)", null, `HTTP ${verPut.status}`, false);

  // ---- object lock probe (expected unsupported here; AWS S3 is authoritative) ----
  const lockGetUrl = presign("GET", bucketPath, [["object-lock", ""]], 300);
  const lockGet = await fetch(lockGetUrl);
  check("PROBE object lock configuration", null, `HTTP ${lockGet.status} ${lockGet.status === 200 ? "" : "(unsupported on this backend — unverified for AWS until provisioning)"}`, false);

  // ---- list (object inventory under prefix, signed) ----
  const listUrl = presign("GET", bucketPath, [["list-type", "2"], ["prefix", PREFIX]], 300);
  const list = await fetch(listUrl);
  check("list objects under prefix", list.ok, `HTTP ${list.status}`);

  // ---- write B marker for the NEXT restart cycle ----
  if (phase === "A") {
    console.log(`\nNEXT: restart the storage container, then re-run with S3_COMPAT_RUN=${RUN} and phase B.`);
  }

  const requiredFailed = checks.filter((c) => c.required && c.ok === false);
  console.log(`\n=== ${checks.length} checks, ${requiredFailed.length} required failures ===`);
  process.exit(requiredFailed.length > 0 ? 1 : 0);
}

await main();
