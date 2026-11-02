// Integration tests for the DB-backed lesson-version → runtime binding
// service. They run against a REAL PostgreSQL created by applying the repo
// migrations 0001–0023 to a disposable database, injected through
// RUNTIME_BINDING_TEST_DATABASE_URL (the same isolated-database discipline as
// the runtime-persistence POC — never the project DATABASE_URL). Without that
// variable every test skips; with it, everything below exercises the actual
// schema: the binding CHECK constraint, the conditional-update race guard, the
// restrict FK, the audit trail, and the fail-closed resolver.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { createLessonVersionRuntimeBindingService } = await import("./lesson-version-runtime-binding.ts" as string);

// Structural check used in rejection assertions — the service error class carries
// a stable `code`, and the dynamically imported module is untyped under plain Node.
const isBindingError = (error: unknown, code: string): boolean =>
  error instanceof Error && (error as { code?: string }).code === code;

const databaseUrl = process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";

describe("lesson-version runtime binding (DB-backed)", { skip: !databaseUrl && "set RUNTIME_BINDING_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let service: ReturnType<typeof createLessonVersionRuntimeBindingService>;
  const RUN = `rb-${Date.now()}`;

  before(async () => {
    client = postgres(databaseUrl, { max: 4 });
    db = drizzle(client, { schema });
    service = createLessonVersionRuntimeBindingService(db as never);
    // Fail fast if the target is not a migrated database.
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  function hex64() {
    return (randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")).slice(0, 64);
  }

  function publishedRuntimeIdentity() {
    return `sha256-v1-${hex64()}`;
  }

  async function insertRuntime(identity: string, state: number, overrides: Record<string, unknown> = {}) {
    const [row] = await db
      .insert(schema.runtimeVersions)
      .values({
        identity,
        identityAlgorithm: "runtime-package/v1",
        state,
        packageKind: 0,
        entryPoint: "index.html",
        manifest: { entryPoint: "index.html", assets: [{ path: "index.html" }] },
        manifestSha256: hex64(),
        assetCount: 1,
        packageSizeBytes: 128,
        ...overrides,
      } as never)
      .returning({ id: schema.runtimeVersions.id });
    return row;
  }

  async function makeApprovedLessonVersion(options: { approved?: boolean } = {}) {
    const approved = options.approved ?? true;
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db
      .insert(schema.users)
      .values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never)
      .returning({ id: schema.users.id });
    const [folder] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db
      .insert(schema.templates)
      .values({ name: tag, htmlPlayer: "<html></html>", blueprint: "{}", validationScript: "return true" })
      .returning({ id: schema.templates.id });
    const [schemaDefinition] = await db
      .insert(schema.schemaDefinitions)
      .values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never)
      .returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ ownerId: user.id, folderId: folder.id, name: tag })
      .returning({ id: schema.lessons.id });
    const [version] = await db
      .insert(schema.lessonVersions)
      .values({
        lessonId: lesson.id,
        versionNumber: 1,
        status: approved ? schema.VersionStatus.Approved : schema.VersionStatus.Draft,
        schemaDefinitionId: schemaDefinition.id,
        content: {},
      })
      .returning({ id: schema.lessonVersions.id });
    return { lessonId: lesson.id, lessonVersionId: version.id, userId: user.id, tag };
  }

  async function loadVersion(id: string) {
    const rows = await db
      .select({
        runtimeVersionId: schema.lessonVersions.runtimeVersionId,
        runtimeBindingStatus: schema.lessonVersions.runtimeBindingStatus,
      })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.id, id))
      .limit(1);
    return rows[0];
  }

  test("1. binds an approved unbound version to a published runtime", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    const runtime = await insertRuntime(identity, schema.RuntimeVersionState.Published);

    const record = await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity, actorUserId: fixture.userId });
    assert.equal(record.bindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.equal(record.runtimeVersionId, runtime.id);
    assert.equal(record.runtimeIdentity, identity);

    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.equal(row.runtimeVersionId, runtime.id);

    const [audit] = await db.select().from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.resourceId, fixture.lessonVersionId),
        eq(schema.auditLogs.action, "lesson-version-runtime-bound"),
      )).limit(1);
    assert.ok(audit);
  });

  test("2. re-asserting the identical binding is idempotent", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);

    await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });
    const again = await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });
    assert.equal(again.bindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.equal(again.runtimeIdentity, identity);
  });

  test("3. rebinding to a different runtime is rejected and the original binding survives", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identityA = publishedRuntimeIdentity();
    const identityB = publishedRuntimeIdentity();
    const runtimeA = await insertRuntime(identityA, schema.RuntimeVersionState.Published);
    await insertRuntime(identityB, schema.RuntimeVersionState.Published);

    await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identityA });
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identityB }),
      (error: unknown) => isBindingError(error, "binding-already-established")
    );

    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeVersionId, runtimeA.id);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);
  });

  test("4. binding to a nonexistent runtime fails and changes nothing", async () => {
    const fixture = await makeApprovedLessonVersion();
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: publishedRuntimeIdentity() }),
      (error: unknown) => isBindingError(error, "runtime-not-found")
    );
    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound);
    assert.equal(row.runtimeVersionId, null);
  });

  test("5. binding to a non-published runtime fails and changes nothing", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Pending);
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity }),
      (error: unknown) => isBindingError(error, "runtime-not-published")
    );
    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound);
  });

  test("6. a malformed runtime identity is rejected before any database write", async () => {
    const fixture = await makeApprovedLessonVersion();
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: "sha256-deadbeef" }),
      (error: unknown) => isBindingError(error, "invalid-runtime-identity")
    );
    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound);
  });

  test("7. a draft (non-approved) version cannot be bound", async () => {
    const fixture = await makeApprovedLessonVersion({ approved: false });
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity }),
      (error: unknown) => isBindingError(error, "lesson-version-not-approved")
    );
  });

  test("8. a version of a soft-deleted lesson cannot be bound", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await db.update(schema.lessons).set({ deletedAt: new Date() }).where(eq(schema.lessons.id, fixture.lessonId));
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity }),
      (error: unknown) => isBindingError(error, "lesson-version-deleted")
    );
    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound);
  });

  test("9. resolver returns the bound runtime package reference", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published, {
      entryPoint: "index.html",
      manifest: { entryPoint: "index.html" },
    });

    await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });
    const resolved = await service.resolveLessonVersionRuntime(fixture.lessonVersionId);
    assert.equal(resolved.mode, "bound");
    assert.equal(resolved.runtimeIdentity, identity);
    assert.equal(resolved.entryPoint, "index.html");
  });

  test("10. unbound historical versions resolve to the explicit template-fallback mode", async () => {
    const fixture = await makeApprovedLessonVersion();
    const resolved = await service.resolveLessonVersionRuntime(fixture.lessonVersionId);
    assert.deepEqual(resolved, { mode: "template-fallback", lessonVersionId: fixture.lessonVersionId });
  });

  test("11. quarantined versions fail closed in the resolver", async () => {
    const fixture = await makeApprovedLessonVersion();
    await service.quarantineLessonVersion({ lessonVersionId: fixture.lessonVersionId, reason: "generation evidence incomplete" });
    await assert.rejects(
      () => service.resolveLessonVersionRuntime(fixture.lessonVersionId),
      (error: unknown) => isBindingError(error, "lesson-version-quarantined")
    );
  });

  test("12. unrecoverable versions fail closed in the resolver", async () => {
    const fixture = await makeApprovedLessonVersion();
    await service.markLessonVersionUnrecoverable({ lessonVersionId: fixture.lessonVersionId, reason: "template content lost" });
    await assert.rejects(
      () => service.resolveLessonVersionRuntime(fixture.lessonVersionId),
      (error: unknown) => isBindingError(error, "lesson-version-unrecoverable")
    );
  });

  test("13. quarantine clears the runtime reference and cannot be bound afterwards", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);

    await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });
    const record = await service.quarantineLessonVersion({ lessonVersionId: fixture.lessonVersionId, reason: "post-publish integrity doubt" });
    assert.equal(record.bindingStatus, schema.RuntimeBindingStatus.Quarantined);
    assert.equal(record.runtimeVersionId, null);

    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeVersionId, null);

    // Idempotent re-quarantine is a no-op success.
    const again = await service.quarantineLessonVersion({ lessonVersionId: fixture.lessonVersionId, reason: "post-publish integrity doubt" });
    assert.equal(again.bindingStatus, schema.RuntimeBindingStatus.Quarantined);

    // A quarantined version can never be re-bound.
    await assert.rejects(
      () => service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity }),
      (error: unknown) => isBindingError(error, "binding-state-forbidden")
    );
  });

  test("14. legacy classification binds a deliberate legacy runtime snapshot", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    await insertRuntime(identity, schema.RuntimeVersionState.Published);

    const record = await service.markLessonVersionLegacyRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity, reason: "playable via approved legacy snapshot" });
    assert.equal(record.bindingStatus, schema.RuntimeBindingStatus.Legacy);

    const resolved = await service.resolveLessonVersionRuntime(fixture.lessonVersionId);
    assert.equal(resolved.mode, "legacy");
    assert.equal(resolved.runtimeIdentity, identity);
  });

  test("15. remediation without a reason fails and changes nothing", async () => {
    const fixture = await makeApprovedLessonVersion();
    await assert.rejects(
      () => service.quarantineLessonVersion({ lessonVersionId: fixture.lessonVersionId, reason: "   " }),
      (error: unknown) => isBindingError(error, "invalid-reason")
    );
    const row = await loadVersion(fixture.lessonVersionId);
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Unbound);
  });

  test("16. concurrent binds of different runtimes produce exactly one winner", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identityA = publishedRuntimeIdentity();
    const identityB = publishedRuntimeIdentity();
    const runtimeA = await insertRuntime(identityA, schema.RuntimeVersionState.Published);
    await insertRuntime(identityB, schema.RuntimeVersionState.Published);

    const [first, second] = await Promise.allSettled([
      service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identityA }),
      service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identityB }),
    ]);

    const outcomes = [first, second];
    const winners = outcomes.filter((o) => o.status === "fulfilled");
    const losers = outcomes.filter(
      (o) => o.status === "rejected" && isBindingError(o.reason, "binding-already-established")
    );
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);

    const row = await loadVersion(fixture.lessonVersionId);
    const boundIdentity = row.runtimeVersionId === runtimeA.id ? identityA : identityB;
    assert.equal(row.runtimeBindingStatus, schema.RuntimeBindingStatus.Bound);
    assert.ok(boundIdentity);
  });

  test("17. reconciliation reports statuses and flags non-published bound references", async () => {
    const fixture = await makeApprovedLessonVersion();
    const identity = publishedRuntimeIdentity();
    const runtime = await insertRuntime(identity, schema.RuntimeVersionState.Published);
    await service.bindLessonVersionRuntime({ lessonVersionId: fixture.lessonVersionId, runtimeIdentity: identity });

    const healthy = await service.getBindingReconciliation();
    assert.equal(healthy.integrityViolations.length, 0);
    assert.ok(healthy.totalVersions >= 1);
    assert.ok((healthy.byStatus[schema.RuntimeBindingStatus.Bound] ?? 0) >= 1);
    assert.ok(healthy.unboundApprovedCount >= 0);

    // Corrupt the registry state underneath the binding — the reconciliation
    // query must surface it (fail-closed visibility, not silent). Restore the
    // state afterwards so the shared disposable database stays clean for
    // reruns and for other suites running against it.
    try {
      await db.update(schema.runtimeVersions)
        .set({ state: schema.RuntimeVersionState.Failed })
        .where(eq(schema.runtimeVersions.id, runtime.id));
      const corrupted = await service.getBindingReconciliation();
      const violation = corrupted.integrityViolations.find((v: { lessonVersionId: string }) => v.lessonVersionId === fixture.lessonVersionId);
      assert.ok(violation);

      // The resolver also fails closed on the same corruption.
      await assert.rejects(
        () => service.resolveLessonVersionRuntime(fixture.lessonVersionId),
        (error: unknown) => isBindingError(error, "runtime-integrity-violation")
      );
    } finally {
      await db.update(schema.runtimeVersions)
        .set({ state: schema.RuntimeVersionState.Published })
        .where(eq(schema.runtimeVersions.id, runtime.id));
    }
  });
});
