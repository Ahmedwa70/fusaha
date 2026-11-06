// Runtime ↔ Lesson Content separation — consolidated proof suite for the
// architecture decision: runtime is the shared, content-independent execution
// engine; every lesson owns its own content; identical operational identity
// shares one runtime atomically; deletion of a lesson never deletes a runtime
// still referenced; a runtime becomes a deletion candidate only after zero
// references AND retention/protection conditions.
//
// DB-backed against the disposable integration database (RUNTIME_PUBLICATION_
// TEST_DATABASE_URL); storage is an injected in-memory store. Never touches
// the project DATABASE_URL, never any real object storage.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { approveLessonWithRuntime } = await import("./lesson-approval-publishing");
const { createRuntimePublisher } = await import("./runtime-publication");
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding");
const { assemblePlayableLesson } = await import("./lesson-play-resolution");
const { RuntimeContentStoreError } = await import("./runtime-content-store");
const { buildReferenceGraph, publishedUnreferencedVersions } = await import("./gc/gc-reference-graph");

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? "";

// Two template players stand in for two templates. Content NEVER enters the
// package — the approval orchestrator publishes exactly these bytes.
const PLAYER_T1 = "<!doctype html><html><body><h1>shared-player-engine</h1><script>window.__ENGINE__=1</script></body></html>";
const PLAYER_T2 = "<!doctype html><html><body><h1>other-player-engine</h1><script>window.__ENGINE__=2</script></body></html>";

function createFakeStore() {
  const objects = new Map<string, Buffer>();
  const deleted: string[] = [];
  return {
    objects,
    deleted,
    store: {
      async putIfAbsent(key: string, bytes: Buffer) {
        const existing = objects.get(key);
        if (existing) {
          if (!existing.equals(bytes)) throw new RuntimeContentStoreError(`conflict at ${key}`, "content-store-key-conflict");
          return "exists" as const;
        }
        objects.set(key, Buffer.from(bytes));
        return "created" as const;
      },
      async get(key: string) {
        const bytes = objects.get(key);
        if (!bytes) throw new RuntimeContentStoreError(`missing ${key}`, "content-store-not-found");
        return bytes;
      },
      async delete(key: string) {
        // Mirrors the Phase 2 production guard: final keys are never deletable.
        if (!key.startsWith("runtime-staging/")) {
          throw new RuntimeContentStoreError(`refusing to delete non-staged key: ${key}`, "content-store-key-forbidden");
        }
        deleted.push(key);
        objects.delete(key);
      },
      async listByPrefix(prefix: string) {
        return [...objects.keys()].filter((k) => k.startsWith(prefix));
      },
    },
  };
}

describe("runtime ↔ lesson content separation (DB-backed)", { skip: !databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const RUN = `sep-${Date.now()}`;
  let ownerId: string;
  let schemaDefinitionId: string;
  let versionCountBaseline = 0;

  const fake = createFakeStore();
  const publisher = () => createRuntimePublisher({ db: db as never, store: fake.store as never, bucket: "test-bucket" });
  const binding = () => createLessonVersionRuntimeBindingService(db as never);
  const validator = { run: async () => ({ ok: true as const, errors: [] as string[], warnings: [] as string[] }) };

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);

    const [role] = await db.insert(schema.roles).values({ name: `role-${RUN}`, title: "Separation Test", isSystem: false }).returning({ id: schema.roles.id });
    const [user] = await db.insert(schema.users).values({ id: randomUUID(), email: `sep-${RUN}@example.test`, name: "Separation Test", roleId: role.id }).returning({ id: schema.users.id });
    ownerId = user.id;
    const [def] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: `sep-${RUN}`, level: { en: "Separation" }, version: "v1", content: "{}", active: true, templateId: null })
      .returning({ id: schema.schemaDefinitions.id });
    schemaDefinitionId = def.id;
    versionCountBaseline = (await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)).length;
  });

  after(async () => {
    if (client) await client.end();
  });

  async function createLesson(content: unknown) {
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId, name: `lesson-${randomUUID()}` })
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({ lessonId: lesson.id, versionNumber: 1, schemaDefinitionId, content })
      .returning({ id: schema.lessonVersions.id });
    return { lessonId: lesson.id, versionId: version.id };
  }

  async function approve(lessonId: string, versionId: string, player: string) {
    const result = await approveLessonWithRuntime(
      {
        lessonId,
        lessonVersionId: versionId,
        htmlPlayer: player,
        sourceTemplateId: null,
        content: {},
        validationScript: "validate()",
      },
      {
        publisher: publisher(),
        bindingService: binding(),
        db: db as never,
        validator,
      },
    );
    assert.ok(result.ok, `approval must succeed: ${result.ok === false ? result.message : ""}`);
    return result;
  }

  async function softDeleteLesson(lessonId: string) {
    await db.update(schema.lessons).set({ deletedAt: new Date() }).where(eq(schema.lessons.id, lessonId));
  }

  async function loadVersionByIdentity(identity: string) {
    const rows = await db
      .select()
      .from(schema.runtimeVersions)
      .where(and(eq(schema.runtimeVersions.identityAlgorithm, "runtime-package/v1"), eq(schema.runtimeVersions.identity, identity)))
      .limit(1);
    return rows[0] ?? null;
  }

  async function assetChain(runtimeVersionId: string) {
    return db
      .select({
        path: schema.runtimeAssets.path,
        contentSha256: schema.runtimeAssets.contentSha256,
        storageObjectId: schema.runtimeAssets.storageObjectId,
        sizeBytes: schema.runtimeStorageObjects.sizeBytes,
      })
      .from(schema.runtimeAssets)
      .innerJoin(schema.runtimeStorageObjects, eq(schema.runtimeStorageObjects.id, schema.runtimeAssets.storageObjectId))
      .where(eq(schema.runtimeAssets.runtimeVersionId, runtimeVersionId));
  }

  async function runtimeVersionCount(identity: string) {
    const rows = await db
      .select({ id: schema.runtimeVersions.id })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, identity));
    return rows.length;
  }

  // ---- scenario fixtures shared by tests 1–6 ----
  const lessonA = { content: { title: "Lesson Alpha", steps: ["a1", "a2"] } };
  const lessonB = { content: { title: "Lesson Beta", steps: ["b1"] } };
  let A: { lessonId: string; versionId: string };
  let B: { lessonId: string; versionId: string };
  let D: { lessonId: string; versionId: string };
  let E: { lessonId: string; versionId: string };
  let sharedIdentity: string;
  let sharedRuntimeVersionId: string;

  test("1. two lessons with different content on the same player share one published runtime", async () => {
    A = await createLesson(lessonA.content);
    B = await createLesson(lessonB.content);
    const ra = await approve(A.lessonId, A.versionId, PLAYER_T1);
    const rb = await approve(B.lessonId, B.versionId, PLAYER_T1);
    assert.equal(ra.runtimeIdentity, rb.runtimeIdentity, "identical player bytes must produce identical runtime identity");
    assert.equal(ra.runtimeVersionId, rb.runtimeVersionId, "both lessons must bind to the same runtime version row");
    sharedIdentity = ra.runtimeIdentity;
    sharedRuntimeVersionId = ra.runtimeVersionId;
    assert.equal(await runtimeVersionCount(sharedIdentity), 1, "exactly one runtime version exists for the shared identity");

    // One physical storage object backs both versions' assets (dedupe at the object level).
    const [assetsA, assetsB] = [await assetChain(sharedRuntimeVersionId), await assetChain(sharedRuntimeVersionId)];
    assert.equal(assetsA.length, 1);
    assert.equal(assetsA[0].storageObjectId, assetsB[0].storageObjectId);

    // A DIFFERENT player is a different runtime — separation by operational identity.
    const C = await createLesson({ title: "Lesson Gamma" });
    const rc = await approve(C.lessonId, C.versionId, PLAYER_T2);
    assert.notEqual(rc.runtimeIdentity, sharedIdentity, "different player bytes must produce a different identity");
    assert.equal(await runtimeVersionCount(rc.runtimeIdentity), 1);
  });

  test("2. each lesson's content loads independently of the shared runtime", async () => {
    const resolveRuntime = (id: string) => binding().resolveLessonVersionRuntime(id);
    const readRuntimeEntry = async () => ({ html: PLAYER_T1 });

    const playableA = await assemblePlayableLesson(
      { name: "Lesson Alpha", content: lessonA.content, lessonVersionId: A.versionId, runtimeBinding: { status: schema.RuntimeBindingStatus.Bound, runtimeVersionId: sharedRuntimeVersionId }, fetchTemplateHtmlPlayer: async () => null },
      { isEnabled: () => true, resolveRuntime, readRuntimeEntry },
    );
    const playableB = await assemblePlayableLesson(
      { name: "Lesson Beta", content: lessonB.content, lessonVersionId: B.versionId, runtimeBinding: { status: schema.RuntimeBindingStatus.Bound, runtimeVersionId: sharedRuntimeVersionId }, fetchTemplateHtmlPlayer: async () => null },
      { isEnabled: () => true, resolveRuntime, readRuntimeEntry },
    );

    assert.ok(playableA && playableB);
    assert.equal(playableA.source, "runtime");
    assert.equal(playableB.source, "runtime");
    assert.equal(playableA.htmlPlayer, PLAYER_T1, "player HTML comes from the shared runtime");
    assert.deepEqual(playableA.content, lessonA.content, "content A is the lesson's own data");
    assert.deepEqual(playableB.content, lessonB.content, "content B is the lesson's own data");
    assert.notDeepEqual(playableA.content, playableB.content, "contents are independent despite the shared runtime");
  });

  test("3. editing a lesson's content creates no runtime and does not disturb the other lesson", async () => {
    const edited = { title: "Lesson Alpha (edited)", steps: ["a1", "a2", "a3"] };
    await db.update(schema.lessonVersions).set({ content: edited }).where(eq(schema.lessonVersions.id, A.versionId));

    assert.equal(await runtimeVersionCount(sharedIdentity), 1, "no new runtime version after a content edit");
    assert.equal((await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)).length, versionCountBaseline + 2, "total runtime versions unchanged");

    const stillB = await binding().resolveLessonVersionRuntime(B.versionId);
    assert.equal(stillB.mode, "bound");
    assert.equal(stillB.runtimeVersionId, sharedRuntimeVersionId, "lesson B still bound to the same runtime");

    // The approved resolution path keeps serving runtime bytes; content is read
    // from the lesson_versions row, so the edit is observable there.
    const [row] = await db.select({ content: schema.lessonVersions.content }).from(schema.lessonVersions).where(eq(schema.lessonVersions.id, A.versionId));
    assert.deepEqual(row.content, edited);
  });

  test("4. concurrent approvals of two lessons with the same player create exactly one runtime", async () => {
    D = await createLesson({ title: "Concurrent D" });
    E = await createLesson({ title: "Concurrent E" });
    const [rd, re] = await Promise.all([
      approve(D.lessonId, D.versionId, PLAYER_T1),
      approve(E.lessonId, E.versionId, PLAYER_T1),
    ]);
    assert.equal(rd.runtimeIdentity, sharedIdentity);
    assert.equal(re.runtimeIdentity, sharedIdentity);
    assert.equal(rd.runtimeVersionId, sharedRuntimeVersionId, "concurrent publish deduped to the existing runtime");
    assert.equal(await runtimeVersionCount(sharedIdentity), 1, "still exactly one runtime version for the identity");

    const reconciliation = await binding().getBindingReconciliation();
    assert.equal(reconciliation.integrityViolations.length, 0, "no bound row pointing at a missing/non-published runtime");
  });

  test("5. deleting one lesson keeps the shared runtime and the other lesson playable", async () => {
    await softDeleteLesson(A.lessonId);

    // Deleted lesson fails closed — no runtime bytes served for it.
    await assert.rejects(
      () => binding().resolveLessonVersionRuntime(A.versionId),
      (error: unknown) => error instanceof Error && /deleted lesson/.test(error.message),
    );

    // The sibling lesson is untouched and still bound to the same runtime.
    const resolvedB = await binding().resolveLessonVersionRuntime(B.versionId);
    assert.equal(resolvedB.mode, "bound");
    assert.equal(resolvedB.runtimeVersionId, sharedRuntimeVersionId);

    // The runtime row itself is untouched.
    const versionRow = await loadVersionByIdentity(sharedIdentity);
    assert.equal(versionRow?.state, 1, "shared runtime remains Published");

    // The deleted lesson still counts as a reference (soft delete never cuts the
    // runtime reference graph), so the runtime must NOT be retention-eligible.
    const snapshot = {
      versions: (await db.select({ id: schema.runtimeVersions.id, identity: schema.runtimeVersions.identity, state: schema.runtimeVersions.state }).from(schema.runtimeVersions)).map((v) => ({ ...v, state: Number(v.state) })),
      assets: await db.select({ runtimeVersionId: schema.runtimeAssets.runtimeVersionId, storageObjectId: schema.runtimeAssets.storageObjectId, path: schema.runtimeAssets.path, contentSha256: schema.runtimeAssets.contentSha256 }).from(schema.runtimeAssets),
      storageObjects: await db.select({ id: schema.runtimeStorageObjects.id, contentSha256: schema.runtimeStorageObjects.contentSha256, state: schema.runtimeStorageObjects.state }).from(schema.runtimeStorageObjects),
      locations: await db.select({ storageObjectId: schema.runtimeStorageLocations.storageObjectId, provider: schema.runtimeStorageLocations.provider, bucket: schema.runtimeStorageLocations.bucket, objectKey: schema.runtimeStorageLocations.objectKey }).from(schema.runtimeStorageLocations),
      attempts: await db.select({ id: schema.runtimePublicationAttempts.id, runtimeIdentity: schema.runtimePublicationAttempts.runtimeIdentity, state: schema.runtimePublicationAttempts.state, stagingNamespace: schema.runtimePublicationAttempts.stagingNamespace, fencingToken: schema.runtimePublicationAttempts.fencingToken }).from(schema.runtimePublicationAttempts),
      lessonVersions: (await db.select({ runtimeVersionId: schema.lessonVersions.runtimeVersionId, runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus, lessonDeletedAt: schema.lessons.deletedAt }).from(schema.lessonVersions).innerJoin(schema.lessons, eq(schema.lessonVersions.lessonId, schema.lessons.id))).map((r) => ({ runtimeVersionId: r.runtimeVersionId, runtimeBindingStatus: Number(r.runtimeBindingStatus), lessonDeletedAt: r.lessonDeletedAt ? r.lessonDeletedAt.toISOString() : null })),
    };
    const graph = buildReferenceGraph(snapshot);
    const unreferenced = publishedUnreferencedVersions(snapshot, graph);
    assert.ok(!unreferenced.includes(sharedRuntimeVersionId), "runtime with a (soft-)deleted-lesson reference is not unreferenced");
    const refs = graph.versionRefs.get(sharedRuntimeVersionId);
    assert.ok(refs && refs.total >= 2 && refs.viaDeletedLessons >= 1, "reference graph still counts the deleted lesson");
  });

  test("6. a runtime is never a deletion candidate while referenced; unreferenced published runtimes are retention-protected", async () => {
    // Un-reference the runtime through the DESIGNED path: soft-deleting lessons
    // alone never cuts references (test 5) — explicit remediation of the version
    // rows is required, and even then the retention policy protects the runtime.
    await binding().quarantineLessonVersion({ lessonVersionId: A.versionId, reason: "separation-test cleanup" });
    await binding().quarantineLessonVersion({ lessonVersionId: B.versionId, reason: "separation-test cleanup" });
    await binding().quarantineLessonVersion({ lessonVersionId: D.versionId, reason: "separation-test cleanup" });
    await binding().quarantineLessonVersion({ lessonVersionId: E.versionId, reason: "separation-test cleanup" });

    const snapshot = {
      versions: (await db.select({ id: schema.runtimeVersions.id, identity: schema.runtimeVersions.identity, state: schema.runtimeVersions.state }).from(schema.runtimeVersions)).map((v) => ({ ...v, state: Number(v.state) })),
      assets: await db.select({ runtimeVersionId: schema.runtimeAssets.runtimeVersionId, storageObjectId: schema.runtimeAssets.storageObjectId, path: schema.runtimeAssets.path, contentSha256: schema.runtimeAssets.contentSha256 }).from(schema.runtimeAssets),
      storageObjects: await db.select({ id: schema.runtimeStorageObjects.id, contentSha256: schema.runtimeStorageObjects.contentSha256, state: schema.runtimeStorageObjects.state }).from(schema.runtimeStorageObjects),
      locations: await db.select({ storageObjectId: schema.runtimeStorageLocations.storageObjectId, provider: schema.runtimeStorageLocations.provider, bucket: schema.runtimeStorageLocations.bucket, objectKey: schema.runtimeStorageLocations.objectKey }).from(schema.runtimeStorageLocations),
      attempts: await db.select({ id: schema.runtimePublicationAttempts.id, runtimeIdentity: schema.runtimePublicationAttempts.runtimeIdentity, state: schema.runtimePublicationAttempts.state, stagingNamespace: schema.runtimePublicationAttempts.stagingNamespace, fencingToken: schema.runtimePublicationAttempts.fencingToken }).from(schema.runtimePublicationAttempts),
      lessonVersions: (await db.select({ runtimeVersionId: schema.lessonVersions.runtimeVersionId, runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus, lessonDeletedAt: schema.lessons.deletedAt }).from(schema.lessonVersions).innerJoin(schema.lessons, eq(schema.lessonVersions.lessonId, schema.lessons.id))).map((r) => ({ runtimeVersionId: r.runtimeVersionId, runtimeBindingStatus: Number(r.runtimeBindingStatus), lessonDeletedAt: r.lessonDeletedAt ? r.lessonDeletedAt.toISOString() : null })),
    };
    const graph = buildReferenceGraph(snapshot);
    const unreferenced = publishedUnreferencedVersions(snapshot, graph);
    assert.ok(unreferenced.includes(sharedRuntimeVersionId), "now the runtime is published AND has zero lesson references");

    // Its physical object is registered in runtime_storage_locations, so the GC
    // eligibility core classifies it KEEP regardless — and the retention policy
    // explicitly protects published-unreferenced versions pending owner decision.
    const { classifyObject, evaluateRetention } = await import("./gc/gc-eligibility");
    const loc = snapshot.locations.find((l) => snapshot.assets.some((a) => a.runtimeVersionId === sharedRuntimeVersionId && a.storageObjectId === l.storageObjectId));
    assert.ok(loc, "shared runtime object has a registered primary location");
    const record = {
      s3: { bucket: loc.bucket, key: loc.objectKey, size: 0, lastModified: new Date(0), etag: null },
      kind: "runtime-final" as const,
      identity: sharedIdentity,
      contentSha: null,
      stagingAttemptId: null,
      stagingToken: null,
      hasLocationRow: true,
      shaKnownInDb: true,
      identityKnownInDb: true,
      identityInFlight: false,
    };
    const decision = classifyObject(record, { graph, now: new Date(), graceMs: 24 * 3600 * 1000, previousRunKeys: new Set(), listingComplete: true });
    assert.equal(decision.classification, "KEEP", "registered runtime object can never classify as a deletion candidate");
    const retention = evaluateRetention(snapshot, graph);
    assert.ok(retention.retentionProtectedVersionIds.includes(sharedRuntimeVersionId));

    // And the storage layer itself refuses to delete final keys (Phase 2 guard).
    await assert.rejects(
      () => fake.store.delete(loc.objectKey),
      (error: unknown) => error instanceof RuntimeContentStoreError,
    );
  });
});
