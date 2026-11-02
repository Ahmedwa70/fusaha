// Integration tests for the Phase 5 runtime publisher on a REAL migrated
// disposable database (same isolated-database discipline as the binding and
// cutover suites: RUNTIME_PUBLICATION_TEST_DATABASE_URL, falling back to
// RUNTIME_BINDING_TEST_DATABASE_URL — never the project DATABASE_URL). Storage
// is an injected in-memory store with exact no-overwrite semantics for the
// core suite, plus a live SeaweedFS end-to-end test gated on
// RUNTIME_CONTENT_S3_* / RUNTIME_PUBLICATION_S3_* env vars.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createRuntimePublisher, RuntimePublicationError } = await import("./runtime-publication.ts" as string);
const { canonicalizePackage } = await import("./runtime-identity-v1.ts" as string);
const { createS3RuntimeContentStore, readS3StoreConfigFromEnv, RuntimeContentStoreError } = await import("./runtime-content-store.ts" as string);
const { createS3CompatibleEntryContentReader } = await import("./runtime-entry-content.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";
const isPubError = (error: unknown, code: string): boolean =>
  error instanceof Error && (error as { code?: string }).code === code;

function hex64() {
  return (randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")).slice(0, 64);
}

function pkg(html: string) {
  return {
    files: { "index.html": html },
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
  } as const;
}

function sha256Hex(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

// In-memory store with the exact contract of RuntimeContentStore.
function createFakeStore(options: { failPut?: () => boolean } = {}) {
  const objects = new Map<string, Buffer>();
  const record = { puts: 0, gets: 0 };
  return {
    objects,
    record,
    store: {
      async putIfAbsent(key: string, bytes: Buffer) {
        record.puts += 1;
        if (options.failPut?.()) {
          throw new RuntimeContentStoreError("injected storage failure", "content-store-unavailable");
        }
        const existing = objects.get(key);
        if (existing) {
          if (!existing.equals(bytes)) {
            throw new RuntimeContentStoreError(`conflict at ${key}`, "content-store-key-conflict");
          }
          return "exists" as const;
        }
        objects.set(key, Buffer.from(bytes));
        return "created" as const;
      },
      async get(key: string) {
        record.gets += 1;
        const bytes = objects.get(key);
        if (!bytes) throw new RuntimeContentStoreError(`missing ${key}`, "content-store-not-found");
        return bytes;
      },
    },
  };
}

describe("runtime publication (DB-backed, injected store)", { skip: !databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const RUN = `pub-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  function makePublisher(store: unknown, overrides: Record<string, unknown> = {}) {
    return createRuntimePublisher({ db: db as never, store: store as never, bucket: "test-bucket", ...overrides });
  }

  async function loadVersion(identity: string) {
    const rows = await db
      .select()
      .from(schema.runtimeVersions)
      .where(and(eq(schema.runtimeVersions.identityAlgorithm, "runtime-package/v1"), eq(schema.runtimeVersions.identity, identity)))
      .limit(1);
    return rows[0] ?? null;
  }

  async function loadAttempt(idempotencyKey: string) {
    const rows = await db
      .select()
      .from(schema.runtimePublicationAttempts)
      .where(eq(schema.runtimePublicationAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  }

  async function loadAssets(versionId: string) {
    return db
      .select({
        path: schema.runtimeAssets.path,
        contentSha256: schema.runtimeAssets.contentSha256,
        sizeBytes: schema.runtimeAssets.sizeBytes,
        contentType: schema.runtimeAssets.contentType,
        objectKey: schema.runtimeStorageLocations.objectKey,
        bucket: schema.runtimeStorageLocations.bucket,
        provider: schema.runtimeStorageLocations.provider,
        isPrimary: schema.runtimeStorageLocations.isPrimary,
      })
      .from(schema.runtimeAssets)
      .innerJoin(schema.runtimeStorageObjects, eq(schema.runtimeStorageObjects.id, schema.runtimeAssets.storageObjectId))
      .innerJoin(schema.runtimeStorageLocations, eq(schema.runtimeStorageLocations.storageObjectId, schema.runtimeStorageObjects.id))
      .where(eq(schema.runtimeAssets.runtimeVersionId, versionId));
  }

  test("1. publish creates a Published version with verified assets and a primary content-addressed location", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const input = pkg(`<!doctype html><html><body>${RUN}-1</body></html>`);
    const key = `${RUN}-t1`;
    const expectedIdentity = canonicalizePackage(input).identity;
    const htmlBytes = Buffer.from(input.files["index.html"]);

    const published = await publisher.publish(input, key);
    assert.equal(published.identity, expectedIdentity);
    assert.equal(published.state, schema.RuntimeVersionState.Published);
    assert.equal(published.assets.length, 1);
    assert.equal(published.assets[0].path, "index.html");
    assert.equal(published.assets[0].contentSha256, sha256Hex(htmlBytes));
    assert.equal(published.assets[0].objectKey, `runtime/${expectedIdentity}/${sha256Hex(htmlBytes)}`);
    assert.equal(published.assets[0].bucket, "test-bucket");

    const version = await loadVersion(expectedIdentity);
    assert.ok(version, "version row exists");
    assert.equal(version.state, schema.RuntimeVersionState.Published);
    assert.equal(version.entryPoint, "index.html");
    assert.equal(version.assetCount, 1);
    assert.equal(Number(version.packageSizeBytes), htmlBytes.length);
    assert.ok(version.publishedAt, "published_at set");

    const attempt = await loadAttempt(key);
    assert.ok(attempt, "attempt row exists");
    assert.equal(attempt.state, schema.RuntimePublicationAttemptState.Published);
    assert.equal(attempt.fencingToken, 1);
    assert.equal(attempt.requestFingerprint, expectedIdentity);

    const assets = await loadAssets(version.id);
    assert.equal(assets.length, 1);
    assert.equal(assets[0].provider, "s3-compatible");
    assert.equal(assets[0].isPrimary, true);

    const check = await publisher.verifyPublishedAssets(expectedIdentity);
    assert.equal(check.allOk, true);
  });

  test("2. verifyPublishedAssets fails closed when stored bytes no longer match the recorded SHA-256", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-2</html>`);
    const published = await publisher.publish(input, `${RUN}-t2`);
    // Corrupt the stored bytes underneath the database metadata.
    const finalKey = `runtime/${published.identity}/${sha256Hex(Buffer.from(input.files["index.html"]))}`;
    fake.objects.set(finalKey, Buffer.from("tampered"));
    const check = await publisher.verifyPublishedAssets(published.identity);
    assert.equal(check.allOk, false);
    assert.equal(check.assets[0].ok, false);
  });

  test("3. republishing the identical package under the same idempotency key reuses the same runtime", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-3</html>`);
    const key = `${RUN}-t3`;
    const first = await publisher.publish(input, key);
    const putsAfterFirst = fake.record.puts;

    const second = await publisher.publish(input, key);
    assert.equal(second.id, first.id);
    assert.equal(second.identity, first.identity);

    const versions = await db
      .select({ id: schema.runtimeVersions.id })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, first.identity));
    assert.equal(versions.length, 1, "exactly one runtime version row");

    // The version short-circuits to alreadyPublished before any re-lease, so
    // the attempt row is untouched: no retry bump, no token increment.
    const attempt = await loadAttempt(key);
    assert.equal(Number(attempt.retryCount), 0);
    assert.equal(attempt.state, schema.RuntimePublicationAttemptState.Published);
    assert.equal(attempt.fencingToken, 1);

    const assets = await loadAssets(first.id);
    assert.equal(assets.length, 1, "no duplicate asset rows");
    // The content-addressed final object was deduped; only fresh staging keys were written.
    const finalObjects = [...fake.objects.keys()].filter((k) => k.startsWith("runtime/"));
    assert.equal(finalObjects.length, 1);
    assert.equal(fake.record.puts, putsAfterFirst, "already-published short-circuit writes nothing to storage");
  });

  test("4. reusing an idempotency key for a different package fails with IDEMPOTENCY_CONFLICT and leaves no side effects", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const key = `${RUN}-t4`;
    const inputA = pkg(`<html>${RUN}-4a</html>`);
    const first = await publisher.publish(inputA, key);
    const attemptBefore = await loadAttempt(key);

    const inputB = pkg(`<html>${RUN}-4b-different</html>`);
    await assert.rejects(publisher.publish(inputB, key), (error: unknown) => isPubError(error, "IDEMPOTENCY_CONFLICT"));

    const identityB = canonicalizePackage(inputB).identity;
    assert.equal(await loadVersion(identityB), null, "no version row for the conflicting package");

    const attemptAfter = await loadAttempt(key);
    assert.equal(attemptAfter.fencingToken, attemptBefore.fencingToken, "rolled-back re-lease did not bump the token");
    assert.equal(attemptAfter.requestFingerprint, first.identity);
    const versionA = await loadVersion(first.identity);
    assert.equal(versionA.state, schema.RuntimeVersionState.Published, "original runtime untouched");
  });

  test("5. two concurrent publishers with one idempotency key produce exactly one published runtime", async () => {
    const fake = createFakeStore();
    // Two independent publisher instances (separate worker ids) share the store and DB.
    const publisherA = makePublisher(fake.store);
    const publisherB = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-5</html>`);
    const key = `${RUN}-t5`;

    const [resultA, resultB] = await Promise.all([
      publisherA.publish(input, key, { delayMs: 40 }),
      publisherB.publish(input, key, { delayMs: 40 }),
    ]);
    assert.equal(resultA.identity, resultB.identity);
    assert.equal(resultA.id, resultB.id);
    assert.equal(resultA.state, schema.RuntimeVersionState.Published);

    const versions = await db
      .select({ id: schema.runtimeVersions.id })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, resultA.identity));
    assert.equal(versions.length, 1, "exactly one runtime version");

    const attempts = await db
      .select({ id: schema.runtimePublicationAttempts.id })
      .from(schema.runtimePublicationAttempts)
      .where(eq(schema.runtimePublicationAttempts.idempotencyKey, key));
    assert.equal(attempts.length, 1, "exactly one attempt (unique idempotency key)");

    const attempt = await loadAttempt(key);
    assert.equal(attempt.state, schema.RuntimePublicationAttemptState.Published);
    assert.equal(attempt.fencingToken, 2, "loser's re-lease fenced the winner's token");

    const assets = await loadAssets(resultA.id);
    assert.equal(assets.length, 1, "exactly one final asset row per path");
    const finalObjects = [...fake.objects.keys()].filter((k) => k.startsWith("runtime/"));
    assert.equal(finalObjects.length, 1, "exactly one final stored object per content hash");
  });

  test("6. crash after staging upload is recoverable; the stale worker is fenced afterwards", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-6</html>`);
    const key = `${RUN}-t6`;
    const packageData = canonicalizePackage(input);

    await assert.rejects(
      publisher.publish(input, key, { crashAfter: "upload" }),
      (error: unknown) => isPubError(error, "STORAGE_ERROR"),
    );
    const crashed = await loadAttempt(key);
    assert.equal(crashed.state, schema.RuntimePublicationAttemptState.Failed);
    const versionAfterCrash = await loadVersion(packageData.identity);
    assert.equal(versionAfterCrash.state, schema.RuntimeVersionState.Failed, "version records the failure");

    const recovered = await publisher.recover(crashed.id, input);
    assert.equal(recovered.identity, packageData.identity);
    assert.equal(recovered.state, schema.RuntimeVersionState.Published);
    const after = await loadAttempt(key);
    assert.equal(after.fencingToken, 2, "recovery seized with a fresh fencing token");
    assert.equal(after.state, schema.RuntimePublicationAttemptState.Published);

    // The stale worker (token 1) must not be able to finalize after recovery.
    await assert.rejects(
      publisher.phases.finalizePublication(recovered.id, crashed.id, 1, packageData),
      (error: unknown) => isPubError(error, "FENCED"),
    );
  });

  test("7. recovery of a live lease is rejected with LEASE_HELD and the fencing token stays intact", async () => {
    const fake = createFakeStore();
    const publisher = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-7</html>`);
    const key = `${RUN}-t7`;
    const packageData = canonicalizePackage(input);
    const begun = await publisher.phases.beginAttempt(
      packageData,
      key,
      packageData.manifest.assets.length,
      [...packageData.files.values()].reduce((n, b) => n + b.length, 0),
      {},
      30,
    );
    assert.equal(begun.alreadyPublished, false);

    await assert.rejects(publisher.recover(begun.attemptId, input), (error: unknown) => isPubError(error, "LEASE_HELD"));
    const attempt = await loadAttempt(key);
    assert.equal(attempt.fencingToken, 1, "token unchanged while the lease is live");
  });

  test("8. storage failure marks version and attempt Failed; a fresh-key retry publishes cleanly", async () => {
    let fail = true;
    const fake = createFakeStore({ failPut: () => fail });
    const publisher = makePublisher(fake.store);
    const input = pkg(`<html>${RUN}-8</html>`);
    const key = `${RUN}-t8`;
    const identity = canonicalizePackage(input).identity;

    await assert.rejects(publisher.publish(input, key), (error: unknown) => isPubError(error, "STORAGE_ERROR"));
    const attempt = await loadAttempt(key);
    assert.equal(attempt.state, schema.RuntimePublicationAttemptState.Failed);
    assert.equal(attempt.lastErrorCode, "STORAGE_ERROR");
    const version = await loadVersion(identity);
    assert.equal(version.state, schema.RuntimeVersionState.Failed);
    assert.equal(version.failureCode, "STORAGE_ERROR");

    fail = false;
    const recovered = await publisher.publish(input, `${RUN}-t8-retry`);
    assert.equal(recovered.identity, identity);
    assert.equal(recovered.state, schema.RuntimeVersionState.Published);
    const versionAfter = await loadVersion(identity);
    assert.equal(versionAfter.state, schema.RuntimeVersionState.Published);
    assert.equal(versionAfter.failureCode, null, "failure bookkeeping cleared on retry");
  });

  test("9. a content-addressed key conflict with different bytes surfaces OBJECT_KEY_CONFLICT", async () => {
    const fake = createFakeStore();
    const input = pkg(`<html>${RUN}-9</html>`);
    const identity = canonicalizePackage(input).identity;
    const finalKey = `runtime/${identity}/${sha256Hex(Buffer.from(input.files["index.html"]))}`;
    fake.objects.set(finalKey, Buffer.from("pre-existing different bytes"));

    const publisher = makePublisher(fake.store);
    await assert.rejects(publisher.publish(input, `${RUN}-t9`), (error: unknown) => isPubError(error, "OBJECT_KEY_CONFLICT"));
    const attempt = await loadAttempt(`${RUN}-t9`);
    assert.equal(attempt.state, schema.RuntimePublicationAttemptState.Failed);
    assert.equal(attempt.lastErrorCode, "OBJECT_KEY_CONFLICT");
  });

  const s3Store = readS3StoreConfigFromEnv();
  const hasLiveS3 = Boolean(s3Store.config && s3Store.bucket);
  test("10. live S3 end-to-end: publish to real SeaweedFS and read the entry back through the Phase 4 reader", { skip: !hasLiveS3 && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_S3_BUCKET to run against live object storage" }, async () => {
    const store = createS3RuntimeContentStore(s3Store.config, s3Store.bucket);
    const publisher = makePublisher(store, { bucket: s3Store.bucket });
    const input = pkg(`<!doctype html><html><body>phase5-e2e ${RUN}</body></html>`);
    const key = `${RUN}-live-e2e`;

    const published = await publisher.publish(input, key);
    assert.equal(published.state, schema.RuntimeVersionState.Published);

    const check = await publisher.verifyPublishedAssets(published.identity);
    assert.equal(check.allOk, true, "stored bytes match recorded SHA-256 in real storage");

    const reader = createS3CompatibleEntryContentReader(db as never, s3Store.config);
    const content = await reader.read(published.id);
    assert.equal(content.html, input.files["index.html"]);
    assert.equal(content.runtimeIdentity, published.identity);
    assert.equal(content.sha256, published.assets[0].contentSha256);
  });
});
