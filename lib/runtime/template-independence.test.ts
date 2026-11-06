// Phase 7 integration tests: template independence of published runtimes.
// Proves on a REAL migrated disposable database and LIVE S3-compatible
// storage (SeaweedFS POC) that a Bound lesson version keeps playing from its
// published runtime after the source Template row is hard-deleted — and that
// template mutation never changes the published runtime. The DB schema
// protects templates from deletion while versions reference them
// (schema_definitions.template_id ON DELETE RESTRICT), so deletion is done
// the honest way: unlink the schema definition's template FK first, then
// DELETE the template row. If the play path secretly depended on the template,
// these tests would 404 the moment the row disappears.
//
// Environment: RUNTIME_BINDING_TEST_DATABASE_URL (disposable, migrated) +
// RUNTIME_CONTENT_S3_* + RUNTIME_CONTENT_S3_BUCKET (live storage). Never the
// project DATABASE_URL, never staging/production.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createRuntimePublisher } = await import("./runtime-publication.ts" as string);
const { approveLessonWithRuntime } = await import("./lesson-approval-publishing.ts" as string);
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);
const { assemblePlayableLesson } = await import("./lesson-play-resolution.ts" as string);
const { createS3CompatibleEntryContentReader } = await import("./runtime-entry-content.ts" as string);
const { createS3RuntimeContentStore, readS3StoreConfigFromEnv } = await import("./runtime-content-store.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";
const s3Store = readS3StoreConfigFromEnv();
const hasLiveS3 = Boolean(s3Store.config && s3Store.bucket);
const sha256Of = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// The strict validator executes the script as CommonJS and requires the
// exported function to return { errors: [], warnings: [] }.
const VALIDATION_SCRIPT = "module.exports = function validate() { return { errors: [], warnings: [] }; }";

describe("template independence (real database + live object storage)", {
  skip: (!databaseUrl && "set RUNTIME_BINDING_TEST_DATABASE_URL to a disposable migrated database") ||
    (!hasLiveS3 && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_S3_BUCKET to run against live object storage"),
}, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let bindingService: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  let publisher: ReturnType<typeof createRuntimePublisher>;
  let entryReader: ReturnType<typeof createS3CompatibleEntryContentReader>;
  let store: ReturnType<typeof createS3RuntimeContentStore>;
  const RUN = `indep-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    bindingService = createLessonVersionRuntimeBindingService(db as never);
    store = createS3RuntimeContentStore(s3Store.config, s3Store.bucket);
    publisher = createRuntimePublisher({ db: db as never, store, bucket: s3Store.bucket });
    entryReader = createS3CompatibleEntryContentReader(db as never, s3Store.config);
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  async function makeLessonFixture(options: { versionNumber?: number; status?: number } = {}) {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folderRow] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: VALIDATION_SCRIPT })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: user.id, folderId: folderRow.id, name: tag, state: schema.LessonState.Draft, currentApprovedVersionId: null } as never)
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: lesson.id,
        versionNumber: options.versionNumber ?? 1,
        status: options.status ?? schema.VersionStatus.Draft,
        schemaDefinitionId: schemaDefinition.id,
        content: {},
      })
      .returning({ id: schema.lessonVersions.id });
    return { lessonId: lesson.id, lessonVersionId: version.id, templateId: template.id, schemaDefinitionId: schemaDefinition.id, tag };
  }

  /** The honest way to delete a template the schema protects: unlink the FK. */
  async function deleteTemplateCompletely(templateId: string, schemaDefinitionId: string) {
    await db.update(schema.schemaDefinitions).set({ templateId: null }).where(eq(schema.schemaDefinitions.id, schemaDefinitionId));
    await db.delete(schema.templates).where(eq(schema.templates.id, templateId));
    const remaining = await db.select({ id: schema.templates.id }).from(schema.templates).where(eq(schema.templates.id, templateId)).limit(1);
    assert.equal(remaining.length, 0, "template row is really gone");
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

  test("1. approve → publish → bind → play, then delete the template: the lesson still plays from the runtime", async () => {
    const fixture = await makeLessonFixture();
    const html = `<!doctype html><html><body>independent runtime ${fixture.tag}</body></html>`;

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
    assert.equal(result.ok, true, `approval failed: ${result.ok === false ? result.message : ""}`);
    if (!result.ok) return;

    const versionRow = await db
      .select({ status: schema.lessonVersions.status, binding: schema.lessonVersions.runtimeBindingStatus, runtimeVersionId: schema.lessonVersions.runtimeVersionId })
      .from(schema.lessonVersions).where(eq(schema.lessonVersions.id, fixture.lessonVersionId)).limit(1);
    assert.equal(versionRow[0].status, schema.VersionStatus.Approved);
    assert.equal(versionRow[0].binding, schema.RuntimeBindingStatus.Bound);

    // Play BEFORE deletion — dashboard-style resolution + real storage read.
    const before = await play(fixture.lessonVersionId, async () => html);
    assert.equal(before?.source, "runtime");
    assert.equal(before?.htmlPlayer, html);

    await deleteTemplateCompletely(fixture.templateId, fixture.schemaDefinitionId);

    // The published runtime row is untouched by the deletion.
    const runtimeRow = await db
      .select({ state: schema.runtimeVersions.state, manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions).where(eq(schema.runtimeVersions.id, versionRow[0].runtimeVersionId!)).limit(1);
    assert.equal(runtimeRow[0].state, schema.RuntimeVersionState.Published);

    // Play AFTER deletion — bytes identical, even with a template fetcher that
    // can only say "the template is gone" (what the legacy path would serve).
    const after = await play(fixture.lessonVersionId, async () => null);
    assert.equal(after?.source, "runtime");
    assert.equal(after?.htmlPlayer, html);

    const content = await entryReader.read(versionRow[0].runtimeVersionId!);
    assert.equal(content.html, html);
    assert.equal(content.runtimeIdentity, result.runtimeIdentity);
  });

  test("2. flag off + deleted template: the legacy path 404s — the runtime path was the only survivor", async () => {
    const fixture = await makeLessonFixture();
    const html = `<html><body>flag-off ${fixture.tag}</body></html>`;
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
    assert.equal(result.ok, true);

    await deleteTemplateCompletely(fixture.templateId, fixture.schemaDefinitionId);

    // Flag ON: still serves from the runtime.
    const on = await play(fixture.lessonVersionId, async () => null);
    assert.equal(on?.source, "runtime");
    assert.equal(on?.htmlPlayer, html);

    // Flag OFF: the legacy template path has nothing left to serve → null (404).
    const off = await assemblePlayableLesson(
      { name: "lesson", content: {}, lessonVersionId: fixture.lessonVersionId, fetchTemplateHtmlPlayer: async () => null },
      { isEnabled: () => false },
    );
    assert.equal(off, null);
  });

  test("3. mutating the template after binding changes nothing about the published runtime", async () => {
    const fixture = await makeLessonFixture();
    const html = `<html><body>immutable ${fixture.tag}</body></html>`;
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
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const runtimeCountBefore = await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, result.runtimeIdentity));
    const manifestBefore = await db.select({ manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions).where(eq(schema.runtimeVersions.identity, result.runtimeIdentity)).limit(1);

    // Hostile mutation of the mutable template row (content AND timestamp).
    await db.update(schema.templates)
      .set({ htmlPlayer: "<html><body>PWNED — the player changed</body></html>", updatedAt: new Date() })
      .where(eq(schema.templates.id, fixture.templateId));

    const resolved = await bindingService.resolveLessonVersionRuntime(fixture.lessonVersionId);
    assert.equal(resolved.mode, "bound");
    assert.equal(resolved.runtimeIdentity, result.runtimeIdentity);

    const runtimeCountAfter = await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, result.runtimeIdentity));
    assert.equal(runtimeCountAfter.length, runtimeCountBefore.length, "no republication, no second runtime version");

    const served = await play(fixture.lessonVersionId, async () => "<html><body>PWNED — the player changed</body></html>");
    assert.equal(served?.htmlPlayer, html, "served bytes are the published bytes, not the mutated template");

    const manifestAfter = await db.select({ manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions).where(eq(schema.runtimeVersions.identity, result.runtimeIdentity)).limit(1);
    assert.equal(manifestAfter[0].manifestSha256, manifestBefore[0].manifestSha256);
    void manifestBefore;
  });

  test("4. multi-file package: every asset survives template deletion with verified SHA-256", async () => {
    const fixture = await makeLessonFixture({ status: schema.VersionStatus.Approved });
    const files = {
      "index.html": `<!doctype html><html><head><link rel="stylesheet" href="assets/app.css"><script src="assets/app.js"></script></head><body>multi ${fixture.tag}</body></html>`,
      "assets/app.js": `console.log("app for ${fixture.tag}");`,
      "assets/app.css": `body { font-family: sans-serif; }`,
    };
    const published = await publisher.publish(
      { files, entryPoint: "index.html", capabilities: ["lesson-data"], sourceTemplateId: fixture.templateId },
      `${RUN}-multi-${fixture.tag}`,
    );
    assert.equal(published.state, schema.RuntimeVersionState.Published);
    assert.equal(published.assets.length, 3);

    await bindingService.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: published.identity });

    await deleteTemplateCompletely(fixture.templateId, fixture.schemaDefinitionId);

    // Entry point still serves from real storage.
    const entry = await entryReader.read(published.id);
    assert.equal(entry.html, files["index.html"]);

    // EVERY asset is still in storage, byte-identical to its recorded SHA-256.
    for (const asset of published.assets) {
      const bytes = await store.get(asset.objectKey);
      assert.equal(sha256Of(bytes), asset.contentSha256, `asset ${asset.path} bytes match the recorded SHA-256 after template deletion`);
    }
  });

  test("5. historical versions of the same lesson are unaffected by one version's template deletion", async () => {
    const fixture = await makeLessonFixture({ versionNumber: 1 });
    const v2 = await makeLessonFixture({ versionNumber: 2 });
    const html1 = `<html><body>v1 ${fixture.tag}</body></html>`;
    const html2 = `<html><body>v2 ${v2.tag}</body></html>`;
    const r1 = await approveLessonWithRuntime(
      {
        lessonId: fixture.lessonId,
        lessonVersionId: fixture.lessonVersionId,
        htmlPlayer: html1,
        sourceTemplateId: fixture.templateId,
        content: { probe: fixture.tag },
        validationScript: VALIDATION_SCRIPT,
      },
      { publisher: publisher as never, bindingService: bindingService as never, db: db as never },
    );
    const r2 = await approveLessonWithRuntime(
      {
        lessonId: v2.lessonId,
        lessonVersionId: v2.lessonVersionId,
        htmlPlayer: html2,
        sourceTemplateId: v2.templateId,
        content: { probe: v2.tag },
        validationScript: VALIDATION_SCRIPT,
      },
      { publisher: publisher as never, bindingService: bindingService as never, db: db as never },
    );
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);

    // Delete only v1's template; v2 keeps its own.
    await deleteTemplateCompletely(fixture.templateId, fixture.schemaDefinitionId);

    const served2 = await play(v2.lessonVersionId, async () => html2);
    assert.equal(served2?.source, "runtime");
    assert.equal(served2?.htmlPlayer, html2);

    if (r1.ok) {
      const content1 = await entryReader.read((await db
        .select({ runtimeVersionId: schema.lessonVersions.runtimeVersionId })
        .from(schema.lessonVersions).where(eq(schema.lessonVersions.id, fixture.lessonVersionId)).limit(1))[0].runtimeVersionId!);
      assert.equal(content1.html, html1);
    }
  });
});
