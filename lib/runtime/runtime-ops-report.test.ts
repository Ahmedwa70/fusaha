// Phase 8 tests for the read-only runtime ops report. Seeds the disposable
// database with every watched state (stale lease, failed attempt, failed
// runtime, quarantined/unrecoverable/bound/unbound versions) and proves the
// report surfaces them — and that building it performs ZERO writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const schema = await import("@/database/schema");
const { buildRuntimeOpsReport } = await import("./runtime-ops-report.ts" as string);

const databaseUrl = process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? "";

describe("runtime ops report (real database, read-only)", { skip: !databaseUrl && "set RUNTIME_BINDING_TEST_DATABASE_URL to a disposable migrated database" }, () => {
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const RUN = `ops-${Date.now()}`;
  const hex64 = () => (randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")).slice(0, 64);

  before(async () => {
    client = postgres(databaseUrl, { max: 6 });
    db = drizzle(client, { schema });
    await db.select({ id: schema.runtimeVersions.id }).from(schema.runtimeVersions).limit(1);
  });

  after(async () => {
    if (client) await client.end();
  });

  async function insertAttempt(overrides: Record<string, unknown>) {
    const [row] = await db.insert(schema.runtimePublicationAttempts).values({
      runtimeIdentity: `sha256-v1-${hex64()}`,
      identityAlgorithm: "runtime-package/v1",
      idempotencyKey: `${RUN}-${randomUUID().slice(0, 8)}`,
      requestFingerprint: hex64(),
      stagingNamespace: "runtime-staging",
      expectedAssetCount: 1,
      expectedPackageSizeBytes: 64,
      ...overrides,
    } as never).returning({ id: schema.runtimePublicationAttempts.id });
    return row;
  }

  async function insertRuntime(state: number) {
    const [row] = await db.insert(schema.runtimeVersions)
      .values({ identity: `sha256-v1-${hex64()}`, identityAlgorithm: "runtime-package/v1", state, packageKind: 0, entryPoint: "index.html", manifest: {}, manifestSha256: hex64(), assetCount: 1, packageSizeBytes: 64 } as never)
      .returning({ id: schema.runtimeVersions.id, identity: schema.runtimeVersions.identity });
    return row;
  }

  async function makeVersion(bindingStatus: number, runtimeVersionId: string | null = null) {
    const tag = `${RUN}-${randomUUID().slice(0, 8)}`;
    const [role] = await db.insert(schema.roles).values({ name: `${tag}-role`, title: `${tag} role` }).returning({ id: schema.roles.id });
    const [user] = await db.insert(schema.users).values({ id: randomUUID(), email: `${tag}@example.test`, name: tag, roleId: role.id } as never).returning({ id: schema.users.id });
    const [folder] = await db.insert(schema.folders).values({ ownerId: user.id, name: tag }).returning({ id: schema.folders.id });
    const [template] = await db.insert(schema.templates).values({ name: tag, htmlPlayer: "<html/>", blueprint: "{}", validationScript: "return true" }).returning({ id: schema.templates.id });
    const [schemaDefinition] = await db.insert(schema.schemaDefinitions).values({ levelKey: tag, level: { en: tag }, version: "v1", content: "{}", templateId: template.id } as never).returning({ id: schema.schemaDefinitions.id });
    const [lesson] = await db.insert(schema.lessons).values({ ownerId: user.id, folderId: folder.id, name: tag }).returning({ id: schema.lessons.id });
    const [version] = await db.insert(schema.lessonVersions).values({ lessonId: lesson.id, versionNumber: 1, status: schema.VersionStatus.Approved, schemaDefinitionId: schemaDefinition.id, content: {}, runtimeBindingStatus: bindingStatus, runtimeVersionId } as never).returning({ id: schema.lessonVersions.id });
    return { lessonVersionId: version.id, tag };
  }

  /** Counts only THIS suite's fixtures (other suites insert concurrently in a
   *  shared batch run, so a global count would flake; the report's read-only
   *  guarantee is proven against the rows this test can observe). */
  async function snapshotCounts() {
    const attemptRows = await db.select({ key: schema.runtimePublicationAttempts.idempotencyKey })
      .from(schema.runtimePublicationAttempts);
    const attemptCount = attemptRows.filter((r) => r.key.startsWith(RUN)).length;
    const lessonsRows = await db.select({ id: schema.lessons.id, name: schema.lessons.name }).from(schema.lessons);
    const scopedLessonIds = new Set(lessonsRows.filter((l) => l.name.startsWith(RUN)).map((l) => l.id));
    const versionRows = await db.select({ lessonId: schema.lessonVersions.lessonId }).from(schema.lessonVersions);
    const versionCount = versionRows.filter((v) => scopedLessonIds.has(v.lessonId)).length;
    return { attemptCount, versionCount };
  }

  test("reports stale leases, failed attempts, watched states, and storage integrity — with zero writes", async () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const past = new Date(now.getTime() - 60_000);
    const future = new Date(now.getTime() + 60_000);

    const staleAttempt = await insertAttempt({
      state: schema.RuntimePublicationAttemptState.Uploading,
      leaseOwner: "dead-worker",
      leaseExpiresAt: past,
      fencingToken: 3,
      retryCount: 1,
    });
    await insertAttempt({
      state: schema.RuntimePublicationAttemptState.Uploading,
      leaseOwner: "live-worker",
      leaseExpiresAt: future, // still leased — NOT stale
      fencingToken: 4,
    });
    const failedAttempt = await insertAttempt({
      state: schema.RuntimePublicationAttemptState.Failed,
      lastErrorCode: "OBJECT_KEY_CONFLICT",
      lastErrorAt: past,
      completedAt: past,
      retryCount: 2,
    });
    await insertAttempt({
      state: schema.RuntimePublicationAttemptState.Published,
      completedAt: past,
      fencingToken: 9,
    });

    const failedRuntime = await insertRuntime(schema.RuntimeVersionState.Failed);
    const okRuntime = await insertRuntime(schema.RuntimeVersionState.Published);
    const okRuntime2 = await insertRuntime(schema.RuntimeVersionState.Published);

    await makeVersion(schema.RuntimeBindingStatus.Bound, okRuntime.id);
    await makeVersion(schema.RuntimeBindingStatus.Legacy, okRuntime2.id);
    await makeVersion(schema.RuntimeBindingStatus.Quarantined);
    await makeVersion(schema.RuntimeBindingStatus.Unrecoverable);
    await makeVersion(schema.RuntimeBindingStatus.Unbound);

    const before = await snapshotCounts();
    const verified: string[] = [];
    const report = await buildRuntimeOpsReport({
      db: db as never,
      now,
      isEnabled: () => true,
      verifyStorage: async (identity: string) => {
        verified.push(identity);
        return { allOk: identity !== failedRuntime.identity }; // failed runtime not published; published ones pass
      },
    });
    const after = await snapshotCounts();
    assert.deepEqual(after, before, "building the report writes nothing");

    // Flag posture.
    assert.equal(report.flagEnabled, true);

    // Attempts: our 4 rows plus whatever concurrent suites created — assert
    // OUR fixtures are surfaced exactly, and global counts are at least ours.
    const staleOurs = report.attempts.stale.filter((s: { attemptId: string }) => s.attemptId === staleAttempt.id);
    assert.equal(staleOurs.length, 1, "our expired-lease attempt is listed as stale");
    assert.equal(staleOurs[0].state, schema.RuntimePublicationAttemptState.Uploading);
    const failedOurs = report.attempts.failed.filter((f: { attemptId: string }) => f.attemptId === failedAttempt.id);
    assert.equal(failedOurs.length, 1, "our failed attempt is listed with its error code");
    assert.equal(failedOurs[0].lastErrorCode, "OBJECT_KEY_CONFLICT");
    assert.ok(report.attempts.byState.Uploading >= 2, `Uploading >= ours (got ${report.attempts.byState.Uploading})`);
    assert.ok((report.attempts.byState.Failed ?? 0) >= 1);
    assert.ok((report.attempts.byState.Published ?? 0) >= 1);

    // Runtimes: our failed runtime is surfaced; published count >= ours.
    assert.ok(report.runtimes.byState.Failed >= 1);
    assert.ok(report.runtimes.byState.Published >= 2);
    assert.ok(report.runtimes.failedIdentities.includes(failedRuntime.identity));

    // Versions: every bucket holds at least our fixture.
    assert.ok(report.versions.bound >= 1);
    assert.ok(report.versions.legacy >= 1);
    assert.ok(report.versions.quarantined >= 1);
    assert.ok(report.versions.unrecoverable >= 1);
    assert.ok(report.versions.unbound >= 1);

    // Storage integrity probe ran for every published runtime (global set).
    assert.equal(report.storageIntegrity.skipped, undefined);
    if (!("skipped" in report.storageIntegrity)) {
      assert.ok(report.storageIntegrity.checked >= 2, `checked >= our published runtimes (got ${report.storageIntegrity.checked})`);
      assert.deepEqual(report.storageIntegrity.mismatches, []);
      assert.equal(verified.length, report.storageIntegrity.checked);
      assert.ok(!verified.includes(failedRuntime.identity), "failed runtimes are not probed");
    }
  });

  test("storage integrity mismatches are surfaced, and the probe is optional", async () => {
    const now = new Date();
    const badRuntime = await insertRuntime(schema.RuntimeVersionState.Published);
    const report = await buildRuntimeOpsReport({
      db: db as never,
      now,
      verifyStorage: async (identity: string) => ({ allOk: identity !== badRuntime.identity }),
    });
    if ("skipped" in report.storageIntegrity) throw new Error("integrity check should have run");
    assert.deepEqual(report.storageIntegrity.mismatches, [badRuntime.identity]);

    const skipped = await buildRuntimeOpsReport({ db: db as never, now });
    assert.deepEqual(skipped.storageIntegrity, { skipped: true });
  });
});
