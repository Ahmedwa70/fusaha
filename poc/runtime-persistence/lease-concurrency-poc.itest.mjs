// Lease-expiry, fencing, and cross-process concurrency tests for the real
// PostgreSQL + SeaweedFS adapter. Everything runs against the disposable POC
// environment only; credentials come exclusively from
// integration-environment/.env.integration.
//
// What these tests prove on top of integration-adapter-poc.itest.mjs:
//  1. A worker whose lease expired is refused at finalize (fencing guard).
//  2. A worker holding a superseded fencing token is refused after a new
//     worker re-leases the same attempt.
//  3. Two real OS processes publishing under one idempotency key converge on
//     exactly one published runtime with no conflicting final objects.
//  4. A worker that dies after staging is recovered by a second worker, with
//     PostgreSQL and storage fully consistent.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { canonicalizePackage } from "./runtime-identity-v1.mjs";
import { createS3Client } from "./s3-client.mjs";
import { createPgS3RuntimeStore } from "./integration-adapter-poc.mjs";

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

const RUN = `lease-a-${Date.now()}`;
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

// Packages are built through the frozen V1 canonicalizer, identical to the
// reference vectors, so all lease/fencing tests exercise V1 identities.
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

const packageSize = (packageData) => [...packageData.files.values()].reduce((total, bytes) => total + bytes.length, 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs publisher-process.mjs as a real child OS process and parses its JSON line.
function runPublisherProcess(idempotencyKey, runtimeVersion, delayMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(pocDir, "publisher-process.mjs"), idempotencyKey, runtimeVersion, String(delayMs)], {
      cwd: pocDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const line = stdout.trim().split("\n").find((entry) => entry.startsWith("{"));
      if (!line) return reject(new Error(`publisher exited ${code} without JSON output: ${stderr}`));
      resolve({ code, result: JSON.parse(line) });
    });
  });
}

test.after(async () => {
  await sql.end();
});

test("1. expired lease is refused at finalize; recovery publishes afterwards", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t1`);
  const key = `${RUN}-key-t1`;
  const phases = store.phases;

  // 1-second lease: valid at acquisition...
  const attempt = await phases.beginAttempt(packageData, key, 3, packageSize(packageData), 1);
  assert.equal(attempt.alreadyPublished, false);
  assert.equal(Number(attempt.token), 1);

  // ...but the worker stalls past expiry, then tries to finalize.
  await phases.uploadStaged(packageData, attempt.attemptId, attempt.token, 50);
  await sleep(1200);
  await assert.rejects(
    phases.finalizePublication(attempt.versionRowId, attempt.attemptId, attempt.token, packageData, new Map()),
    (error) => error.code === "FENCED",
  );

  // The refused finalize must have rolled back: nothing published, attempt untouched.
  const [version] = await sql`SELECT state FROM runtime_poc.runtime_versions WHERE id = ${attempt.versionRowId}`;
  assert.equal(version.state, "pending");
  const [attemptRow] = await sql`
    SELECT state, fencing_token, lease_expires_at FROM runtime_poc.runtime_publication_attempts
    WHERE id = ${attempt.attemptId}`;
  assert.equal(attemptRow.state, "created");
  assert.equal(Number(attemptRow.fencing_token), 1);
  assert.ok(new Date(attemptRow.lease_expires_at).getTime() < Date.now(), "lease must actually be expired");

  // A fresh worker with a valid lease recovers and publishes exactly once.
  const runtime = await store.recover(attempt.attemptId, packageData);
  assert.equal(runtime.state, "published");
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});

test("2. stale fencing token cannot finalize after another worker re-leases", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t2`);
  const key = `${RUN}-key-t2`;
  const phases = store.phases;

  // Worker 1 acquires a 1-second lease and stalls.
  const stale = await phases.beginAttempt(packageData, key, 3, packageSize(packageData), 1);
  assert.equal(Number(stale.token), 1);
  await sleep(1200);

  // Worker 2 re-leases the same attempt (token 2) and completes publication.
  const runtime = await store.recover(stale.attemptId, packageData);
  assert.equal(runtime.state, "published");

  // Worker 1 finally arrives, still holding token 1: it must be fenced.
  await assert.rejects(
    phases.finalizePublication(stale.versionRowId, stale.attemptId, stale.token, packageData, new Map()),
    (error) => error.code === "FENCED",
  );

  // Exactly one published runtime; the attempt ended published at token 2.
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const [attemptRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${stale.attemptId}`;
  assert.equal(attemptRow.state, "published");
  assert.equal(Number(attemptRow.fencing_token), 2);
});

test("3. two real OS processes with one idempotency key converge on one runtime", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t3`);
  const key = `${RUN}-key-t3`;

  // delayMs widens the race so both processes overlap in the staging phase.
  const [first, second] = await Promise.all([
    runPublisherProcess(key, `${RUN}-t3`, 150),
    runPublisherProcess(key, `${RUN}-t3`, 150),
  ]);
  assert.equal(first.code, 0, JSON.stringify(first.result));
  assert.equal(second.code, 0, JSON.stringify(second.result));
  assert.equal(first.result.ok, true);
  assert.equal(second.result.ok, true);
  assert.equal(first.result.state, "published");
  assert.equal(second.result.state, "published");
  assert.equal(first.result.runtimeId, second.result.runtimeId, "both processes must resolve the same runtime");

  // Exactly one runtime version, one logical attempt (same key), current token fenced out the loser.
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const attempts = await sql`
    SELECT id, state, fencing_token FROM runtime_poc.runtime_publication_attempts
    WHERE idempotency_key = ${key}`;
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].state, "published");

  // No conflicting final objects: exactly the 3 content-addressed keys, all distinct.
  const objects = await sql`
    SELECT object_key FROM runtime_poc.runtime_storage_objects
    WHERE bucket = ${env.POC_S3_BUCKET} AND object_key LIKE ${`runtime/${packageData.identity}/%`}`;
  const distinctKeys = new Set(objects.map((row) => row.object_key));
  assert.equal(objects.length, 3);
  assert.equal(distinctKeys.size, 3);

  // Byte-level verification of every published asset.
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});

test("4. two real OS processes with different keys converge without duplicate publish", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t4`);

  const [first, second] = await Promise.all([
    runPublisherProcess(`${RUN}-key-t4a`, `${RUN}-t4`, 150),
    runPublisherProcess(`${RUN}-key-t4b`, `${RUN}-t4`, 150),
  ]);
  assert.equal(first.code, 0, JSON.stringify(first.result));
  assert.equal(second.code, 0, JSON.stringify(second.result));
  assert.equal(first.result.runtimeId, second.result.runtimeId);

  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const attempts = await sql`
    SELECT count(*)::int AS n, count(DISTINCT id)::int AS distinct_ids
    FROM runtime_poc.runtime_publication_attempts
    WHERE runtime_version_id = ${first.result.runtimeId}`;
  assert.equal(attempts[0].n, 2);
  assert.equal(attempts[0].distinct_ids, 2);
  const publishedAttempts = await sql`
    SELECT count(*)::int AS n FROM runtime_poc.runtime_publication_attempts
    WHERE runtime_version_id = ${first.result.runtimeId} AND state = 'published'`;
  assert.equal(publishedAttempts[0].n, 1, "only one attempt may be recorded as published");

  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});

test("5. worker crash after staging is recovered by a second worker with consistency", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t5`);
  const key = `${RUN}-key-t5`;
  const phases = store.phases;

  // Worker 1: acquires a short lease, stages, verifies — then dies
  // (SIGKILL-style: no finalize, no markFailed, row left mid-flight with a
  // still-valid lease).
  const attempt = await phases.beginAttempt(packageData, key, 3, packageSize(packageData), 2);
  const stagingKeys = await phases.uploadStaged(packageData, attempt.attemptId, attempt.token, 1);
  await phases.verifyStaged(packageData, stagingKeys);
  const staged = await s3.getObject(env.POC_S3_BUCKET, stagingKeys.get("index.html"));
  assert.deepEqual(staged.body, packageData.files.get("index.html"));

  // Worker 2 cannot seize the attempt while worker 1's lease is valid.
  const worker2 = createPgS3RuntimeStore({ sql, s3, bucket: env.POC_S3_BUCKET });
  await assert.rejects(worker2.recover(attempt.attemptId, packageData), (error) => error.code === "LEASE_HELD");
  const [heldRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${attempt.attemptId}`;
  assert.equal(heldRow.state, "created");
  assert.equal(Number(heldRow.fencing_token), 1, "fencing token must not change when recovery is refused");

  // After the lease lapses, worker 2 re-leases with a higher token, publishes.
  await sleep(2200);
  const runtime = await worker2.recover(attempt.attemptId, packageData);
  assert.equal(runtime.state, "published");

  // Recovery metadata: same attempt, fenced-up token, exactly one completion.
  const [attemptRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${attempt.attemptId}`;
  assert.equal(attemptRow.state, "published");
  assert.equal(Number(attemptRow.fencing_token), 2);
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);

  // PostgreSQL records and final storage objects agree, byte for byte.
  const verification = await worker2.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
  assert.equal(verification.assets.length, 3);
  const objectRows = await sql`
    SELECT count(*)::int AS n FROM runtime_poc.runtime_storage_objects
    WHERE bucket = ${env.POC_S3_BUCKET} AND object_key LIKE ${`runtime/${packageData.identity}/%`}`;
  assert.equal(objectRows[0].n, 3);
});


test("6. recovery is refused while the lease is valid, then succeeds after expiry", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t6`);
  const key = `${RUN}-key-t6`;
  const phases = store.phases;

  // Worker 1 acquires a 2-second lease and stalls while still alive.
  const stale = await phases.beginAttempt(packageData, key, 3, packageSize(packageData), 2);
  assert.equal(Number(stale.token), 1);

  // Worker 2 tries to seize before expiry: refused, token untouched, row unchanged.
  await assert.rejects(store.recover(stale.attemptId, packageData), (error) => error.code === "LEASE_HELD");
  let [row] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${stale.attemptId}`;
  assert.equal(row.state, "created");
  assert.equal(Number(row.fencing_token), 1, "refused recovery must not change the fencing token");

  // After the lease lapses, recovery succeeds, the token rises, and worker 2
  // completes publication in the same call.
  await sleep(2200);
  const runtime = await store.recover(stale.attemptId, packageData);
  assert.equal(runtime.state, "published");
  [row] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${stale.attemptId}`;
  assert.equal(row.state, "published");
  assert.equal(Number(row.fencing_token), 2);

  // Worker 1's late finalize with the superseded token is fenced.
  await assert.rejects(
    phases.finalizePublication(stale.versionRowId, stale.attemptId, stale.token, packageData, new Map()),
    (error) => error.code === "FENCED",
  );

  // Exactly one published runtime, byte-verified.
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});


test("7. failed-state recovery race: old worker cannot finalize or corrupt after immediate recovery", { concurrency: false }, async () => {
  const packageData = fixture(`${RUN}-t7`);
  const key = `${RUN}-key-t7`;
  const phases = store.phases;

  // Worker 1 acquires a long lease, then fails during upload. Its lease is
  // still valid, but the attempt is now 'failed' — the recovery-eligibility
  // exception allows an immediate second worker.
  const crashed = await phases.beginAttempt(packageData, key, 3, packageSize(packageData), 30);
  await phases.uploadStaged(packageData, crashed.attemptId, crashed.token, 1);
  await assert.rejects(
    (async () => {
      throw await phases.markFailed(crashed.attemptId, crashed.token, "simulated crash after staging upload");
    })(),
    /simulated crash/,
  );
  const [failedRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${crashed.attemptId}`;
  assert.equal(failedRow.state, "failed");

  // Worker 2 recovers immediately (failed-state exception) and publishes.
  const runtime = await store.recover(crashed.attemptId, packageData);
  assert.equal(runtime.state, "published");
  const [publishedRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${crashed.attemptId}`;
  assert.equal(publishedRow.state, "published");
  assert.equal(Number(publishedRow.fencing_token), 2);

  // Worker 1 wakes up late: its finalize with the old token is fenced.
  await assert.rejects(
    phases.finalizePublication(crashed.versionRowId, crashed.attemptId, crashed.token, packageData, new Map()),
    (error) => error.code === "FENCED",
  );

  // And its late failure report must NOT downgrade the published attempt
  // (conditional markFailed: token/state guard).
  await phases.markFailed(crashed.attemptId, crashed.token, "late failure report from stale worker");
  const [finalRow] = await sql`
    SELECT state, fencing_token FROM runtime_poc.runtime_publication_attempts WHERE id = ${crashed.attemptId}`;
  assert.equal(finalRow.state, "published");
  assert.equal(Number(finalRow.fencing_token), 2);

  // Exactly one published runtime, byte-verified.
  const versions = await sql`SELECT count(*)::int AS n FROM runtime_poc.runtime_versions WHERE identity = ${packageData.identity}`;
  assert.equal(versions[0].n, 1);
  const verification = await store.verifyPublishedAssets(packageData.identity);
  assert.equal(verification.allOk, true);
});
