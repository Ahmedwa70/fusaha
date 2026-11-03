// Phase 4 controlled-cutover integration tests on a REAL migrated database
// (same disposable-database contract as lesson-version-runtime-binding.test.ts:
// RUNTIME_BINDING_TEST_DATABASE_URL). Proves, against the production schema
// and the central binding service (no faked resolution decisions):
//   - a Bound version serves runtime entry bytes even after its template row is
//     mutated underneath it (no mutable-template dependency),
//   - Unbound historical versions take the explicit template fallback,
//   - Quarantined/Unrecoverable fail closed even though a template exists,
//   - disabling the flag rolls every path back to the template instantly.
// The last test exercises the real S3-compatible reader against live object
// storage when RUNTIME_CONTENT_S3_* variables are provided (otherwise it skips).

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);
const { assemblePlayableLesson } = await import("./lesson-play-resolution.ts" as string);
const { isRuntimeResolverCutoverEnabled } = await import("./runtime-resolver-flag.ts" as string);
const { createS3CompatibleEntryContentReader } = await import("./runtime-entry-content.ts" as string);

const databaseUrl = process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";

describe("phase-4 cutover (real database)", { skip: !databaseUrl && "set RUNTIME_BINDING_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let bindingService: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  const RUN = `cut-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 4 });
    db = drizzle(client, { schema });
    bindingService = createLessonVersionRuntimeBindingService(db as never);
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  const hex64 = () => (randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")).slice(0, 64);
  const identityOf = () => `sha256-v1-${hex64()}`;

  async function insertRuntime(identity: string, state: number) {
    const [row] = await db.insert(schema.runtimeVersions)
      .values({ identity, identityAlgorithm: "runtime-package/v1", state, packageKind: 0, entryPoint: "index.html", manifest: { entryPoint: "index.html" }, manifestSha256: hex64(), assetCount: 1, packageSizeBytes: 64 } as never)
      .returning({ id: schema.runtimeVersions.id });
    return row;
  }

  async function makeApprovedLessonVersion() {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db.insert(schema.users).values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never).returning({ id: schema.users.id });
    const [folder] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db.insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><head></head><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: "return true" })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db.insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db.insert(schema.lessons).values({ ownerId: user.id, folderId: folder.id, name: tag }).returning({ id: schema.lessons.id });
    const [version] = await db.insert(schema.lessonVersions)
      .values({ lessonId: lesson.id, versionNumber: 1, status: schema.VersionStatus.Approved, schemaDefinitionId: schemaDefinition.id, content: {} })
      .returning({ id: schema.lessonVersions.id });
    return { lessonVersionId: version.id, templateId: template.id, tag };
  }

  const runtimeReader = (html: string) => async () => ({ html });

  function templateFetcher(templateId: string) {
    return async () => {
      const rows = await db.select({ htmlPlayer: schema.templates.htmlPlayer }).from(schema.templates).where(eq(schema.templates.id, templateId)).limit(1);
      return rows[0]?.htmlPlayer ?? null;
    };
  }

  test("1. bound version serves runtime bytes and ignores a mutated template", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = identityOf();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await bindingService.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });

    const on = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: runtimeReader("<immutable-runtime-html>") }
    );
    assert.equal(on?.source, "runtime");
    assert.equal(on?.htmlPlayer, "<immutable-runtime-html>");

    // Mutate the template AFTER binding — the bound version must not change.
    await db.update(schema.templates).set({ htmlPlayer: "<mutated-template-html>" }).where(eq(schema.templates.id, fixture.templateId));
    const afterMutation = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: runtimeReader("<immutable-runtime-html>") }
    );
    assert.equal(afterMutation?.htmlPlayer, "<immutable-runtime-html>");

    // The fallback fetcher itself is never consulted for the bound version.
    let fallbackCalled = false;
    const noFallback = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: async () => { fallbackCalled = true; return "<template>"; } },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: runtimeReader("<immutable-runtime-html>") }
    );
    assert.equal(noFallback?.source, "runtime");
    assert.equal(fallbackCalled, false);
  });

  test("2. unbound historical version uses the explicit template fallback", async () => {
    const fixture = await makeApprovedLessonVersion();
    const resolved = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: async () => { throw new Error("reader must not run for unbound"); } }
    );
    assert.equal(resolved?.source, "template");
    assert.match(resolved?.htmlPlayer ?? "", /template:/);
  });

  test("3. quarantined version fails closed even though a template exists", async () => {
    const fixture = await makeApprovedLessonVersion();
    await bindingService.quarantineLessonVersion({ lessonVersionId: fixture.lessonVersionId, reason: "verification failed" });
    const resolved = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: async () => ({ html: "<runtime>" }) }
    );
    assert.equal(resolved, null);
  });

  test("4. unrecoverable version fails closed", async () => {
    const fixture = await makeApprovedLessonVersion();
    await bindingService.markLessonVersionUnrecoverable({ lessonVersionId: fixture.lessonVersionId, reason: "source content lost" });
    const resolved = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: async () => ({ html: "<runtime>" }) }
    );
    assert.equal(resolved, null);
  });

  test("5. legacy-bound version serves its legacy runtime snapshot", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = identityOf();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await bindingService.markLessonVersionLegacyRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity, reason: "approved legacy snapshot" });
    const resolved = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: runtimeReader("<legacy-snapshot-html>") }
    );
    assert.equal(resolved?.source, "runtime");
    assert.equal(resolved?.htmlPlayer, "<legacy-snapshot-html>");
  });

  test("6. rollback: same bound version returns to the template when the flag is off", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = identityOf();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await bindingService.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });

    // Rollback must not alter the stored binding — only the decision changes.
    const off = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(fixture.templateId) },
      { isEnabled: () => false }
    );
    assert.equal(off?.source, "template");
    assert.match(off?.htmlPlayer ?? "", /template:/);

    const row = await db.select({ status: schema.lessonVersions.runtimeBindingStatus, runtimeVersionId: schema.lessonVersions.runtimeVersionId })
      .from(schema.lessonVersions).where(eq(schema.lessonVersions.id, fixture.lessonVersionId)).limit(1);
    assert.equal(row[0].status, schema.RuntimeBindingStatus.Bound); // binding untouched by rollback
  });

  test("7. dashboard-style scoping keeps bindings isolated per version", async () => {
    const a = await makeApprovedLessonVersion();
    const b = await makeApprovedLessonVersion();
    const identityA = identityOf();
    const identityB = identityOf();
    await insertRuntime(identityA, schema.RuntimeVersionState.Published);
    await insertRuntime(identityB, schema.RuntimeVersionState.Published);
    await bindingService.bindLessonVersionRuntime({ lessonVersionId: a.lessonVersionId, runtimeIdentity: identityA });
    await bindingService.bindLessonVersionRuntime({ lessonVersionId: b.lessonVersionId, runtimeIdentity: identityB });

    const readA = runtimeReader("<runtime-A>");
    const readB = runtimeReader("<runtime-B>");
    const resolvedA = await assemblePlayableLesson(
      { name: "a", content: {}, lessonVersionId: a.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(a.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: readA }
    );
    const resolvedB = await assemblePlayableLesson(
      { name: "b", content: {}, lessonVersionId: b.lessonVersionId, fetchTemplateHtmlPlayer: templateFetcher(b.templateId) },
      { isEnabled: () => true, resolveRuntime: (id: string) => bindingService.resolveLessonVersionRuntime(id), readRuntimeEntry: readB }
    );
    assert.equal(resolvedA?.htmlPlayer, "<runtime-A>");
    assert.equal(resolvedB?.htmlPlayer, "<runtime-B>");
  });

  const s3Config = {
    endpoint: process.env.RUNTIME_CONTENT_S3_ENDPOINT ?? "",
    accessKey: process.env.RUNTIME_CONTENT_S3_ACCESS_KEY ?? "",
    secretKey: process.env.RUNTIME_CONTENT_S3_SECRET_KEY ?? "",
  };
  const e2eBucket = process.env.RUNTIME_CONTENT_TEST_BUCKET ?? "";
  const e2eObjectKey = process.env.RUNTIME_CONTENT_TEST_OBJECT_KEY ?? "";
  const e2eSha256 = process.env.RUNTIME_CONTENT_TEST_SHA256 ?? "";
  const hasS3E2E = Boolean(s3Config.endpoint && s3Config.accessKey && s3Config.secretKey && e2eBucket && e2eObjectKey && e2eSha256);

  test("8. S3-compatible reader fetches and verifies real bytes from object storage", { skip: !hasS3E2E && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_TEST_* to run against live object storage" }, async () => {
    const identity = identityOf();
    // Re-runnable on the same disposable database: clear any prior fixture rows
    // for this object key before inserting (unique(provider, bucket, object_key)).
    await db.delete(schema.runtimeStorageLocations).where(eq(schema.runtimeStorageLocations.objectKey, e2eObjectKey));
    const [runtime] = await db.insert(schema.runtimeVersions)
      .values({ identity, identityAlgorithm: "runtime-package/v1", state: schema.RuntimeVersionState.Published, packageKind: 0, entryPoint: "index.html", manifest: { entryPoint: "index.html" }, manifestSha256: hex64(), assetCount: 1, packageSizeBytes: 0 } as never)
      .returning({ id: schema.runtimeVersions.id });
    const [object] = await db.insert(schema.runtimeStorageObjects)
      .values({ contentSha256: e2eSha256, sizeBytes: 0, contentType: "text/html", state: schema.RuntimeStorageObjectState.Available } as never)
      .returning({ id: schema.runtimeStorageObjects.id });
    await db.insert(schema.runtimeAssets)
      .values({ runtimeVersionId: runtime.id, storageObjectId: object.id, path: "index.html", contentSha256: e2eSha256, sizeBytes: 0, contentType: "text/html" } as never);
    await db.insert(schema.runtimeStorageLocations)
      .values({ storageObjectId: object.id, provider: "s3-compatible", bucket: e2eBucket, objectKey: e2eObjectKey, isPrimary: true } as never);

    const reader = createS3CompatibleEntryContentReader(db as never, s3Config);
    const content = await reader.read(runtime.id);
    assert.match(content.html, /<html|./);
    assert.equal(content.sha256, e2eSha256);
    assert.equal(content.runtimeIdentity, identity);
    assert.equal(content.entryPoint, "index.html");
    // The default env-driven flag helper agrees the e2e config shape is valid.
    assert.equal(isRuntimeResolverCutoverEnabled({ RUNTIME_RESOLVER_CUTOVER_ENABLED: "true" } as never), true);
    assert.equal(isRuntimeResolverCutoverEnabled({} as never), false);
  });
});
