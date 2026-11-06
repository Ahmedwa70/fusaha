// G3 permanent regression tests: the play queries (dashboard + public share)
// must serve a Bound lesson version from its immutable Runtime even when the
// schema_definitions row is hard-deleted, and must fail closed — never fall
// back silently — for an Unbound version whose schema row is gone.
//
// These exercise the REAL query functions (lib/dashboard/queries/lesson.ts)
// through their default wiring: default appDb, default binding service,
// default S3 entry-content reader with live SHA-256 verification. Deleting
// the schema row honestly requires unfastening the FK the schema protects
// (lesson_versions.schema_definition_id NOT NULL + ON DELETE RESTRICT); the
// constraint is restored immediately after each deletion. Because the column
// is NOT NULL, versions whose schema row is deleted are redirected to a
// dedicated inert "sink" schema row (templateId NULL) so the re-added FK
// validates; at play time the leftJoin hits a row with no template, which is
// exactly the production adversarial case (schema row gone / not resolvable).
//
// Environment: RUNTIME_BINDING_TEST_DATABASE_URL (disposable, migrated) +
// RUNTIME_CONTENT_S3_* + RUNTIME_CONTENT_S3_BUCKET (live storage). Never the
// project DATABASE_URL, never staging/production. The cutover flag is set
// process-locally for the cutover assertions only.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-play-queries.test-hooks.mjs", import.meta.url).href);

const databaseUrl = process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";
const { createS3RuntimeContentStore, readS3StoreConfigFromEnv } = await import("../../runtime/runtime-content-store.ts" as string);
const s3Store = readS3StoreConfigFromEnv();
const hasLiveS3 = Boolean(s3Store.config && s3Store.bucket);
const schema = await import("@/database/schema");
const { approveLessonWithRuntime } = await import("../../runtime/lesson-approval-publishing.ts" as string);
const { createLessonVersionRuntimeBindingService } = await import("../../runtime/lesson-version-runtime-binding.ts" as string);
const { createRuntimePublisher } = await import("../../runtime/runtime-publication.ts" as string);
const queries = await import("./lesson.ts" as string);

describe("play queries: bound playback survives schema-definition deletion (G3)", {
  concurrency: false, // deleteSchemaRows unfastens the FK globally; never interleave
  skip: (!databaseUrl && "set RUNTIME_BINDING_TEST_DATABASE_URL to a disposable migrated database") ||
    (!hasLiveS3 && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_S3_BUCKET to run against live object storage"),
}, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const RUN = `g3-${Date.now()}`;
  let sinkSchemaDefinitionId = "";

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    await db.select({ id: schema.lessons.id }).from(schema.lessons).limit(1);
    // Inert sink row: referenced by fixture versions after their real schema
    // row is hard-deleted, so the restored NOT NULL FK stays valid. Its
    // templateId is NULL, so the leftJoin in the play queries behaves exactly
    // as if the schema row were gone.
    const [sink] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: `${RUN}-sink`, level: { en: `${RUN} sink` }, version: "v1", content: "{}", templateId: null } as never)
      .returning({ id: schema.schemaDefinitions.id });
    sinkSchemaDefinitionId = sink.id;
    process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED = "true";
  });

  after(async () => {
    delete process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED;
    if (client) await client.end();
    // The "@/lib/db" stub holds its own pooled client (the play queries use
    // the default appDb); without closing it the runner process stays alive.
    const { closeTestDb } = await import("./lesson-play-queries-db-stub.mjs" as string);
    await closeTestDb();
  });

  async function makeBoundLessonFixture() {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folderRow] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: "return true" })
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
      .values({ lessonId: lesson.id, versionNumber: 1, status: schema.VersionStatus.Draft, schemaDefinitionId: schemaDefinition.id, content: {} })
      .returning({ id: schema.lessonVersions.id });

    const html = `<!doctype html><html><body>g3 runtime ${tag}</body></html>`;
    const store = createS3RuntimeContentStore(s3Store.config, s3Store.bucket);
    const publisher = createRuntimePublisher({ db: db as never, store, bucket: s3Store.bucket });
    const bindingService = createLessonVersionRuntimeBindingService(db as never);
    const result = await approveLessonWithRuntime(
      { lessonId: lesson.id, lessonVersionId: version.id, htmlPlayer: html, sourceTemplateId: template.id, content: { title: tag, steps: ["a", "b"] }, validationScript: "module.exports = function validate() { return { errors: [], warnings: [] }; }" },
      { publisher: publisher as never, bindingService: bindingService as never, db: db as never },
    );
    assert.equal(result.ok, true, `approval failed: ${result.ok === false ? result.message : ""}`);
    if (!result.ok) throw new Error("fixture approval failed");
    return { lessonId: lesson.id, lessonVersionId: version.id, ownerId: user.id, templateId: template.id, schemaDefinitionId: schemaDefinition.id, html, tag };
  }

  /** Honestly delete template + schema-definition rows past the FK guard. */
  async function deleteSchemaRows(templateId: string, schemaDefinitionId: string) {
    const [fk] = await client`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'lesson_versions'::regclass AND contype = 'f'
        AND confrelid = 'schema_definitions'::regclass`;
    assert.ok(fk, "lesson_versions -> schema_definitions FK not found");
    console.log(`[g3] dropping ${fk.conname}`);
    await client.unsafe(`ALTER TABLE lesson_versions DROP CONSTRAINT ${fk.conname}`);
    let restored = false;
    try {
      await db.update(schema.schemaDefinitions).set({ templateId: null }).where(eq(schema.schemaDefinitions.id, schemaDefinitionId));
      await db.delete(schema.templates).where(eq(schema.templates.id, templateId));
      // Redirect the fixture version(s) to the inert sink BEFORE deleting the
      // row, so the re-added NOT NULL FK validates. The play queries then
      // leftJoin to a schemaDefinitions row with templateId NULL — the same
      // code path as a genuinely missing schema row.
      await client.unsafe(
        `UPDATE lesson_versions SET schema_definition_id = '${sinkSchemaDefinitionId}' WHERE schema_definition_id = '${schemaDefinitionId}'`,
      );
      await client.unsafe(`DELETE FROM schema_definitions WHERE id = '${schemaDefinitionId}'`);
      const gone = await client`SELECT 1 FROM schema_definitions WHERE id = ${schemaDefinitionId}`;
      assert.equal(gone.length, 0, "schema_definitions row is really gone");
    } finally {
      await client.unsafe(`ALTER TABLE lesson_versions ADD CONSTRAINT ${fk.conname} ${fk.def}`);
      restored = true;
      console.log(`[g3] re-added ${fk.conname}`);
    }
    assert.ok(restored, "FK must be restored");
  }

  // One sequential test: deleteSchemaRows unfastens the FK globally, so the
  // three scenarios must never interleave. Phases run in order:
  //   1. dashboard play (bound, schema row deleted) → serves runtime bytes
  //   2. public share play (bound, schema row deleted) → serves runtime bytes
  //   3. unbound + schema row deleted → fail closed, flag on AND off
  test("1-3. play queries survive schema-definition deletion (G3), unbound fails closed", async () => {
    // Phase 1 — dashboard.
    const fx1 = await makeBoundLessonFixture();
    await deleteSchemaRows(fx1.templateId, fx1.schemaDefinitionId);
    const dash = await queries.getApprovedLessonForPlay(fx1.ownerId, fx1.lessonId);
    assert.ok(dash, "dashboard play must resolve even with no schema_definitions row");
    assert.equal(dash!.playerSource, "runtime");
    assert.equal(dash!.htmlPlayer, fx1.html, "served bytes are the published runtime bytes");

    // Phase 2 — public share.
    const fx2 = await makeBoundLessonFixture();
    const token = `${fx2.tag}-share`;
    await db.insert(schema.shareLinks).values({ lessonId: fx2.lessonId, token, active: true });
    await deleteSchemaRows(fx2.templateId, fx2.schemaDefinitionId);
    const share = await queries.getApprovedLessonByShareToken(token);
    assert.ok(share, "public share must resolve even with no schema_definitions row");
    assert.equal(share!.playerSource, "runtime");
    assert.equal(share!.htmlPlayer, fx2.html, "served bytes are the published runtime bytes");

    // Phase 3 — unbound + deleted schema rows: fail closed, never silent fallback.
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db.insert(schema.users).values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never).returning({ id: schema.users.id });
    const [folderRow] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: "return true" })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: user.id, folderId: folderRow.id, name: tag, state: schema.LessonState.Approved } as never)
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({ lessonId: lesson.id, versionNumber: 1, status: schema.VersionStatus.Approved, schemaDefinitionId: schemaDefinition.id, content: {} })
      .returning({ id: schema.lessonVersions.id });
    await db.update(schema.lessons).set({ currentApprovedVersionId: version.id }).where(eq(schema.lessons.id, lesson.id));

    await deleteSchemaRows(template.id, schemaDefinition.id);

    const on = await queries.getApprovedLessonForPlay(user.id, lesson.id);
    assert.equal(on, null, "flag ON: unbound + no schema row must fail closed");
    delete process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED;
    const off = await queries.getApprovedLessonForPlay(user.id, lesson.id);
    assert.equal(off, null, "flag OFF: legacy fallback has no template to serve — fail closed, no silent fallback");
    process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED = "true";
  });

  // Production incident regression at the REAL query level: the dashboard
  // play query must serve a Bound version from its immutable runtime with the
  // cutover flag OFF even after retireTemplate has run (schema_definitions.
  // template_id unlinked, template row deleted). Pre-fix the flag-off path
  // served every row from the mutable template and 404'd here.
  test("4. flag OFF + Bound + retired template: play queries serve runtime (dashboard & share)", async () => {
    const fx = await makeBoundLessonFixture();
    const token = `${fx.tag}-retired-share`;
    await db.insert(schema.shareLinks).values({ lessonId: fx.lessonId, token, active: true });

    // retireTemplate's exact database effects, on synthetic fixture rows only.
    await db.update(schema.schemaDefinitions).set({ templateId: null }).where(eq(schema.schemaDefinitions.templateId, fx.templateId));
    await db.delete(schema.templates).where(eq(schema.templates.id, fx.templateId));

    delete process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED; // flag OFF
    try {
      const dash = await queries.getApprovedLessonForPlay(fx.ownerId, fx.lessonId);
      assert.ok(dash, "flag OFF: dashboard play must resolve after the template is retired");
      assert.equal(dash!.playerSource, "runtime");
      assert.equal(dash!.htmlPlayer, fx.html, "served bytes are the published runtime bytes");

      const share = await queries.getApprovedLessonByShareToken(token);
      assert.ok(share, "flag OFF: share play must resolve after the template is retired");
      assert.equal(share!.playerSource, "runtime");
      assert.equal(share!.htmlPlayer, fx.html, "served bytes are the published runtime bytes");
    } finally {
      process.env.RUNTIME_RESOLVER_CUTOVER_ENABLED = "true";
    }
  });
});
