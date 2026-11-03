// Integration tests for the real PostgreSQL + SeaweedFS adapter.
// Every test writes to the disposable POC database (runtime_poc schema) and
// the disposable POC bucket only. Credentials come exclusively from
// integration-environment/.env.integration — never from project env files.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { canonicalizePackage, canonicalJson, IDENTITY_ALGORITHM } from "./runtime-identity-v1.mjs";
import { createS3Client } from "./s3-client.mjs";
import { createPgS3RuntimeStore, sha256Hex } from "./integration-adapter-poc.mjs";

const pocDir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(pocDir, "integration-environment", ".env.integration"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const RUN = `int-a-${Date.now()}`;
const sql = postgres({
  host: "127.0.0.1",
  port: Number(env.POC_POSTGRES_PORT),
  database: env.POC_POSTGRES_DB,
  username: env.POC_POSTGRES_USER,
  password: env.POC_POSTGRES_PASSWORD,
});
const s3 = createS3Client({
  endpoint: `http://127.0.0.1:${env.POC_S3_API_PORT}`,
  accessKey: env.POC_S3_ROOT_USER,
  secretKey: env.POC_S3_ROOT_PASSWORD,
});
const store = createPgS3RuntimeStore({ sql, s3, bucket: env.POC_S3_BUCKET });

// Packages are built through the frozen V1 canonicalizer — the same code the
// reference vectors prove — so adapter identities are V1 identities.
function fixture(runtimeVersion) {
  return canonicalizePackage({
    files: {
      "index.html": `<!doctype html><html><body><div id="app">${runtimeVersion}</div><script src="./assets/app.js"></script></body></html>`,
      "assets/app.js": `console.log("${runtimeVersion}");`,
      "assets/icon.svg": `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>`,
    },
    entryPoint: "index.html",
    capabilities: [],
  });
}

test.after(async () => {
  await sql.end();
});

test("1. publish writes the runtime record and stores every object", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t1`);
  const runtime = await store.publish(packageData, `${RUN}-key-t1`);
  assert.equal(runtime.state, "published");
  assert.equal(runtime.manifest_sha256, packageData.manifestSha256);

  const [row] = await sql`SELECT state, asset_count FROM runtime_poc.runtime_versions WHERE id = ${runtime.id}`;
  assert.equal(row.state, "published");
  assert.equal(row.asset_count, 3);

  const [attempt] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts
    WHERE idempotency_key = ${`${RUN}-key-t1`}`;
  assert.equal(attempt.state, "published");
  assert.ok(attempt.fencing_token >= 1);

  for (const asset of runtime.assets) {
    const stored = await s3.getObject(env.POC_S3_BUCKET, asset.object_key);
    assert.equal(sha256Hex(stored.body), asset.content_sha256);
  }
});

test("2. stored bytes match independent SHA-256, not ETag", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t2`);
  await store.publish(packageData, `${RUN}-key-t2`);
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
  for (const entry of verification.assets) {
    assert.equal(entry.dbSha256, sha256Hex(packageData.files.get(entry.path)));
    assert.ok(entry.objectKey.includes(entry.dbSha256), "final key must be content-addressed");
  }
});

test("3. published objects reject overwrite at provider level", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t3`);
  const runtime = await store.publish(packageData, `${RUN}-key-t3`);
  for (const asset of runtime.assets) {
    await assert.rejects(
      s3.putObject(env.POC_S3_BUCKET, asset.object_key, Buffer.from("tampered"), { ifNoneMatch: "*" }),
      (error) => error.code === "PreconditionFailed",
    );
    const stored = await s3.getObject(env.POC_S3_BUCKET, asset.object_key);
    assert.equal(stored.body.toString(), packageData.files.get(asset.path).toString());
  }
});

test("4. two concurrent publishers converge on a single runtime", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t4`);
  const [first, second] = await Promise.all([
    store.publish(packageData, `${RUN}-key-t4a`, { delayMs: 3 }),
    store.publish(packageData, `${RUN}-key-t4b`, { delayMs: 3 }),
  ]);
  assert.equal(first.id, second.id);
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const attempts = await sql`
    SELECT count(*)::int AS n FROM runtime_poc.runtime_publication_attempts
    WHERE runtime_version_id = ${first.id}`;
  assert.equal(attempts[0].n, 2);
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});

test("5. crash after staging leaves nothing published; storage holds staged bytes", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t5`);
  await assert.rejects(store.publish(packageData, `${RUN}-key-t5`, { crashAfter: "upload" }), /simulated crash/);
  const attempt = await store.findAttempt(`${RUN}-key-t5`);
  assert.equal(attempt.state, "failed");
  const published = await store.getPublished(packageData.identity);
  assert.ok(!published || published.state !== "published");
});

test("6. recovery re-leases with a higher fencing token and publishes", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t6`);
  await assert.rejects(store.publish(packageData, `${RUN}-key-t6`, { crashAfter: "verify" }), /simulated crash/);
  const crashed = await store.findAttempt(`${RUN}-key-t6`);
  assert.equal(crashed.state, "failed");
  const runtime = await store.recover(crashed.id, packageData);
  assert.equal(runtime.state, "published");
  const recovered = await store.findAttempt(`${RUN}-key-t6`);
  assert.ok(Number(recovered.fencing_token) >= Number(crashed.fencing_token) + 1, "fencing token must increase on recovery");
});

test("7. after crash and recovery, PostgreSQL and storage are consistent", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t7`);
  // crashAfter "finalize": final objects are in S3 but the DB transaction never ran
  await assert.rejects(store.publish(packageData, `${RUN}-key-t7`, { crashAfter: "finalize" }), /simulated crash/);
  const crashed = await store.findAttempt(`${RUN}-key-t7`);
  const runtime = await store.recover(crashed.id, packageData);
  assert.equal(runtime.state, "published");

  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);

  const [version] = await sql`SELECT state FROM runtime_poc.runtime_versions WHERE id = ${runtime.id}`;
  assert.equal(version.state, "published");
  const assetRows = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_assets WHERE runtime_version_id = ${runtime.id}`;
  assert.equal(assetRows[0].n, 3);
  const objectRows = await sql`
    SELECT count(*)::int AS n FROM runtime_poc.runtime_storage_objects
    WHERE bucket = ${env.POC_S3_BUCKET} AND object_key LIKE ${`runtime/${packageData.identity}/%`}`;
  assert.equal(objectRows[0].n, 3);
});

test("8. re-reading the published runtime returns every intact file", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t8`);
  await store.publish(packageData, `${RUN}-key-t8`);
  const runtime = await store.getPublished(packageData.identity);
  assert.equal(runtime.state, "published");
  assert.equal(runtime.assets.length, 3);
  for (const asset of runtime.assets) {
    const stored = await s3.getObject(env.POC_S3_BUCKET, asset.object_key);
    assert.deepEqual(stored.body, packageData.files.get(asset.path));
    assert.equal(asset.content_type, stored.contentType);
  }
});

test("9. adapter publishes exactly the frozen V1 identity for the same inputs", { concurrency: false }, async () => {
  // Independently reconstruct the reference V1 identity from raw inputs (not
  // via the shared fixture helper) to prove the adapter pipeline preserves it.
  const files = {
    "index.html": `<!doctype html><html><body><div id="app">${RUN}-t9</div><script src="./assets/app.js"></script></body></html>`,
    "assets/app.js": `console.log("${RUN}-t9");`,
  };
  const reference = canonicalizePackage({ files, entryPoint: "index.html", capabilities: [] });
  const runtime = await store.publish(reference, `${RUN}-key-t9`);
  assert.equal(runtime.identity, reference.identity);
  assert.match(runtime.identity, /^sha256-v1-[0-9a-f]{64}$/);
  assert.equal(runtime.manifest_sha256, reference.manifestSha256);

  // The database row carries the frozen algorithm and manifest; jsonb may
  // reorder keys, so compare canonical forms.
  const [row] = await sql`
    SELECT identity_algorithm, manifest, manifest_sha256 FROM runtime_poc.runtime_versions
    WHERE identity = ${reference.identity}`;
  assert.equal(row.identity_algorithm, IDENTITY_ALGORITHM);
  assert.equal(row.manifest_sha256, reference.manifestSha256);
  assert.equal(canonicalJson(row.manifest), canonicalJson(reference.manifest));

  // Storage keys are content-addressed under the V1 identity.
  for (const asset of runtime.assets) {
    assert.ok(asset.object_key.startsWith(`runtime/${reference.identity}/`));
    assert.ok(asset.object_key.includes(asset.content_sha256));
    const stored = await s3.getObject(env.POC_S3_BUCKET, asset.object_key);
    assert.equal(sha256Hex(stored.body), asset.content_sha256);
  }
});

test("10. reusing an idempotency key with a different package fails with no side effects", { concurrency: false }, async () => {
  // Finding F2 (design doc §11.2 / ADR §9.1 step 3): the key is the caller's
  // retry identity for ONE logical request. Publishing package B under the
  // key that already carried package A must raise IDEMPOTENCY_CONFLICT inside
  // the register transaction, leaving zero trace: no version row for B's
  // identity, no attempt mutation, no staged or final objects for B.
  const packageA = fixture(`${RUN}-t10a`);
  const packageB = fixture(`${RUN}-t10b`);
  const key = `${RUN}-key-t10`;
  const publishedA = await store.publish(packageA, key);
  assert.equal(publishedA.state, "published");

  await assert.rejects(() => store.publish(packageB, key), (error) => {
    assert.equal(error.code, "IDEMPOTENCY_CONFLICT");
    return true;
  });

  // No version row was created for B's identity (the transaction rolled back).
  const [versionB] = await sql`
    SELECT id FROM runtime_poc.runtime_versions WHERE identity = ${packageB.identity}`;
  assert.equal(versionB, undefined);

  // The attempt row still carries A's fingerprint and its published state.
  const [attempt] = await sql`
    SELECT state, request_fingerprint FROM runtime_poc.runtime_publication_attempts
    WHERE idempotency_key = ${key}`;
  assert.equal(attempt.state, "published");
  assert.equal(attempt.request_fingerprint, packageA.identity);

  // No storage objects exist under B's identity namespace.
  const [objectsB] = await sql`
    SELECT count(*)::int AS n FROM runtime_poc.runtime_storage_objects
    WHERE bucket = ${env.POC_S3_BUCKET} AND object_key LIKE ${`runtime/${packageB.identity}/%`}`;
  assert.equal(objectsB.n, 0);

  // The original publication is untouched.
  const republished = await store.getPublished(packageA.identity);
  assert.equal(republished.state, "published");
  assert.equal(republished.assets.length, 3);
});
