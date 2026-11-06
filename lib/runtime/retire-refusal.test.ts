// T7 — independence-gate REFUSAL tests. For every non-Bound runtime binding
// status (Unbound, Legacy, Quarantined, Unrecoverable) both retire actions
// must refuse, and NOTHING may change: schema, template, lesson version,
// binding, and the absence of any successful-delete audit row.
// Runs on REAL fusaha-staging with fresh retire-tagged synthetic fixtures
// only. Never touches pre-existing rows.
//
// Environment: RUNTIME_PUBLICATION_TEST_DATABASE_URL (must be Staging) +
// RUNTIME_CONTENT_S3_* (SeaweedFS POC).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./retire-independence.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createRuntimePublisher } = await import("./runtime-publication.ts" as string);
const { setInjectedDb } = await import("./retire-test-db-stub.mjs");
const { setActor } = await import("./retire-test-auth-stub.mjs");
const { retireSchemaDefinition } = await import("../../actions/schema-definitions.ts" as string);
const { retireTemplate } = await import("../../actions/templates.ts" as string);
const { createS3RuntimeContentStore, readS3StoreConfigFromEnv } = await import("./runtime-content-store.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? "";
const s3Store = readS3StoreConfigFromEnv();
const hasLiveS3 = Boolean(s3Store.config && s3Store.bucket);
const EVIDENCE_DIR = "/tmp/fusaha-e2e/retire-evidence";

function evidence(name: string, data: unknown): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(`${EVIDENCE_DIR}/${name}.json`, JSON.stringify({ timestamp: new Date().toISOString(), ...((data ?? {}) as object) }, null, 2));
}

describe("T7 retire refusal for non-Bound lesson versions (fusaha-staging)", {
  skip: (!databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to fusaha-staging") ||
    (!hasLiveS3 && "set RUNTIME_CONTENT_S3_* and RUNTIME_CONTENT_S3_BUCKET to the SeaweedFS POC"),
}, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let publisher: ReturnType<typeof createRuntimePublisher>;
  const RUN = `refuse-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    setInjectedDb(db as never);
    const store = createS3RuntimeContentStore(s3Store.config, s3Store.bucket);
    publisher = createRuntimePublisher({ db: db as never, store, bucket: s3Store.bucket });

    const [role] = await db
      .insert(schema.roles)
      .values({ name: `${RUN}-actor-role`, title: `${RUN} actor role` })
      .returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${RUN}-actor@example.test`, name: `${RUN}-actor`, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    setActor(user);
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  /**
   * Fresh isolated fixture: active template + active schema + one lesson
   * version pinned at the requested binding status. Legacy requires a real
   * runtime_version_id (DB CHECK), so a tiny tagged runtime is published for
   * it; the other statuses may carry a NULL runtime pointer.
   */
  async function makeNonBoundFixture(status: number, label: string) {
    const tag = `${RUN}-${label}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folderRow] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: `<html><body>template:${tag}</body></html>`, blueprint: "{}", validationScript: "module.exports = function validate() { return { errors: [], warnings: [] }; }", active: true })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id, active: true } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: user.id, folderId: folderRow.id, name: tag, state: schema.LessonState.Draft, currentApprovedVersionId: null } as never)
      .returning({ id: schema.lessons.id });

    let runtimeVersionId: string | null = null;
    if (status === schema.RuntimeBindingStatus.Legacy) {
      const published = await publisher.publish(
        { files: { "index.html": `<html><body>legacy-runtime ${tag}</body></html>` }, entryPoint: "index.html", capabilities: ["lesson-data"], sourceTemplateId: template.id, actorUserId: user.id },
        `${tag}-legacy-runtime`,
      );
      assert.equal(published.state, schema.RuntimeVersionState.Published);
      runtimeVersionId = published.id;
    }

    const [version] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: lesson.id,
        versionNumber: 1,
        status: schema.VersionStatus.Draft,
        schemaDefinitionId: schemaDefinition.id,
        content: {},
        runtimeBindingStatus: status,
        runtimeVersionId,
      })
      .returning({ id: schema.lessonVersions.id });
    return { tag, lessonId: lesson.id, lessonVersionId: version.id, templateId: template.id, schemaDefinitionId: schemaDefinition.id };
  }

  async function snapshot(fixture: { lessonVersionId: string; templateId: string; schemaDefinitionId: string }) {
    const [version] = await db
      .select({
        schemaDefinitionId: schema.lessonVersions.schemaDefinitionId,
        runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus,
        runtimeVersionId: schema.lessonVersions.runtimeVersionId,
        status: schema.lessonVersions.status,
      })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, fixture.lessonVersionId))
      .limit(1);
    const [tpl] = await db
      .select({ id: schema.templates.id, active: schema.templates.active })
      .from(schema.templates)
      .where(eq(schema.templates.id, fixture.templateId))
      .limit(1);
    const [def] = await db
      .select({ id: schema.schemaDefinitions.id, active: schema.schemaDefinitions.active, templateId: schema.schemaDefinitions.templateId })
      .from(schema.schemaDefinitions)
      .where(eq(schema.schemaDefinitions.id, fixture.schemaDefinitionId))
      .limit(1);
    return { version, template: tpl, definition: def };
  }

  async function expectRefusal(status: number, label: string) {
    const fixture = await makeNonBoundFixture(status, label);

    const rSchema = await retireSchemaDefinition(fixture.schemaDefinitionId);
    assert.deepEqual(rSchema, { error: "schemaInUse" }, `retireSchemaDefinition must refuse for ${label}`);

    const rTemplate = await retireTemplate(fixture.templateId);
    assert.deepEqual(rTemplate, { error: "templateInUse" }, `retireTemplate must refuse for ${label}`);

    const after1 = await snapshot(fixture);
    assert.ok(after1.definition, `schema row survives (${label})`);
    assert.equal(after1.definition.templateId, fixture.templateId, "schema still linked to its template");
    assert.equal(after1.definition.active, true, "schema untouched");
    assert.ok(after1.template, `template row survives (${label})`);
    assert.equal(after1.template.active, true, "template untouched");
    assert.equal(after1.version.schemaDefinitionId, fixture.schemaDefinitionId, "version still points at its schema");
    assert.equal(after1.version.runtimeBindingStatus, status, `binding status still ${label}`);
    assert.equal(after1.version.status, schema.VersionStatus.Draft, "version status untouched");

    // No successful-delete audit row may exist for this fixture. The audit
    // resourceId for schema retire is "<levelKey>/v1" — check both shapes.
    const schemaAudit = await db
      .select({ newValues: schema.auditLogs.newValues })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, `${fixture.tag}/v1`));
    const templateAudit = await db
      .select({ newValues: schema.auditLogs.newValues })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, fixture.templateId));
    assert.equal(schemaAudit.length, 0, `no schema retire audit for ${label}`);
    assert.equal(templateAudit.length, 0, `no template retire audit for ${label}`);

    evidence(`T7-refusal-${label}`, {
      status,
      statusName: label,
      refused: { retireSchemaDefinition: rSchema, retireTemplate: rTemplate },
      unchanged: {
        schemaExists: true,
        templateExists: true,
        bindingStatus: after1.version.runtimeBindingStatus,
        versionSchemaDefinitionId: after1.version.schemaDefinitionId,
      },
      auditRowsForFixture: schemaAudit.length + templateAudit.length,
    });
    return { label, refused: true, auditRows: schemaAudit.length + templateAudit.length };
  }

  test("T7: retire refuses for Unbound, Legacy, Quarantined, Unrecoverable — nothing changes", async () => {
    const results = [];
    results.push(await expectRefusal(schema.RuntimeBindingStatus.Unbound, "Unbound"));
    results.push(await expectRefusal(schema.RuntimeBindingStatus.Legacy, "Legacy"));
    results.push(await expectRefusal(schema.RuntimeBindingStatus.Quarantined, "Quarantined"));
    results.push(await expectRefusal(schema.RuntimeBindingStatus.Unrecoverable, "Unrecoverable"));
    evidence("T7-refusal-summary", { statusesTested: results.length, results });
  });
});
