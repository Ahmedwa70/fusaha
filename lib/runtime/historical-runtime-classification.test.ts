// Phase 6 integration tests: historical runtime classification, dry-run
// planning, classified migration, and the data-safety gate. Runs against a
// real migrated disposable database (RUNTIME_PUBLICATION_TEST_DATABASE_URL /
// RUNTIME_BINDING_TEST_DATABASE_URL) — never the project DATABASE_URL, never
// staging/production. Storage is an injected in-memory store.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const {
  classifyHistoricalLessonVersions,
  planHistoricalRuntimeMigration,
  applyHistoricalRuntimeMigration,
} = await import("./historical-runtime-classification.ts" as string);
const { createRuntimePublisher } = await import("./runtime-publication.ts" as string);
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);
const { canonicalizePackage } = await import("./runtime-identity-v1.ts" as string);
const { RuntimeContentStoreError } = await import("./runtime-content-store.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function contentHash(content: unknown): string {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

function createFakeStore() {
  const objects = new Map<string, Buffer>();
  return {
    objects,
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
    },
  };
}

describe("historical runtime classification & migration (DB-backed)", { skip: !databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let publisher: ReturnType<typeof createRuntimePublisher>;
  let bindingService: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  const RUN = `hist-${Date.now()}`;
  const BASE = new Date("2026-01-01T00:00:00Z");
  const LATER = new Date("2026-06-01T00:00:00Z");

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    const fake = createFakeStore();
    publisher = createRuntimePublisher({ db: db as never, store: fake.store as never, bucket: "hist-bucket" });
    bindingService = createLessonVersionRuntimeBindingService(db as never);
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  async function makeOwner() {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folder] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    return { userId: user.id, folderId: folder.id, tag };
  }

  async function makeTemplate(owner: { userId: string }, htmlPlayer: string, updatedAt: Date) {
    return db
      .insert(schema.templates)
      .values({
        name: `${RUN}-tmpl-${randomUUID().slice(0, 8)}`,
        htmlPlayer,
        blueprint: "{}",
        validationScript: "return true",
        createdAt: BASE,
        updatedAt,
      } as never)
      .returning({ id: schema.templates.id });
  }

  async function makeSchemaDefinition(templateId: string | null) {
    const tag = `${RUN}-sd-${randomUUID().slice(0, 8)}`;
    const [row] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId } as never)
      .returning({ id: schema.schemaDefinitions.id });
    return row;
  }

  async function makeLessonVersion(
    owner: { userId: string; folderId: string },
    options: {
      schemaDefinitionId: string;
      status: number;
      createdAt: Date;
      approvedAt?: Date | null;
      bindingStatus?: number;
      runtimeVersionId?: string | null;
      versionNumber?: number;
      content?: unknown;
    },
  ) {
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: owner.userId, folderId: owner.folderId, name: `${RUN}-lesson-${randomUUID().slice(0, 8)}` } as never)
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: lesson.id,
        versionNumber: options.versionNumber ?? 1,
        status: options.status,
        schemaDefinitionId: options.schemaDefinitionId,
        content: options.content ?? { words: [randomUUID()] },
        createdAt: options.createdAt,
        approvedAt: options.approvedAt ?? null,
        runtimeBindingStatus: options.bindingStatus ?? schema.RuntimeBindingStatus.Unbound,
        runtimeVersionId: options.runtimeVersionId ?? null,
      } as never)
      .returning({ id: schema.lessonVersions.id, lessonId: schema.lessonVersions.lessonId });
    return version;
  }

  async function insertPublishedRuntime(identity: string) {
    const [row] = await db
      .insert(schema.runtimeVersions)
      .values({
        identity,
        identityAlgorithm: "runtime-package/v1",
        state: schema.RuntimeVersionState.Published,
        packageKind: 0,
        entryPoint: "index.html",
        manifest: { entryPoint: "index.html", assets: [{ path: "index.html" }] },
        manifestSha256: randomUUID().replaceAll("-", "").repeat(2).slice(0, 64),
        assetCount: 1,
        packageSizeBytes: 64,
      } as never)
      .returning({ id: schema.runtimeVersions.id });
    return row;
  }

  async function snapshotSafetyData() {
    const versions = await db
      .select({ id: schema.lessonVersions.id, content: schema.lessonVersions.content, status: schema.lessonVersions.status })
      .from(schema.lessonVersions);
    const lessonsRows = await db
      .select({ id: schema.lessons.id, state: schema.lessons.state, currentApprovedVersionId: schema.lessons.currentApprovedVersionId })
      .from(schema.lessons);
    const shareLinks = await db.select().from(schema.shareLinks);
    return {
      versionCount: versions.length,
      contentHashes: new Map(versions.map((v) => [v.id, contentHash(v.content)])),
      statuses: new Map(versions.map((v) => [v.id, v.status])),
      lessons: new Map(lessonsRows.map((l) => [l.id, stableStringify(l)])),
      shareLinkCount: shareLinks.length,
    };
  }

  async function expectSafetyDataUnchanged(snapshot: Awaited<ReturnType<typeof snapshotSafetyData>>) {
    const after = await snapshotSafetyData();
    assert.equal(after.versionCount, snapshot.versionCount, "no lesson version lost or created");
    for (const [id, hash] of snapshot.contentHashes) {
      assert.equal(after.contentHashes.get(id), hash, `content of ${id} unchanged`);
    }
    for (const [id, status] of snapshot.statuses) {
      assert.equal(after.statuses.get(id), status, `approval status of ${id} unchanged`);
    }
    for (const [id, lesson] of snapshot.lessons) {
      assert.equal(after.lessons.get(id), lesson, `lesson ${id} approvals/links unchanged`);
    }
    assert.equal(after.shareLinkCount, snapshot.shareLinkCount, "share links untouched");
  }

  test("1. classification: every evidence combination maps to its deterministic class", async () => {
    const owner = await makeOwner();

    // Bound candidate: template never touched after the version was created.
    const [t1] = await makeTemplate(owner, `<html>${RUN}-player-1</html>`, BASE);
    const sd1 = await makeSchemaDefinition(t1.id);
    const vBound = await makeLessonVersion(owner, {
      schemaDefinitionId: sd1.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
    });

    // Quarantined conflict: template modified after generation, no decision.
    const [t2] = await makeTemplate(owner, `<html>${RUN}-player-2</html>`, BASE);
    const sd2 = await makeSchemaDefinition(t2.id);
    const vConflict = await makeLessonVersion(owner, {
      schemaDefinitionId: sd2.id,
      status: schema.VersionStatus.Approved,
      createdAt: BASE,
      approvedAt: BASE,
    });
    await db.update(schema.templates).set({ updatedAt: LATER }).where(eq(schema.templates.id, t2.id));

    // Legacy decision: same conflict shape, but an explicit operator decision.
    const [t3] = await makeTemplate(owner, `<html>${RUN}-player-3</html>`, BASE);
    const sd3 = await makeSchemaDefinition(t3.id);
    const vLegacy = await makeLessonVersion(owner, {
      schemaDefinitionId: sd3.id,
      status: schema.VersionStatus.Approved,
      createdAt: BASE,
      approvedAt: BASE,
    });
    await db.update(schema.templates).set({ updatedAt: LATER }).where(eq(schema.templates.id, t3.id));

    // Out of scope: draft.
    const [t4] = await makeTemplate(owner, `<html>${RUN}-player-4</html>`, BASE);
    const sd4 = await makeSchemaDefinition(t4.id);
    const vDraft = await makeLessonVersion(owner, {
      schemaDefinitionId: sd4.id,
      status: schema.VersionStatus.Draft,
      createdAt: LATER,
    });

    // Quarantined gap: no linked template at all.
    const sd5 = await makeSchemaDefinition(null);
    const vGap = await makeLessonVersion(owner, {
      schemaDefinitionId: sd5.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
    });

    // Already bound (verified) — and an integrity violation (bound to a
    // runtime row that does not exist in published form).
    const [t6] = await makeTemplate(owner, `<html>${RUN}-player-6</html>`, BASE);
    const sd6 = await makeSchemaDefinition(t6.id);
    const goodRuntime = await insertPublishedRuntime(`sha256-v1-${randomUUID().replaceAll("-", "").repeat(2).slice(0, 64)}`);
    const vAlreadyBound = await makeLessonVersion(owner, {
      schemaDefinitionId: sd6.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
      bindingStatus: schema.RuntimeBindingStatus.Bound,
      runtimeVersionId: goodRuntime.id,
    });
    // Integrity violation reachable within the schema's constraints: the
    // binding points at a runtime row that exists but never reached Published.
    const failedRuntime = await insertPublishedRuntime(`sha256-v1-${randomUUID().replaceAll("-", "").repeat(2).slice(0, 64)}`);
    await db
      .update(schema.runtimeVersions)
      .set({ state: schema.RuntimeVersionState.Failed })
      .where(eq(schema.runtimeVersions.id, failedRuntime.id));
    const vViolation = await makeLessonVersion(owner, {
      schemaDefinitionId: sd6.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
      bindingStatus: schema.RuntimeBindingStatus.Bound,
      runtimeVersionId: failedRuntime.id,
    });

    // Remediated: previously quarantined by an operator.
    const [t7] = await makeTemplate(owner, `<html>${RUN}-player-7</html>`, BASE);
    const sd7 = await makeSchemaDefinition(t7.id);
    const vRemediated = await makeLessonVersion(owner, {
      schemaDefinitionId: sd7.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
      bindingStatus: schema.RuntimeBindingStatus.Quarantined,
    });

    const decisions = [{ lessonVersionId: vLegacy.id, reason: "operator-approved legacy snapshot (Phase 6 decision log #1)" }];
    const inventory = await classifyHistoricalLessonVersions(db as never, { legacyDecisions: decisions });
    type ClassifiedEntry = { lessonVersionId: string; classification: string };
    const byId = new Map<string, ClassifiedEntry>(
      inventory.entries.map((e: ClassifiedEntry) => [e.lessonVersionId, e] as const),
    );

    assert.equal(byId.get(vBound.id)?.classification, "bound-candidate");
    assert.equal(byId.get(vConflict.id)?.classification, "quarantined-conflict");
    assert.equal(byId.get(vLegacy.id)?.classification, "legacy-decision");
    assert.equal(byId.get(vDraft.id)?.classification, "out-of-scope-draft");
    assert.equal(byId.get(vGap.id)?.classification, "quarantined-gap");
    assert.equal(byId.get(vAlreadyBound.id)?.classification, "already-bound");
    assert.equal(byId.get(vRemediated.id)?.classification, "remediated");

    // Integrity: the bound-to-missing-runtime row is flagged, the valid one is not.
    assert.ok(
      inventory.integrityViolations.some((v: { lessonVersionId: string }) => v.lessonVersionId === vViolation.id),
      "bound row pointing at a nonexistent runtime is flagged",
    );
    assert.ok(
      !inventory.integrityViolations.some((v: { lessonVersionId: string }) => v.lessonVersionId === vAlreadyBound.id),
      "valid bound row is not flagged",
    );

    // Without a decision, the legacy version degrades to a reviewable conflict — never Legacy.
    const noDecision = await classifyHistoricalLessonVersions(db as never);
    assert.equal(
      noDecision.entries.find((e: { lessonVersionId: string; classification: string }) => e.lessonVersionId === vLegacy.id)?.classification,
      "quarantined-conflict",
    );

    // Unbound bucket exists but nothing healthy lands in it (defensive class).
    assert.equal(noDecision.counts["unbound-insufficient-evidence"], 0);
  });

  test("2. dry-run plan reports per-template publication groups and performs zero writes", async () => {
    const owner = await makeOwner();
    const planBefore = await planHistoricalRuntimeMigration(db as never);
    const [t1] = await makeTemplate(owner, `<html>${RUN}-dryrun-1</html>`, BASE);
    const [t2] = await makeTemplate(owner, `<html>${RUN}-dryrun-2</html>`, BASE);
    const sd1 = await makeSchemaDefinition(t1.id);
    const sd2 = await makeSchemaDefinition(t2.id);
    await makeLessonVersion(owner, { schemaDefinitionId: sd1.id, status: schema.VersionStatus.Approved, createdAt: LATER, approvedAt: LATER });
    await makeLessonVersion(owner, { schemaDefinitionId: sd1.id, status: schema.VersionStatus.Approved, createdAt: LATER, approvedAt: LATER, versionNumber: 2 });
    // Legacy decision requires LOST immutability evidence: version generated
    // BEFORE the template was later modified.
    const vLegacy = await makeLessonVersion(owner, { schemaDefinitionId: sd2.id, status: schema.VersionStatus.Approved, createdAt: BASE, approvedAt: BASE });
    await db.update(schema.templates).set({ updatedAt: LATER }).where(eq(schema.templates.id, t2.id));

    const safetyBefore = await snapshotSafetyData();
    const plan = await planHistoricalRuntimeMigration(db as never, {
      legacyDecisions: [{ lessonVersionId: vLegacy.id, reason: "dry-run decision" }],
    });
    await expectSafetyDataUnchanged(safetyBefore);

    assert.equal(plan.dryRun, true);
    assert.equal(plan.bindBound, planBefore.bindBound + 2);
    assert.equal(plan.bindLegacy, planBefore.bindLegacy + 1);
    type PublishGroup = { templateId: string; boundCandidates: number; legacyDecisions: number };
    const groups = new Map<string, PublishGroup>(
      plan.publishByTemplate.map((g: PublishGroup) => [g.templateId, g] as const),
    );
    assert.equal(groups.get(t1.id)?.boundCandidates, 2, "one publication group per distinct template");
    assert.equal(groups.get(t2.id)?.legacyDecisions, 1);
    const skippedCounts: Record<string, number> = plan.skipped;
    const skippedTotal = Object.values(skippedCounts).reduce((sum: number, n: number) => sum + n, 0);
    assert.equal(
      skippedTotal + plan.bindBound + plan.bindLegacy,
      safetyBefore.versionCount,
      "every version is accounted for: actionable or explicitly skipped",
    );
  });

  test("3. classified migration binds only provable classes and is fully rerunnable", async () => {
    const owner = await makeOwner();
    const html = `<html>${RUN}-migrate-player</html>`;
    const [t1] = await makeTemplate(owner, html, BASE);
    const sd1 = await makeSchemaDefinition(t1.id);
    const vBound = await makeLessonVersion(owner, { schemaDefinitionId: sd1.id, status: schema.VersionStatus.Approved, createdAt: LATER, approvedAt: LATER });
    const [t2] = await makeTemplate(owner, `<html>${RUN}-migrate-player-legacy</html>`, BASE);
    const sd2 = await makeSchemaDefinition(t2.id);
    const vLegacy = await makeLessonVersion(owner, { schemaDefinitionId: sd2.id, status: schema.VersionStatus.Approved, createdAt: LATER, approvedAt: LATER });
    // Modified-template version WITHOUT a decision: must stay untouched.
    await db.update(schema.templates).set({ updatedAt: new Date("2027-01-01T00:00:00Z") }).where(eq(schema.templates.id, t2.id));
    const [t3] = await makeTemplate(owner, `<html>${RUN}-migrate-player-conflict</html>`, BASE);
    const sd3 = await makeSchemaDefinition(t3.id);
    const vConflict = await makeLessonVersion(owner, { schemaDefinitionId: sd3.id, status: schema.VersionStatus.Approved, createdAt: LATER, approvedAt: LATER });
    await db.update(schema.templates).set({ updatedAt: new Date("2027-01-01T00:00:00Z") }).where(eq(schema.templates.id, t3.id));

    const safetyBefore = await snapshotSafetyData();
    const runtimesBefore = (await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)).length;

    const decision = { lessonVersionId: vLegacy.id, reason: "Phase 6 decision log: legacy snapshot accepted" };
    const first = await applyHistoricalRuntimeMigration(db as never, {
      publisher,
      bindingService,
      legacyDecisions: [decision],
    });

    // This run also migrates earlier suites' bound-candidates (same shared
    // disposable DB); assert this fixture's outcomes explicitly.
    assert.ok(first.boundVersionIds.includes(vBound.id), "bound candidate bound");
    assert.ok(first.legacyVersionIds.includes(vLegacy.id), "legacy decision applied");
    assert.ok(first.publishedTemplateIds.includes(t1.id) && first.publishedTemplateIds.includes(t2.id));

    const expectedIdentity = canonicalizePackage({ files: { "index.html": html }, capabilities: ["lesson-data"] }).identity;
    const boundRow = await db
      .select({ runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus, runtimeVersionId: schema.lessonVersions.runtimeVersionId, status: schema.lessonVersions.status })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, vBound.id))
      .limit(1);
    assert.equal(boundRow[0].runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.equal(boundRow[0].status, schema.VersionStatus.Approved, "approval state untouched");
    const boundRuntime = await db
      .select({ identity: schema.runtimeVersions.identity, state: schema.runtimeVersions.state })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.id, boundRow[0].runtimeVersionId as string))
      .limit(1);
    assert.equal(boundRuntime[0].identity, expectedIdentity, "bound runtime identity provably matches the historical player bytes");
    assert.equal(boundRuntime[0].state, schema.RuntimeVersionState.Published);

    const legacyRow = await db
      .select({ runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, vLegacy.id))
      .limit(1);
    assert.equal(legacyRow[0].runtimeBindingStatus, schema.RuntimeBindingStatus.Legacy);

    const conflictRow = await db
      .select({ runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus, runtimeVersionId: schema.lessonVersions.runtimeVersionId })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, vConflict.id))
      .limit(1);
    assert.equal(conflictRow[0].runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound, "conflict never silently bound");
    assert.equal(conflictRow[0].runtimeVersionId, null);

    await expectSafetyDataUnchanged(safetyBefore);

    // Rerun: nothing new is bound or published, data still consistent.
    const second = await applyHistoricalRuntimeMigration(db as never, {
      publisher,
      bindingService,
      legacyDecisions: [decision],
    });
    assert.equal(second.boundVersionIds.length, 0, "rerun binds nothing new");
    assert.equal(second.legacyVersionIds.length, 0, "rerun applies no legacy");
    assert.equal(second.publishedTemplateIds.length, 0, "rerun publishes nothing");
    const runtimesAfter = (await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)).length;
    assert.ok(runtimesAfter - runtimesBefore >= 2, "one new runtime per distinct new template player was created");
    assert.equal(runtimesAfter - runtimesBefore, first.publishedTemplateIds.length, "no duplicate runtimes appear on rerun");
    await expectSafetyDataUnchanged(safetyBefore);
  });

  test("4. a legacy decision without a reason fails closed and binds nothing for that decision", async () => {
    const owner = await makeOwner();
    const [t1] = await makeTemplate(owner, `<html>${RUN}-noreason</html>`, BASE);
    await db.update(schema.templates).set({ updatedAt: LATER }).where(eq(schema.templates.id, t1.id));
    const sd1 = await makeSchemaDefinition(t1.id);
    const vLegacy = await makeLessonVersion(owner, { schemaDefinitionId: sd1.id, status: schema.VersionStatus.Approved, createdAt: BASE, approvedAt: BASE });

    await assert.rejects(
      applyHistoricalRuntimeMigration(db as never, {
        publisher,
        bindingService,
        legacyDecisions: [{ lessonVersionId: vLegacy.id, reason: "   " }],
      }),
      /lacks a reason/,
    );

    const row = await db
      .select({ runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus, runtimeVersionId: schema.lessonVersions.runtimeVersionId })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, vLegacy.id))
      .limit(1);
    assert.equal(row[0].runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound, "no binding established");
    assert.equal(row[0].runtimeVersionId, null);
  });

  test("5. post-migration: bound historical version resolves to the pinned runtime bytes, immune to later template edits", async () => {
    const owner = await makeOwner();
    const html = `<html>${RUN}-resolver-player</html>`;
    const [t1] = await makeTemplate(owner, html, BASE);
    const sd1 = await makeSchemaDefinition(t1.id);
    const version = await makeLessonVersion(owner, {
      schemaDefinitionId: sd1.id,
      status: schema.VersionStatus.Approved,
      createdAt: LATER,
      approvedAt: LATER,
      content: { words: ["historical"] },
    });

    const fake = createFakeStore();
    const migratingPublisher = createRuntimePublisher({ db: db as never, store: fake.store as never, bucket: "hist-bucket" });
    const migrated = await applyHistoricalRuntimeMigration(db as never, { publisher: migratingPublisher, bindingService });
    assert.ok(migrated.boundVersionIds.includes(version.id));

    // Mutate the template AFTER migration: the bound version must keep its
    // historical bytes (the resolver never reads templates for bound rows —
    // that independence is proven end-to-end in lesson-play-cutover.test.ts).
    await db.update(schema.templates).set({ htmlPlayer: "<html>CHANGED TEMPLATE</html>" }).where(eq(schema.templates.id, t1.id));

    const identity = canonicalizePackage({ files: { "index.html": html }, capabilities: ["lesson-data"] }).identity;
    const resolved = await bindingService.resolveLessonVersionRuntime(version.id);
    assert.equal(resolved.mode, "bound");
    if (resolved.mode !== "bound") return;
    assert.equal(resolved.runtimeIdentity, identity);

    const [asset] = await db
      .select({
        objectKey: schema.runtimeStorageLocations.objectKey,
        sha256: schema.runtimeStorageObjects.contentSha256,
        entryPoint: schema.runtimeVersions.entryPoint,
      })
      .from(schema.runtimeVersions)
      .innerJoin(schema.runtimeAssets, eq(schema.runtimeAssets.runtimeVersionId, schema.runtimeVersions.id))
      .innerJoin(schema.runtimeStorageObjects, eq(schema.runtimeStorageObjects.id, schema.runtimeAssets.storageObjectId))
      .innerJoin(schema.runtimeStorageLocations, eq(schema.runtimeStorageLocations.storageObjectId, schema.runtimeStorageObjects.id))
      .where(eq(schema.runtimeVersions.identity, identity))
      .limit(1);
    assert.equal(asset.objectKey, `runtime/${identity}/${asset.sha256}`, "content-addressed final key");
    const stored = await fake.store.get(asset.objectKey);
    assert.equal(stored.toString("utf8"), html, "stored bytes are the historical player, not the mutated template");
    assert.equal(createHash("sha256").update(stored).digest("hex"), asset.sha256, "stored bytes match the recorded SHA-256");
    assert.equal(asset.entryPoint, "index.html");
  });
});
