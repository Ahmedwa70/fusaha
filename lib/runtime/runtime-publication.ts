// Runtime publication service (Implementation Plan Phase 5): the production
// port of the POC publication protocol (poc/runtime-persistence/
// integration-adapter-poc.mjs) onto the app schema (runtime_versions,
// runtime_publication_attempts, runtime_assets, runtime_storage_objects,
// runtime_storage_locations) with smallint state enums.
//
// Guarantees (PERSISTENT_RUNTIME_STORAGE_ADR.md):
// - Runtime Identity V1: identity is computed by the frozen TS port
//   (./runtime-identity-v1) — the same algorithm the frozen vectors prove.
// - Write-once storage via If-None-Match: * through the injected content
//   store; a runtime becomes visible only after every asset is uploaded,
//   verified with an independent SHA-256 (never ETag), and the publication
//   transaction commits.
// - Durable idempotency: unique(idempotency_key); reusing a key for a
//   different package fingerprint fails with IDEMPOTENCY_CONFLICT and no
//   side effects (finding F2, design doc §11.2 / ADR §9.1).
// - Leases + fencing: every phase transition and the finalization guard are
//   conditional on the caller still holding the current fencing token and an
//   unexpired lease; recovery seizes only attempts whose lease expired or
//   that reported failure.
//
// Simplifications carried over from the POC (documented, not hidden):
// - No background reaper expires abandoned attempts; a crashed worker's
//   attempt stays unreachable until its lease lapses.
// - Concurrency safety comes from the version-row lock plus the fencing
//   guard, not from cross-process stress beyond the test suite.

import { randomUUID } from "node:crypto";

import { and, eq, gt, notInArray, sql } from "drizzle-orm";
import { db as appDb } from "@/lib/db";
import {
  runtimeVersions,
  runtimeAssets,
  runtimeStorageObjects,
  runtimeStorageLocations,
  runtimePublicationAttempts,
  RuntimeVersionState,
  RuntimePackageKind,
  RuntimePublicationAttemptState,
  RuntimeStorageObjectState,
} from "@/database/schema";
import {
  canonicalizePackage,
  IDENTITY_ALGORITHM,
  sha256Hex,
  type CanonicalRuntimePackage,
  type CanonicalizePackageInput,
} from "./runtime-identity-v1";
import type { RuntimeContentStore } from "./runtime-content-store";

export type RuntimePublicationErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "FENCED"
  | "LEASE_HELD"
  | "STORAGE_ERROR"
  | "STAGING_INTEGRITY"
  | "OBJECT_KEY_CONFLICT"
  | "ATTEMPT_NOT_FOUND"
  | "VERSION_STATE_FORBIDDEN";

export class RuntimePublicationError extends Error {
  readonly code: RuntimePublicationErrorCode;
  readonly attemptId?: string;

  constructor(message: string, code: RuntimePublicationErrorCode, attemptId?: string) {
    super(message);
    this.name = "RuntimePublicationError";
    this.code = code;
    this.attemptId = attemptId;
  }
}

export type PublishRuntimeInput = CanonicalizePackageInput &
  Readonly<{
    sourceTemplateId?: string | null;
    actorUserId?: string | null;
  }>;

export type PublishOptions = Readonly<{
  /** Test hook: simulate a crash after the named phase (marks the attempt failed). */
  crashAfter?: "upload" | "verify" | "finalize" | null;
  /** Test hook: per-asset artificial delay during staging upload. */
  delayMs?: number;
  leaseSeconds?: number;
}>;

export type PublishedRuntimeAsset = Readonly<{
  path: string;
  contentSha256: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  bucket: string;
}>;

export type PublishedRuntime = Readonly<{
  id: string;
  identity: string;
  identityAlgorithm: string;
  state: RuntimeVersionState;
  manifest: unknown;
  manifestSha256: string;
  publishedAt: Date | null;
  assets: ReadonlyArray<PublishedRuntimeAsset>;
}>;

export type RuntimePublisher = ReturnType<typeof createRuntimePublisher>;

type DbLike = Pick<typeof appDb, "select" | "insert" | "update" | "transaction">;
type TxLike = Pick<DbLike, "select" | "insert" | "update">;

const delay = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stagingContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export function createRuntimePublisher({
  db,
  store,
  provider = "s3-compatible",
  bucket,
  stagingPrefix = "runtime-staging",
  leaseSeconds: defaultLeaseSeconds = 30,
}: Readonly<{
  db?: DbLike;
  store: RuntimeContentStore;
  provider?: string;
  bucket: string;
  stagingPrefix?: string;
  leaseSeconds?: number;
}>) {
  const database = db ?? (appDb as DbLike);
  const workerId = randomUUID();

  async function getPublished(identity: string): Promise<PublishedRuntime | null> {
    const versions = await database
      .select({
        id: runtimeVersions.id,
        identity: runtimeVersions.identity,
        identityAlgorithm: runtimeVersions.identityAlgorithm,
        state: runtimeVersions.state,
        manifest: runtimeVersions.manifest,
        manifestSha256: runtimeVersions.manifestSha256,
        publishedAt: runtimeVersions.publishedAt,
      })
      .from(runtimeVersions)
      .where(and(eq(runtimeVersions.identityAlgorithm, IDENTITY_ALGORITHM), eq(runtimeVersions.identity, identity)))
      .limit(1);
    const version = versions[0];
    if (!version) return null;
    const assets = await database
      .select({
        path: runtimeAssets.path,
        contentSha256: runtimeAssets.contentSha256,
        contentType: runtimeAssets.contentType,
        sizeBytes: runtimeAssets.sizeBytes,
        objectKey: runtimeStorageLocations.objectKey,
        bucket: runtimeStorageLocations.bucket,
      })
      .from(runtimeAssets)
      .innerJoin(runtimeStorageObjects, eq(runtimeStorageObjects.id, runtimeAssets.storageObjectId))
      .innerJoin(
        runtimeStorageLocations,
        and(
          eq(runtimeStorageLocations.storageObjectId, runtimeStorageObjects.id),
          eq(runtimeStorageLocations.isPrimary, true),
        ),
      )
      .where(eq(runtimeAssets.runtimeVersionId, version.id))
      .orderBy(runtimeAssets.path);
    return { ...version, assets };
  }

  // Marks an attempt failed, but only if this worker still owns the current
  // fencing token and the attempt has not reached a terminal state. A stale
  // worker that errors late must not downgrade an attempt that another worker
  // already re-leased or published (conditional update per ADR §7.3). When the
  // attempt failure actually applied, the version row records the failure too
  // (design doc §3.7 Failed state) — conditional on the version still being
  // Pending so a concurrent winner is never downgraded.
  async function markFailed(attemptId: string, token: number, code: RuntimePublicationErrorCode, message: string) {
    await database
      .update(runtimePublicationAttempts)
      .set({
        state: RuntimePublicationAttemptState.Failed,
        lastErrorCode: code,
        lastErrorAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(runtimePublicationAttempts.id, attemptId),
          eq(runtimePublicationAttempts.fencingToken, token),
          notInArray(runtimePublicationAttempts.state, [
            RuntimePublicationAttemptState.Published,
            RuntimePublicationAttemptState.Quarantined,
          ]),
        ),
      );
    const attemptRows = await database
      .select({ state: runtimePublicationAttempts.state, runtimeVersionId: runtimePublicationAttempts.runtimeVersionId })
      .from(runtimePublicationAttempts)
      .where(eq(runtimePublicationAttempts.id, attemptId))
      .limit(1);
    const attempt = attemptRows[0];
    if (attempt?.state === RuntimePublicationAttemptState.Failed && attempt.runtimeVersionId) {
      try {
        await database
          .update(runtimeVersions)
          .set({ state: RuntimeVersionState.Failed, failureCode: code, failedAt: new Date() })
          .where(and(eq(runtimeVersions.id, attempt.runtimeVersionId), eq(runtimeVersions.state, RuntimeVersionState.Pending)));
      } catch {
        // Failure bookkeeping is best-effort; the publication error returned
        // below is the authoritative signal.
      }
    }
    return new RuntimePublicationError(message, code, attemptId);
  }

  // Creates (or re-leases) the attempt row and locks the runtime version row.
  // A lease lasts leaseSeconds from acquisition; re-leasing (same idempotency
  // key) extends the lease and increments the fencing token, which fences any
  // earlier holder of the same attempt.
  // Returns alreadyPublished when the runtime was published by someone else.
  type BeginAttemptResult =
    | { readonly alreadyPublished: true; readonly versionRowId: string }
    | { readonly alreadyPublished: false; readonly versionRowId: string; readonly attemptId: string; readonly token: number };

  async function beginAttempt(
    packageData: CanonicalRuntimePackage,
    idempotencyKey: string,
    expectedAssetCount: number,
    packageSizeBytes: number,
    input: Pick<PublishRuntimeInput, "sourceTemplateId" | "actorUserId">,
    leaseSeconds: number,
  ): Promise<BeginAttemptResult> {
    const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000);
    return database.transaction(async (tx): Promise<BeginAttemptResult> => {
      await tx
        .insert(runtimeVersions)
        .values({
          identity: packageData.identity,
          identityAlgorithm: IDENTITY_ALGORITHM,
          state: RuntimeVersionState.Pending,
          packageKind: packageData.files.size === 1 ? RuntimePackageKind.SingleFile : RuntimePackageKind.MultiFile,
          entryPoint: packageData.manifest.entryPoint,
          manifest: packageData.manifest,
          manifestSha256: packageData.manifestSha256,
          assetCount: expectedAssetCount,
          packageSizeBytes: packageSizeBytes,
          sourceTemplateId: input.sourceTemplateId ?? null,
          createdBy: input.actorUserId ?? null,
        })
        .onConflictDoNothing();

      const locked = await tx
        .select({ id: runtimeVersions.id, state: runtimeVersions.state })
        .from(runtimeVersions)
        .where(and(eq(runtimeVersions.identityAlgorithm, IDENTITY_ALGORITHM), eq(runtimeVersions.identity, packageData.identity)))
        .limit(1)
        .for("update");
      const version = locked[0];
      if (!version) throw new RuntimePublicationError("runtime version row missing after upsert", "VERSION_STATE_FORBIDDEN");

      if (version.state === RuntimeVersionState.Published) return { alreadyPublished: true, versionRowId: version.id };
      if (version.state !== RuntimeVersionState.Pending && version.state !== RuntimeVersionState.Failed) {
        throw new RuntimePublicationError(
          `runtime version is in state ${version.state} and cannot be published`,
          "VERSION_STATE_FORBIDDEN",
        );
      }
      // A previously failed version (e.g. an environmental storage error on
      // an earlier attempt under a different idempotency key) may be retried:
      // the identity pins the manifest exactly, so reset to Pending and let
      // the conditional publication converge.
      if (version.state === RuntimeVersionState.Failed) {
        await tx
          .update(runtimeVersions)
          .set({ state: RuntimeVersionState.Pending, failureCode: null, integrityIssue: null })
          .where(eq(runtimeVersions.id, version.id));
      }

      const attempts = await tx
        .insert(runtimePublicationAttempts)
        .values({
          runtimeVersionId: version.id,
          identityAlgorithm: IDENTITY_ALGORITHM,
          runtimeIdentity: packageData.identity,
          idempotencyKey,
          requestFingerprint: packageData.identity,
          state: RuntimePublicationAttemptState.Created,
          leaseOwner: workerId,
          fencingToken: 1,
          leaseExpiresAt,
          stagingNamespace: stagingPrefix,
          expectedAssetCount,
          expectedPackageSizeBytes: packageSizeBytes,
        })
        .onConflictDoUpdate({
          target: runtimePublicationAttempts.idempotencyKey,
          set: {
            fencingToken: sql`${runtimePublicationAttempts.fencingToken} + 1`,
            state: RuntimePublicationAttemptState.Leased,
            leaseOwner: workerId,
            leaseExpiresAt,
            retryCount: sql`${runtimePublicationAttempts.retryCount} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: runtimePublicationAttempts.id,
          fencingToken: runtimePublicationAttempts.fencingToken,
          requestFingerprint: runtimePublicationAttempts.requestFingerprint,
        });
      const attempt = attempts[0];
      if (!attempt) throw new RuntimePublicationError("attempt row missing after upsert", "ATTEMPT_NOT_FOUND");

      // Finding F2 (design doc §11.2 / ADR §9.1 step 3): an idempotency key is
      // the caller's retry identity for ONE logical request. Reusing it with a
      // different package must fail with an idempotency conflict and no side
      // effects — throwing here rolls the whole transaction back (the version
      // upsert/reset above is undone too).
      if (attempt.requestFingerprint !== packageData.identity) {
        throw new RuntimePublicationError(
          "idempotency key reused for a different package fingerprint",
          "IDEMPOTENCY_CONFLICT",
          attempt.id,
        );
      }
      return { alreadyPublished: false, versionRowId: version.id, attemptId: attempt.id, token: attempt.fencingToken };
    });
  }

  async function uploadStaged(
    packageData: CanonicalRuntimePackage,
    attemptId: string,
    token: number,
    delayMs: number,
  ): Promise<Map<string, string>> {
    const stagingKeys = new Map<string, string>();
    for (const asset of packageData.manifest.assets) {
      await delay(delayMs);
      const bytes = packageData.files.get(asset.path) as Buffer;
      const key = `${stagingPrefix}/${attemptId}/${token}/${asset.path}`;
      try {
        await store.putIfAbsent(key, bytes, stagingContentType(asset.path));
      } catch (error) {
        throw toPublicationError(error, "STORAGE_ERROR", `staged upload failed for ${asset.path}`);
      }
      stagingKeys.set(asset.path, key);
    }
    return stagingKeys;
  }

  async function verifyStaged(packageData: CanonicalRuntimePackage, stagingKeys: ReadonlyMap<string, string>) {
    for (const asset of packageData.manifest.assets) {
      const expected = packageData.files.get(asset.path) as Buffer;
      let staged: Buffer;
      try {
        staged = await store.get(stagingKeys.get(asset.path) as string);
      } catch (error) {
        throw toPublicationError(error, "STORAGE_ERROR", `staged verification read failed for ${asset.path}`);
      }
      if (!staged.equals(expected) || sha256Hex(staged) !== asset.contentSha256) {
        throw new RuntimePublicationError(`staged hash mismatch: ${asset.path}`, "STAGING_INTEGRITY");
      }
    }
  }

  async function promoteFinal(packageData: CanonicalRuntimePackage): Promise<Map<string, string>> {
    const finalKeys = new Map<string, string>();
    for (const asset of packageData.manifest.assets) {
      const bytes = packageData.files.get(asset.path) as Buffer;
      // Content-addressed key: re-promotion after a crash dedupes via 412.
      const key = `runtime/${packageData.identity}/${asset.contentSha256}`;
      try {
        await store.putIfAbsent(key, bytes, asset.contentType);
      } catch (error) {
        if (error instanceof Error && (error as { code?: string }).code === "content-store-key-conflict") {
          throw new RuntimePublicationError(`object key conflict with different bytes: ${key}`, "OBJECT_KEY_CONFLICT");
        }
        throw toPublicationError(error, "STORAGE_ERROR", `final promotion failed for ${asset.path}`);
      }
      finalKeys.set(asset.path, key);
    }
    return finalKeys;
  }

  function stagedKeysOf(packageData: CanonicalRuntimePackage, attemptId: string, token: number): Map<string, string> {
    const stagingKeys = new Map<string, string>();
    for (const path of packageData.files.keys()) {
      stagingKeys.set(path, `${stagingPrefix}/${attemptId}/${token}/${path}`);
    }
    return stagingKeys;
  }

  // Conditional DB publication. Safe to re-run after a crash: every statement
  // is an upsert gated on the version row state, so partial states converge.
  //
  // ADR §7.3 fencing guard (runs first, inside the same transaction): the
  // worker must still hold the current fencing token and an unexpired lease.
  // A zero-row update means this worker is stale or fenced; it must stop and
  // must not write final metadata.
  async function finalizePublication(
    versionRowId: string,
    attemptId: string,
    token: number,
    packageData: CanonicalRuntimePackage,
  ) {
    return database.transaction(async (tx: TxLike) => {
      const guard = await tx
        .update(runtimePublicationAttempts)
        .set({ state: RuntimePublicationAttemptState.Finalizing, updatedAt: new Date() })
        .where(
          and(
            eq(runtimePublicationAttempts.id, attemptId),
            eq(runtimePublicationAttempts.fencingToken, token),
            gt(runtimePublicationAttempts.leaseExpiresAt, new Date()),
          ),
        )
        .returning({ id: runtimePublicationAttempts.id });
      if (guard.length === 0) {
        // No attemptId on this error on purpose: publish() treats errors that
        // carry an attemptId as already-marked failures and rethrows them,
        // while FENCED must fall through to the convergence loop (a concurrent
        // identical submission holds a newer lease and will publish shortly).
        throw new RuntimePublicationError("worker fenced: fencing token mismatch or lease expired", "FENCED");
      }

      const locked = await tx
        .select({ id: runtimeVersions.id, state: runtimeVersions.state })
        .from(runtimeVersions)
        .where(eq(runtimeVersions.id, versionRowId))
        .limit(1)
        .for("update");
      const version = locked[0];
      if (!version) throw new RuntimePublicationError("runtime version row missing at finalize", "VERSION_STATE_FORBIDDEN");
      if (version.state === RuntimeVersionState.Published) return { publishedByOther: true };

      for (const asset of packageData.manifest.assets) {
        const objectKey = `runtime/${packageData.identity}/${asset.contentSha256}`;

        // Dedupe: an identical byte sequence already stored (same content
        // address) backs the new asset with the same logical object.
        const existing = await findPrimaryLocation(tx, objectKey);
        let objectId: string;
        if (existing) {
          objectId = existing.storageObjectId;
          await tx
            .update(runtimeStorageObjects)
            .set({ state: RuntimeStorageObjectState.Available, verifiedAt: new Date(), lastVerifiedAt: new Date() })
            .where(eq(runtimeStorageObjects.id, objectId));
        } else {
          const inserted = await tx
            .insert(runtimeStorageObjects)
            .values({
              contentSha256: asset.contentSha256,
              sizeBytes: asset.sizeBytes,
              contentType: asset.contentType,
              state: RuntimeStorageObjectState.Available,
              verifiedAt: new Date(),
              lastVerifiedAt: new Date(),
            })
            .returning({ id: runtimeStorageObjects.id });
          objectId = inserted[0].id;
          await tx
            .insert(runtimeStorageLocations)
            .values({ storageObjectId: objectId, provider, bucket, objectKey, isPrimary: true })
            .onConflictDoNothing();
          // A concurrent publisher of identical bytes may have won the location
          // race: reuse its object row so the asset points at one logical object.
          const raced = await findPrimaryLocation(tx, objectKey);
          if (raced && raced.storageObjectId !== objectId) {
            objectId = raced.storageObjectId;
          }
        }

        await tx
          .insert(runtimeAssets)
          .values({
            runtimeVersionId: versionRowId,
            storageObjectId: objectId,
            path: asset.path,
            contentSha256: asset.contentSha256,
            sizeBytes: asset.sizeBytes,
            contentType: asset.contentType,
          })
          .onConflictDoNothing();
      }

      const updated = await tx
        .update(runtimeVersions)
        .set({ state: RuntimeVersionState.Published, publishedAt: new Date(), verifiedAt: new Date() })
        .where(and(eq(runtimeVersions.id, versionRowId), eq(runtimeVersions.state, RuntimeVersionState.Pending)))
        .returning({ id: runtimeVersions.id });
      if (updated.length === 0) return { publishedByOther: true };

      await tx
        .update(runtimePublicationAttempts)
        .set({
          state: RuntimePublicationAttemptState.Published,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(runtimePublicationAttempts.id, attemptId), eq(runtimePublicationAttempts.fencingToken, token)));
      return { publishedByOther: false };
    });
  }

  async function findPrimaryLocation(tx: TxLike, objectKey: string) {
    const rows = await tx
      .select({
        id: runtimeStorageLocations.id,
        storageObjectId: runtimeStorageLocations.storageObjectId,
      })
      .from(runtimeStorageLocations)
      .where(
        and(
          eq(runtimeStorageLocations.provider, provider),
          eq(runtimeStorageLocations.bucket, bucket),
          eq(runtimeStorageLocations.objectKey, objectKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async function publish(
    input: PublishRuntimeInput,
    idempotencyKey: string,
    options: PublishOptions = {},
  ): Promise<PublishedRuntime> {
    const packageData = canonicalizePackage(input);
    const leaseSeconds = options.leaseSeconds ?? defaultLeaseSeconds;
    const delayMs = options.delayMs ?? 0;
    const expectedAssetCount = packageData.manifest.assets.length;
    const packageSizeBytes = [...packageData.files.values()].reduce((total, bytes) => total + bytes.length, 0);

    const attempt = await beginAttempt(packageData, idempotencyKey, expectedAssetCount, packageSizeBytes, input, leaseSeconds);
    if (attempt.alreadyPublished) {
      const published = await getPublished(packageData.identity);
      if (!published || published.state !== RuntimeVersionState.Published) {
        throw new RuntimePublicationError("runtime reported published but row is not in published state", "VERSION_STATE_FORBIDDEN");
      }
      return published;
    }

    try {
      const stagingKeys = await uploadStaged(packageData, attempt.attemptId, attempt.token, delayMs);
      if (options.crashAfter === "upload") {
        throw await markFailed(attempt.attemptId, attempt.token, "STORAGE_ERROR", "simulated crash after staging upload");
      }

      await verifyStaged(packageData, stagingKeys);
      if (options.crashAfter === "verify") {
        throw await markFailed(attempt.attemptId, attempt.token, "STAGING_INTEGRITY", "simulated crash after verification");
      }

      await promoteFinal(packageData);
      if (options.crashAfter === "finalize") {
        throw await markFailed(attempt.attemptId, attempt.token, "STORAGE_ERROR", "simulated crash before publication transaction");
      }

      const result = await finalizePublication(attempt.versionRowId, attempt.attemptId, attempt.token, packageData);
      const published = await getPublished(packageData.identity);
      if (!published || (result.publishedByOther === false && published.state !== RuntimeVersionState.Published)) {
        throw new RuntimePublicationError("publication transaction committed without a published runtime", "VERSION_STATE_FORBIDDEN");
      }
      return published;
    } catch (error) {
      if (error instanceof RuntimePublicationError && error.attemptId) throw error;
      if (error instanceof RuntimePublicationError && error.code === "FENCED") {
        // A newer lease on the same idempotency key exists (a concurrent
        // identical submission). The logical request is the same, so converge
        // on the other worker's result instead of failing the caller.
        for (let retry = 0; retry < 20; retry += 1) {
          await delay(250);
          const settled = await getPublished(packageData.identity);
          if (settled && settled.state === RuntimeVersionState.Published) return settled;
        }
        throw error;
      }
      const code = error instanceof RuntimePublicationError ? error.code : "STORAGE_ERROR";
      // markFailed records the failure on the attempt (fenced) and, when the
      // update actually applied, on the still-Pending version row.
      throw await markFailed(
        attempt.attemptId,
        attempt.token,
        code,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Re-leases an attempt and completes publication, per ADR §7.3/§9.4.
  // The seize is a single conditional UPDATE: recovery is allowed only when
  // the previous lease has expired, or the attempt already reported failure.
  // A zero-row update means the lease is still validly held or the attempt is
  // terminal: nothing is changed and LEASE_HELD is thrown, so a live slow
  // worker is never preempted and its fencing token stays intact.
  async function recover(attemptRowId: string, input: PublishRuntimeInput, options: PublishOptions = {}) {
    const packageData = canonicalizePackage(input);
    const leaseSeconds = options.leaseSeconds ?? defaultLeaseSeconds;
    const delayMs = options.delayMs ?? 0;
    const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000);

    const seized = await database
      .update(runtimePublicationAttempts)
      .set({
        fencingToken: sql`${runtimePublicationAttempts.fencingToken} + 1`,
        state: RuntimePublicationAttemptState.Leased,
        leaseOwner: workerId,
        leaseExpiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(runtimePublicationAttempts.id, attemptRowId),
          notInArray(runtimePublicationAttempts.state, [
            RuntimePublicationAttemptState.Published,
            RuntimePublicationAttemptState.Quarantined,
          ]),
          sql`(${runtimePublicationAttempts.leaseExpiresAt} < now() OR ${runtimePublicationAttempts.state} = ${RuntimePublicationAttemptState.Failed})`,
        ),
      )
      .returning({
        id: runtimePublicationAttempts.id,
        runtimeVersionId: runtimePublicationAttempts.runtimeVersionId,
        fencingToken: runtimePublicationAttempts.fencingToken,
      });
    const attempt = seized[0];
    if (!attempt) {
      const rows = await database
        .select({
          state: runtimePublicationAttempts.state,
          leaseExpiresAt: runtimePublicationAttempts.leaseExpiresAt,
        })
        .from(runtimePublicationAttempts)
        .where(eq(runtimePublicationAttempts.id, attemptRowId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new RuntimePublicationError(`attempt not found: ${attemptRowId}`, "ATTEMPT_NOT_FOUND");
      throw new RuntimePublicationError(
        `attempt is not recoverable now (state=${row.state}); its lease must expire first`,
        "LEASE_HELD",
      );
    }
    if (!attempt.runtimeVersionId) throw new RuntimePublicationError("attempt has no runtime version", "ATTEMPT_NOT_FOUND");

    const versionRows = await database
      .select({ id: runtimeVersions.id, state: runtimeVersions.state })
      .from(runtimeVersions)
      .where(eq(runtimeVersions.id, attempt.runtimeVersionId))
      .limit(1);
    const version = versionRows[0];
    if (!version) throw new RuntimePublicationError("runtime version row missing at recovery", "VERSION_STATE_FORBIDDEN");
    if (version.state === RuntimeVersionState.Published) {
      const published = await getPublished(packageData.identity);
      if (published) return published;
    }
    // The crashed attempt may have failed the version row; recovery is a new
    // attempt on the same identity, so reset Failed → Pending (identity pins
    // the manifest exactly). Quarantined versions stay untouched (fail closed).
    if (version.state === RuntimeVersionState.Failed) {
      await database
        .update(runtimeVersions)
        .set({ state: RuntimeVersionState.Pending, failureCode: null, integrityIssue: null })
        .where(and(eq(runtimeVersions.id, version.id), eq(runtimeVersions.state, RuntimeVersionState.Failed)));
    } else if (version.state !== RuntimeVersionState.Pending) {
      throw new RuntimePublicationError(
        `runtime version is in state ${version.state} and cannot be recovered`,
        "VERSION_STATE_FORBIDDEN",
      );
    }

    // Re-run storage phases. Staging keys embed the fencing token, so recovery
    // writes a fresh staging set; final keys are content-addressed and dedupe.
    await uploadStaged(packageData, attempt.id, attempt.fencingToken, delayMs);
    await verifyStaged(packageData, stagedKeysOf(packageData, attempt.id, attempt.fencingToken));
    await promoteFinal(packageData);
    await finalizePublication(attempt.runtimeVersionId, attempt.id, attempt.fencingToken, packageData);
    const published = await getPublished(packageData.identity);
    if (!published) throw new RuntimePublicationError("recovery completed without a published runtime", "VERSION_STATE_FORBIDDEN");
    return published;
  }

  async function findAttempt(idempotencyKey: string) {
    const rows = await database
      .select({
        id: runtimePublicationAttempts.id,
        state: runtimePublicationAttempts.state,
        fencingToken: runtimePublicationAttempts.fencingToken,
        runtimeVersionId: runtimePublicationAttempts.runtimeVersionId,
        leaseExpiresAt: runtimePublicationAttempts.leaseExpiresAt,
      })
      .from(runtimePublicationAttempts)
      .where(eq(runtimePublicationAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  }

  // Cross-check: every published asset row against the actual stored bytes.
  async function verifyPublishedAssets(identity: string) {
    const runtime = await getPublished(identity);
    if (!runtime || runtime.state !== RuntimeVersionState.Published) {
      throw new RuntimePublicationError("runtime is not published", "VERSION_STATE_FORBIDDEN");
    }
    const report = [];
    for (const asset of runtime.assets) {
      const stored = await store.get(asset.objectKey);
      const actualSha = sha256Hex(stored);
      report.push({
        path: asset.path,
        objectKey: asset.objectKey,
        dbSha256: asset.contentSha256,
        actualSha256: actualSha,
        sizeBytes: stored.length,
        contentType: asset.contentType,
        ok: actualSha === asset.contentSha256 && stored.length === Number(asset.sizeBytes),
      });
    }
    return { runtimeId: runtime.id, state: runtime.state, assets: report, allOk: report.every((entry) => entry.ok) };
  }

  // Exposed so tests can drive individual phases (stale-worker scenarios).
  const phases = { beginAttempt, uploadStaged, verifyStaged, promoteFinal, finalizePublication, markFailed };

  return { publish, recover, findAttempt, getPublished, verifyPublishedAssets, phases };
}

function toPublicationError(error: unknown, code: RuntimePublicationErrorCode, fallback: string): RuntimePublicationError {
  if (error instanceof RuntimePublicationError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RuntimePublicationError(message || fallback, code);
}
