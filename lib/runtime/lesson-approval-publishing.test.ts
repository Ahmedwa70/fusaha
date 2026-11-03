// Integration tests for the Phase 5 approval orchestrator
// (lesson-approval-publishing.ts): publish → approve → bind, with
// compensation on bind failure. Runs against the same real disposable
// migrated database as the other runtime suites (injected via
// RUNTIME_PUBLICATION_TEST_DATABASE_URL / RUNTIME_BINDING_TEST_DATABASE_URL).
// Storage is an in-memory store with exact no-overwrite semantics.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createRuntimePublisher } = await import("./runtime-publication.ts" as string);
const { canonicalizePackage } = await import("./runtime-identity-v1.ts" as string);
const { approveLessonWithRuntime } = await import("./lesson-approval-publishing.ts" as string);
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);
const { RuntimeContentStoreError } = await import("./runtime-content-store.ts" as string);

const databaseUrl = process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";

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

describe("lesson approval with runtime publication (DB-backed)", { skip: !databaseUrl && "set RUNTIME_PUBLICATION_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let bindingService: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  const RUN = `apr-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    bindingService = createLessonVersionRuntimeBindingService(db as never);
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  async function makeLessonFixture(options: { lessonState?: number; approvedVersionId?: string | null } = {}) {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folder] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: "<html>template</html>", blueprint: "{}", validationScript: "return true" })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({
        ownerId: user.id,
        folderId: folder.id,
        name: tag,
        state: options.lessonState ?? schema.LessonState.Draft,
        currentApprovedVersionId: options.approvedVersionId ?? null,
      } as never)
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
    return { lessonId: lesson.id, lessonVersionId: version.id, userId: user.id, templateId: template.id, tag };
  }

  async function loadVersion(id: string) {
    const rows = await db
      .select({
        status: schema.lessonVersions.status,
        approvedAt: schema.lessonVersions.approvedAt,
        runtimeVersionId: schema.lessonVersions.runtimeVersionId,
        runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus,
      })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, id))
      .limit(1);
    return rows[0];
  }

  async function loadLesson(id: string) {
    const rows = await db
      .select({ state: schema.lessons.state, currentApprovedVersionId: schema.lessons.currentApprovedVersionId })
      .from(schema.lessons)
      .where(eq(schema.lessons.id, id))
      .limit(1);
    return rows[0];
  }

  function makeDeps(store: unknown) {
    const publisher = createRuntimePublisher({ db: db as never, store: store as never, bucket: "test-bucket" });
    return { publisher, bindingService };
  }

  test("1. approval publishes the runtime and binds the version to it", async () => {
    const fixture = await makeLessonFixture();
    const fake = createFakeStore();
    const { publisher } = makeDeps(fake.store);
    const htmlPlayer = `<html><body>orchestrator-${fixture.tag}</body></html>`;
    const expectedIdentity = canonicalizePackage({ files: { "index.html": htmlPlayer }, capabilities: ["lesson-data"] }).identity;

    const result = await approveLessonWithRuntime(
      {
        lessonId: fixture.lessonId,
        lessonVersionId: fixture.lessonVersionId,
        htmlPlayer,
        sourceTemplateId: fixture.templateId,
        actorUserId: fixture.userId,
      },
      { publisher, bindingService, db: db as never },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.runtimeIdentity, expectedIdentity);

    const version = await loadVersion(fixture.lessonVersionId);
    assert.equal(version.status, schema.VersionStatus.Approved);
    assert.ok(version.approvedAt, "approved_at set");
    assert.equal(version.runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.ok(version.runtimeVersionId, "bound to a runtime version row");

    const runtimeRows = await db
      .select({ id: schema.runtimeVersions.id, identity: schema.runtimeVersions.identity, state: schema.runtimeVersions.state })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, expectedIdentity))
      .limit(1);
    assert.equal(runtimeRows[0]?.state, schema.RuntimeVersionState.Published);
    assert.equal(version.runtimeVersionId, runtimeRows[0].id);

    const lesson = await loadLesson(fixture.lessonId);
    assert.equal(lesson.state, schema.LessonState.Approved);
    assert.equal(lesson.currentApprovedVersionId, fixture.lessonVersionId);
  });

  test("2. a publish failure leaves the lesson lifecycle completely untouched", async () => {
    const fixture = await makeLessonFixture();
    const failingPublisher = {
      publish: async () => {
        throw new Error("injected storage outage");
      },
    };
    const before = await loadVersion(fixture.lessonVersionId);

    const result = await approveLessonWithRuntime(
      { lessonId: fixture.lessonId, lessonVersionId: fixture.lessonVersionId, htmlPlayer: "<html>x</html>" },
      { publisher: failingPublisher, bindingService, db: db as never },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "publish-failed");
    assert.equal(result.rolledBack, false);

    const after = await loadVersion(fixture.lessonVersionId);
    assert.equal(after.status, before.status, "version still Draft");
    assert.equal(after.runtimeBindingStatus, before.runtimeBindingStatus, "binding untouched");
    const lesson = await loadLesson(fixture.lessonId);
    assert.equal(lesson.state, schema.LessonState.Draft);
  });

  test("3. a bind failure after approval compensates: version back to Draft, lesson restored", async () => {
    // Lesson was previously approved against an older version; the new
    // approval must roll everything back to that exact prior state.
    const fixture = await makeLessonFixture();
    const [older] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: fixture.lessonId,
        versionNumber: 0,
        status: schema.VersionStatus.Approved,
        schemaDefinitionId: (await db.select({ id: schema.schemaDefinitions.id }).from(schema.schemaDefinitions).limit(1))[0].id,
        content: {},
        approvedAt: new Date(),
      } as never)
      .returning({ id: schema.lessonVersions.id });
    await db
      .update(schema.lessons)
      .set({ state: schema.LessonState.Approved, currentApprovedVersionId: older.id })
      .where(eq(schema.lessons.id, fixture.lessonId));

    const fake = createFakeStore();
    const { publisher } = makeDeps(fake.store);
    const failingBinder = {
      bindLessonVersionRuntime: async () => {
        throw new Error("injected binding outage");
      },
    };

    const result = await approveLessonWithRuntime(
      {
        lessonId: fixture.lessonId,
        lessonVersionId: fixture.lessonVersionId,
        htmlPlayer: `<html>${fixture.tag}-v2</html>`,
        actorUserId: fixture.userId,
      },
      { publisher, bindingService: failingBinder, db: db as never },
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "bind-failed");
    assert.equal(result.rolledBack, true);

    const version = await loadVersion(fixture.lessonVersionId);
    assert.equal(version.status, schema.VersionStatus.Draft, "version returned to Draft");
    assert.equal(version.approvedAt, null, "approval timestamp cleared");
    assert.equal(version.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound, "no binding established");
    assert.equal(version.runtimeVersionId, null);

    const lesson = await loadLesson(fixture.lessonId);
    assert.equal(lesson.state, schema.LessonState.Approved, "lesson restored to its prior state");
    assert.equal(lesson.currentApprovedVersionId, older.id, "prior approved version restored");
  });

  test("4. retrying after a rolled-back approval reuses the already-published runtime idempotently", async () => {
    const fixture = await makeLessonFixture();
    const fake = createFakeStore();
    const { publisher } = makeDeps(fake.store);
    const htmlPlayer = `<html>${fixture.tag}-retry</html>`;
    const identity = canonicalizePackage({ files: { "index.html": htmlPlayer }, capabilities: ["lesson-data"] }).identity;

    const failingBinder = {
      bindLessonVersionRuntime: async () => {
        throw new Error("injected binding outage");
      },
    };
    const first = await approveLessonWithRuntime(
      { lessonId: fixture.lessonId, lessonVersionId: fixture.lessonVersionId, htmlPlayer, actorUserId: fixture.userId },
      { publisher, bindingService: failingBinder, db: db as never },
    );
    assert.equal(first.ok, false);

    const second = await approveLessonWithRuntime(
      { lessonId: fixture.lessonId, lessonVersionId: fixture.lessonVersionId, htmlPlayer, actorUserId: fixture.userId },
      { publisher, bindingService, db: db as never },
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.runtimeIdentity, identity, "same runtime identity across the retried approval");

    const version = await loadVersion(fixture.lessonVersionId);
    assert.equal(version.status, schema.VersionStatus.Approved);
    assert.equal(version.runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);

    const runtimes = await db
      .select({ id: schema.runtimeVersions.id })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, identity));
    assert.equal(runtimes.length, 1, "the published runtime was deduplicated, not republished");
  });

  test("5. a later approval with different content leaves the earlier published runtime untouched", async () => {
    const fixture = await makeLessonFixture();
    const fake = createFakeStore();
    const { publisher } = makeDeps(fake.store);
    const htmlA = `<html>${fixture.tag}-A</html>`;
    const htmlB = `<html>${fixture.tag}-B different</html>`;
    const identityA = canonicalizePackage({ files: { "index.html": htmlA }, capabilities: ["lesson-data"] }).identity;

    const approveA = await approveLessonWithRuntime(
      { lessonId: fixture.lessonId, lessonVersionId: fixture.lessonVersionId, htmlPlayer: htmlA, actorUserId: fixture.userId },
      { publisher, bindingService, db: db as never },
    );
    assert.equal(approveA.ok, true);

    // Second version on the same lesson, different bytes → different identity.
    const [version2] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: fixture.lessonId,
        versionNumber: 2,
        status: schema.VersionStatus.Draft,
        schemaDefinitionId: (await db.select({ id: schema.schemaDefinitions.id }).from(schema.schemaDefinitions).limit(1))[0].id,
        content: {},
      } as never)
      .returning({ id: schema.lessonVersions.id });
    const approveB = await approveLessonWithRuntime(
      { lessonId: fixture.lessonId, lessonVersionId: version2.id, htmlPlayer: htmlB, actorUserId: fixture.userId },
      { publisher, bindingService, db: db as never },
    );
    assert.equal(approveB.ok, true);

    const runtimeA = await db
      .select({ state: schema.runtimeVersions.state, identity: schema.runtimeVersions.identity, manifestSha256: schema.runtimeVersions.manifestSha256 })
      .from(schema.runtimeVersions)
      .where(eq(schema.runtimeVersions.identity, identityA))
      .limit(1);
    assert.equal(runtimeA[0].state, schema.RuntimeVersionState.Published, "runtime A still published");
    const checkA = await publisher.verifyPublishedAssets(identityA);
    assert.equal(checkA.allOk, true, "runtime A bytes intact and verified");
    assert.notEqual(identityA, approveB.ok ? (approveB as { runtimeIdentity: string }).runtimeIdentity : "", "distinct identities");
  });
});
