// D-series integration tests: full lesson/template/runtime independence.
// Runs on REAL fusaha-staging (synthetic tagged rows only — nothing
// pre-existing is touched) + LIVE SeaweedFS. Covers:
//   T1  Runtime dedupe: two lessons with identical content share ONE
//       runtime_versions row (SHA-256 identity, DB-unique), both Bound.
//   T2  retireSchemaDefinition: versions rebound to the sentinel, schema row
//       deleted, play bytes identical, SHA-256 chain verified end-to-end.
//   T3  retireTemplate: schemas unlinked (non-pickable), template deleted,
//       play bytes identical, runtime_versions.source_template_id = NULL.
//   T4  FK RESTRICT: deleting a referenced runtime_versions row is refused.
//   T5  Wizard picker: retired fixtures + sentinel absent from pickable list.
//   T6  createLesson gate: inactive schema / inactive template rejected.
//
// Environment: RUNTIME_PUBLICATION_TEST_DATABASE_URL (must be Staging) +
// RUNTIME_CONTENT_S3_* (SeaweedFS POC). Never Production.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";

register(new URL("./retire-independence.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createRuntimePublisher } = await import("./runtime-publication.ts" as string);
const { approveLessonWithRuntime } = await import("./lesson-approval-publishing.ts" as string);
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);
const { assemblePlayableLesson } = await import("./lesson-play-resolution.ts" as string);
const { createS3CompatibleEntryContentReader } = await import("./runtime-entry-content.ts" as string);
const { createS3RuntimeContentStore, readS3StoreConfigFromEnv } = await import("./runtime-content-store.ts" as string);
const { isPickableSchemaDefinition } = await import("../lesson-levels.ts" as string);
const { setInjectedDb } = await import("./retire-test-db-stub.mjs");
const { setActor } = await import("./retire-test-auth-stub.mjs");
const { setGenerationCostHook } = await import("./retire-test-stubs.mjs");
const { retireSchemaDefinition } = await import("../../actions/schema-definitions.ts" as string);
const { retireTemplate } = await import("../../actions/templates.ts" as string);
const { createLesson } = await import("../../actions/generation.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? "";
const s3Store = readS3StoreConfigFromEnv();
const hasLiveS3 = Boolean(s3Store.config && s3Store.bucket);
const sha256Of = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const EVIDENCE_DIR = "/tmp/fusaha-e2e/retire-evidence";
// The strict validator executes the script as CommonJS and calls the exported
// function with the version content; it must return { errors: [] } to pass.
const VALIDATION_SCRIPT = "module.exports = function validate() { return { errors: [], warnings: [] }; }";

function evidence(name: string, data: unknown): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(
    `${EVIDENCE_DIR}/${name}.json`,
    JSON.stringify({ timestamp: new Date().toISOString(), ...((data ?? {}) as object) }, null, 2),
  );
}

describe("retire independence (fusaha-staging + SeaweedFS)", {
  skip: (!databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to fusaha-staging") ||
    (!hasLiveS3 && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_S3_BUCKET to the SeaweedFS POC"),
}, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let bindingService: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  let publisher: ReturnType<typeof createRuntimePublisher>;
  let entryReader: ReturnType<typeof createS3CompatibleEntryContentReader>;
  let store: ReturnType<typeof createS3RuntimeContentStore>;
  let sentinelId = "";
  let actor: { id: string };
  let retiredSchemaDefinitionId = "";
  let unlinkedSchemaDefinitionId = "";
  const RUN = `retire-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    setInjectedDb(db as never);
    bindingService = createLessonVersionRuntimeBindingService(db as never);
    store = createS3RuntimeContentStore(s3Store.config, s3Store.bucket);
    publisher = createRuntimePublisher({ db: db as never, store, bucket: s3Store.bucket });
    entryReader = createS3CompatibleEntryContentReader(db as never, s3Store.config);

    // Synthetic actor for the audit rows the retire actions write.
    const [role] = await db
      .insert(schema.roles)
      .values({ name: `${RUN}-actor-role`, title: `${RUN} actor role` })
      .returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${RUN}-actor@example.test`, name: `${RUN}-actor`, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    actor = user;
    setActor(user);

    // The D1 sentinel must already exist (created by sentinel-ensure.mjs).
    const [sentinel] = await db
      .select({ id: schema.schemaDefinitions.id, levelKey: schema.schemaDefinitions.levelKey })
      .from(schema.schemaDefinitions)
      .where(eq(schema.schemaDefinitions.levelKey, "retired"))
      .limit(1);
    assert.ok(sentinel, "D1 sentinel row (level_key='retired') must exist on Staging");
    sentinelId = sentinel.id;

    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  async function makeFixture(options: { active?: boolean } = {}) {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const active = options.active ?? false;
    const [role] = await db
      .insert(schema.roles)
      .values({ name: `${tag}-role`, title: `${tag} role` })
      .returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folderRow] = await db
      .insert(schema.folders)
      .values({ ownerId: user.id, name: tag })
      .returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: VALIDATION_SCRIPT, active })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id, active } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: user.id, folderId: folderRow.id, name: tag, state: schema.LessonState.Draft, currentApprovedVersionId: null } as never)
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: lesson.id,
        versionNumber: 1,
        status: schema.VersionStatus.Draft,
        schemaDefinitionId: schemaDefinition.id,
        content: {},
      })
      .returning({ id: schema.lessonVersions.id });
    return { lessonId: lesson.id, lessonVersionId: version.id, templateId: template.id, schemaDefinitionId: schemaDefinition.id, tag };
  }

  async function approve(fixture: { lessonId: string; lessonVersionId: string; templateId: string; tag: string }, html: string) {
    const result = await approveLessonWithRuntime(
      {
        lessonId: fixture.lessonId,
        lessonVersionId: fixture.lessonVersionId,
        htmlPlayer: html,
        sourceTemplateId: fixture.templateId,
        content: { probe: fixture.tag },
        validationScript: VALIDATION_SCRIPT,
      },
      { publisher: publisher as never, bindingService: bindingService as never, db: db as never },
    );
    assert.equal(result.ok, true, `approval failed for ${fixture.tag}: ${result.ok === false ? result.message : ""}`);
    return result;
  }

  async function play(lessonVersionId: string, fetchTemplateHtmlPlayer: () => Promise<string | null>) {
    return assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId, fetchTemplateHtmlPlayer },
      {
        isEnabled: () => true,
        resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id),
        readRuntimeEntry: async (runtimeVersionId: string) => {
          const content = await entryReader.read(runtimeVersionId);
          return { html: content.html };
        },
      },
    );
  }

  async function runtimeRowOf(lessonVersionId: string) {
    const [row] = await db
      .select({
        runtimeVersionId: schema.lessonVersions.runtimeVersionId,
        binding: schema.lessonVersions.runtimeBindingStatus,
        status: schema.lessonVersions.status,
      })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, lessonVersionId))
      .limit(1);
    return row;
  }

  /** Play bytes → runtime_assets SHA-256 → storage object → live S3 bytes. */
  async function verifyShaChain(runtimeVersionId: string, expectedHtml: string) {
    const playedSha = sha256Of(expectedHtml);
    const assets = await db
      .select({
        path: schema.runtimeAssets.path,
        contentSha256: schema.runtimeAssets.contentSha256,
        storageObjectId: schema.runtimeAssets.storageObjectId,
      })
      .from(schema.runtimeAssets)
      .where(eq(schema.runtimeAssets.runtimeVersionId, runtimeVersionId));
    assert.ok(assets.length > 0, "runtime has recorded assets");
    const entry = assets.find((a) => a.contentSha256 === playedSha);
    assert.ok(entry, `played bytes SHA-256 ${playedSha} matches a recorded asset`);
    const [object] = await db
      .select({ contentSha256: schema.runtimeStorageObjects.contentSha256 })
      .from(schema.runtimeStorageObjects)
      .where(eq(schema.runtimeStorageObjects.id, entry.storageObjectId))
      .limit(1);
    assert.equal(object.contentSha256, playedSha, "storage object SHA-256 matches played bytes");
    const [location] = await db
      .select({ objectKey: schema.runtimeStorageLocations.objectKey, bucket: schema.runtimeStorageLocations.bucket })
      .from(schema.runtimeStorageLocations)
      .where(eq(schema.runtimeStorageLocations.storageObjectId, entry.storageObjectId))
      .limit(1);
    const liveBytes = await store.get(location.objectKey);
    assert.equal(sha256Of(liveBytes), playedSha, `live S3 bytes at ${location.bucket}/${location.objectKey} hash-match`);
    return { playedSha, objectKey: location.objectKey, assetPath: entry.path, assetCount: assets.length };
  }

  test("T1: two lessons with identical content share ONE runtime version (dedupe)", async () => {
    const a = await makeFixture();
    const b = await makeFixture();
    const html = `<!doctype html><html><body>shared runtime ${RUN}</body></html>`;

    const ra = await approve(a, html);
    const rb = await approve(b, html);
    if (!ra.ok || !rb.ok) return;
    assert.equal(ra.runtimeIdentity, rb.runtimeIdentity, "identical content ⇒ identical SHA-256 identity");

    const versions = await db
      .select({ id: schema.runtimeVersions.id, identity: schema.runtimeVersions.identity, state: schema.runtimeVersions.state })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, ra.runtimeIdentity));
    assert.equal(versions.length, 1, "exactly one runtime_versions row for the shared identity");

    const va = await runtimeRowOf(a.lessonVersionId);
    const vb = await runtimeRowOf(b.lessonVersionId);
    assert.equal(va.binding, schema.RuntimeBindingStatus.Bound);
    assert.equal(vb.binding, schema.RuntimeBindingStatus.Bound);
    assert.equal(va.runtimeVersionId, versions[0].id);
    assert.equal(vb.runtimeVersionId, versions[0].id, "both lessons Bound to the same single runtime row");
    assert.equal(versions[0].state, schema.RuntimeVersionState.Published);

    evidence("T1-dedupe", {
      identity: ra.runtimeIdentity,
      runtimeVersionsWithIdentity: versions.length,
      lessonA: a.lessonVersionId,
      lessonB: b.lessonVersionId,
      sharedRuntimeVersionId: versions[0].id,
    });
  });

  test("T2: retireSchemaDefinition rebinds history to the sentinel; play bytes unchanged", async () => {
    const fixture = await makeFixture({ active: true });
    const html = `<!doctype html><html><body>retire-schema ${fixture.tag}</body></html>`;
    const result = await approve(fixture, html);
    if (!result.ok) return;

    const before = await play(fixture.lessonVersionId, async () => html);
    assert.equal(before?.source, "runtime");
    assert.equal(before?.htmlPlayer, html);

    const [runtimeBefore] = await db
      .select({ id: schema.runtimeVersions.id, state: schema.runtimeVersions.state, manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, result.runtimeIdentity))
      .limit(1);

    const retired = await retireSchemaDefinition(fixture.schemaDefinitionId);
    assert.deepEqual(retired, { success: true }, "retireSchemaDefinition succeeds for a fully-Bound schema");
    retiredSchemaDefinitionId = fixture.schemaDefinitionId;

    const [schemaAfter] = await db
      .select({ id: schema.schemaDefinitions.id })
      .from(schema.schemaDefinitions)
      .where(eq(schema.schemaDefinitions.id, fixture.schemaDefinitionId))
      .limit(1);
    assert.equal(schemaAfter, undefined, "schema row is deleted");

    const [versionAfter] = await db
      .select({ schemaDefinitionId: schema.lessonVersions.schemaDefinitionId, binding: schema.lessonVersions.runtimeBindingStatus })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, fixture.lessonVersionId))
      .limit(1);
    assert.equal(versionAfter.schemaDefinitionId, sentinelId, "lesson version rebound to the D1 sentinel");
    assert.equal(versionAfter.binding, schema.RuntimeBindingStatus.Bound, "binding untouched by retire");

    const [runtimeAfter] = await db
      .select({ id: schema.runtimeVersions.id, state: schema.runtimeVersions.state, manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, result.runtimeIdentity))
      .limit(1);
    assert.deepEqual(runtimeAfter, runtimeBefore, "runtime row byte-identical metadata after retire");

    const after = await play(fixture.lessonVersionId, async () => null);
    assert.equal(after?.source, "runtime");
    assert.equal(after?.htmlPlayer, html, "play bytes identical even with the schema+template fetch returning null");

    const chain = await verifyShaChain(runtimeAfter.id, html);

    const [auditRow] = await db
      .select({ action: schema.auditLogs.action, resourceId: schema.auditLogs.resourceId, newValues: schema.auditLogs.newValues })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, `${fixture.tag}/v1`))
      .limit(1);
    assert.ok(auditRow, "retire recorded in audit_logs");
    assert.equal((auditRow.newValues as { retired?: boolean })?.retired, true);

    evidence("T2-retire-schema", {
      schemaDefinitionId: fixture.schemaDefinitionId,
      sentinelId,
      lessonVersionId: fixture.lessonVersionId,
      runtimeVersionId: runtimeAfter.id,
      audit: { action: auditRow.action, resourceId: auditRow.resourceId },
      ...chain,
    });
  });

  test("T3: retireTemplate unlinks schemas and deletes the template; play bytes unchanged", async () => {
    const fixture = await makeFixture({ active: true });
    const html = `<!doctype html><html><body>retire-template ${fixture.tag}</body></html>`;
    const result = await approve(fixture, html);
    if (!result.ok) return;

    const before = await play(fixture.lessonVersionId, async () => html);
    assert.equal(before?.htmlPlayer, html);

    const retired = await retireTemplate(fixture.templateId);
    assert.deepEqual(retired, { success: true }, "retireTemplate succeeds when every linked version is Bound");
    unlinkedSchemaDefinitionId = fixture.schemaDefinitionId;

    const [templateAfter] = await db
      .select({ id: schema.templates.id })
      .from(schema.templates)
      .where(eq(schema.templates.id, fixture.templateId))
      .limit(1);
    assert.equal(templateAfter, undefined, "template row is deleted");

    const [schemaAfter] = await db
      .select({ templateId: schema.schemaDefinitions.templateId })
      .from(schema.schemaDefinitions)
      .where(eq(schema.schemaDefinitions.id, fixture.schemaDefinitionId))
      .limit(1);
    assert.ok(schemaAfter, "schema row survives as history");
    assert.equal(schemaAfter.templateId, null, "schema unlinked (non-pickable) after template retire");

    const [runtimeAfter] = await db
      .select({ sourceTemplateId: schema.runtimeVersions.sourceTemplateId, state: schema.runtimeVersions.state })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, result.runtimeIdentity))
      .limit(1);
    assert.equal(runtimeAfter.sourceTemplateId, null, "runtime historical pointer SET NULL, runtime still Published");
    assert.equal(runtimeAfter.state, schema.RuntimeVersionState.Published);

    const after = await play(fixture.lessonVersionId, async () => null);
    assert.equal(after?.source, "runtime");
    assert.equal(after?.htmlPlayer, html, "play bytes identical after template deletion");

    const chain = await verifyShaChain(
      (await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).where(eq(schema.runtimeVersions.identity, result.runtimeIdentity)).limit(1))[0].id,
      html,
    );

    evidence("T3-retire-template", {
      templateId: fixture.templateId,
      schemaDefinitionId: fixture.schemaDefinitionId,
      lessonVersionId: fixture.lessonVersionId,
      ...chain,
    });
  });

  test("T4: FK RESTRICT refuses deleting a runtime version that lessons are Bound to", async () => {
    const fixture = await makeFixture({ active: true });
    const html = `<html><body>fk-guard ${fixture.tag}</body></html>`;
    const result = await approve(fixture, html);
    if (!result.ok) return;
    const version = await runtimeRowOf(fixture.lessonVersionId);

    let fkError: { code?: string; message?: string; cause?: { code?: string; message?: string } } | null = null;
    try {
      await db.delete(schema.runtimeVersions).where(eq(schema.runtimeVersions.id, version.runtimeVersionId!));
    } catch (error) {
      fkError = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    }
    assert.ok(fkError, "delete must throw");
    assert.ok(
      fkError.code === "23503" ||
        fkError.cause?.code === "23503" ||
        /violates foreign key|foreign key/i.test(fkError.cause?.message ?? fkError.message ?? ""),
      `expected FK violation (23503), got: ${fkError.code ?? fkError.cause?.code ?? fkError.message}`,
    );

    const [runtimeStill] = await db
      .select({ id: schema.runtimeVersions.id })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.id, version.runtimeVersionId!))
      .limit(1);
    assert.ok(runtimeStill, "runtime row survives the attempted delete");

    evidence("T4-fk-restrict", {
      runtimeVersionId: version.runtimeVersionId,
      errorCode: fkError.cause?.code ?? fkError.code ?? null,
    });
  });

  test("T5: retired fixtures, the sentinel, and deactivated-template schemas are absent from the wizard picker", async () => {
    // Replicates getActiveSchemaDefinitions' picker semantics: definition
    // active + linked template active.
    const pickable = await db
      .select({
        id: schema.schemaDefinitions.id,
        levelKey: schema.schemaDefinitions.levelKey,
        templateId: schema.schemaDefinitions.templateId,
        active: schema.schemaDefinitions.active,
        templateActive: schema.templates.active,
      })
      .from(schema.schemaDefinitions)
      .innerJoin(schema.templates, eq(schema.schemaDefinitions.templateId, schema.templates.id))
      .where(and(eq(schema.schemaDefinitions.active, true), eq(schema.templates.active, true)));

    const pickableIds = new Set(pickable.map((row) => row.id));
    assert.ok(!pickableIds.has(sentinelId), "sentinel never pickable");
    assert.ok(!pickableIds.has(retiredSchemaDefinitionId), "T2's retired schema absent from the picker");
    assert.ok(!pickableIds.has(unlinkedSchemaDefinitionId), "T3's unlinked schema absent from the picker");
    for (const row of pickable) {
      assert.equal(isPickableSchemaDefinition(row), true, "every offered row satisfies the pickable predicate");
      assert.equal(row.templateActive, true, "every offered row has an ACTIVE template");
    }

    // Direct probe: deactivate a live template → its schema must drop out.
    const probe = await makeFixture({ active: true });
    await db.update(schema.templates).set({ active: false }).where(eq(schema.templates.id, probe.templateId));
    const pickableAfter = await db
      .select({ id: schema.schemaDefinitions.id })
      .from(schema.schemaDefinitions)
      .innerJoin(schema.templates, eq(schema.schemaDefinitions.templateId, schema.templates.id))
      .where(and(eq(schema.schemaDefinitions.active, true), eq(schema.templates.active, true)));
    const idsAfter = new Set(pickableAfter.map((row) => row.id));
    assert.ok(!idsAfter.has(probe.schemaDefinitionId), "deactivated template's schema leaves the picker immediately");
    assert.ok(idsAfter.has(unlinkedSchemaDefinitionId) === false, "sanity: unlinked schema still absent");

    const [sentinel] = await db
      .select({ active: schema.schemaDefinitions.active, templateId: schema.schemaDefinitions.templateId })
      .from(schema.schemaDefinitions)
      .where(eq(schema.schemaDefinitions.id, sentinelId))
      .limit(1);
    assert.equal(isPickableSchemaDefinition(sentinel), false, "sentinel fails the pickable predicate");

    evidence("T5-picker", {
      pickableCount: pickable.length,
      absent: { sentinel: !pickableIds.has(sentinelId), retiredSchema: !pickableIds.has(retiredSchemaDefinitionId), unlinkedSchema: !pickableIds.has(unlinkedSchemaDefinitionId) },
      deactivatedTemplateProbeAbsent: !idsAfter.has(probe.schemaDefinitionId),
    });
  });

  test("T6: createLesson rejects inactive schema and inactive template, passes the gate for active pairs", async () => {
    // Inactive schema linked to an active template → rejected by the new check.
    const fxInactiveSchema = await makeFixture({ active: true });
    await db.update(schema.schemaDefinitions).set({ active: false }).where(eq(schema.schemaDefinitions.id, fxInactiveSchema.schemaDefinitionId));

    // Active schema linked to an inactive template → rejected by the new check.
    const fxInactiveTemplate = await makeFixture({ active: true });
    await db.update(schema.templates).set({ active: false }).where(eq(schema.templates.id, fxInactiveTemplate.templateId));

    const form = (schemaDefinitionId: string) => {
      const fd = new FormData();
      fd.set("schemaDefinitionId", schemaDefinitionId);
      fd.set("lessonName", `${RUN}-gate`);
      fd.set("sourceKind", "text-write");
      fd.set("text", "hello gate probe");
      return fd;
    };

    const r1 = await createLesson(form(fxInactiveSchema.schemaDefinitionId));
    assert.deepEqual(r1, { error: "invalidLevel" }, "inactive schema rejected at the createLesson gate");

    const r2 = await createLesson(form(fxInactiveTemplate.schemaDefinitionId));
    assert.deepEqual(r2, { error: "invalidLevel" }, "inactive template rejected at the createLesson gate");

    // Control: active schema + active template must PASS the gate. Probe with
    // a generation-cost hook that throws a sentinel — reaching it proves the
    // gate let execution through; the error propagates out of createLesson.
    const fxActive = await makeFixture({ active: true });
    setGenerationCostHook(async () => {
      throw new Error("PAST_GATE");
    });
    let pastGate = false;
    try {
      await createLesson(form(fxActive.schemaDefinitionId));
    } catch (error) {
      pastGate = (error as Error).message === "PAST_GATE";
    } finally {
      setGenerationCostHook(async () => 0);
    }
    assert.equal(pastGate, true, "active schema + active template pass the gate");

    evidence("T6-gate", {
      inactiveSchemaRejected: r1,
      inactiveTemplateRejected: r2,
      controlPassedGate: pastGate,
      fixtures: {
        inactiveSchema: fxInactiveSchema.schemaDefinitionId,
        inactiveTemplate: fxInactiveTemplate.templateId,
        active: fxActive.schemaDefinitionId,
      },
    });
  });
});
