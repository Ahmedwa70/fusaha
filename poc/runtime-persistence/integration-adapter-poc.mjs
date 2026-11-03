// Real Integration Adapter POC: binds the Runtime Persistence publication
// protocol to PostgreSQL (runtime_poc schema) and SeaweedFS (S3 API).
//
// Guarantees implemented per PERSISTENT_RUNTIME_STORAGE_ADR.md:
// - No-overwrite object creation via If-None-Match: * (provider-level).
// - Content integrity verified with an independent SHA-256, never ETag alone.
// - A Runtime becomes visible only after every asset is uploaded, verified,
//   and the publication transaction commits.
// - Crash recovery with monotonically increasing fencing tokens; recovery is
//   idempotent because final object keys are content-addressed and both the
//   storage writes and the database publication are conditional.
//
// POC simplifications (documented, not hidden):
// - Lease expiry is enforced in the conditional fencing guard of
//   finalizePublication (ADR §7.3), and recover() only seizes an attempt whose
//   lease expired (or that already reported 'failed'); there is no
//   background reaper that expires abandoned attempts, so a crashed worker's
//   attempt stays unreachable until its lease lapses.
// - Concurrency safety comes from PostgreSQL row locks plus the fencing
//   guard; no cross-process stress beyond the tests in this directory.

import { createHash, randomUUID } from "node:crypto";
import { IDENTITY_ALGORITHM } from "./runtime-identity-v1.mjs";

const delay = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function createPgS3RuntimeStore({ sql, s3, bucket, provider = "seaweedfs-poc", stagingPrefix = "adapter-staging" }) {
  // Single source of truth: the frozen identity contract (runtime-identity-v1.mjs).
  const algorithm = IDENTITY_ALGORITHM;

  async function getPublished(identity) {
    const [version] = await sql`
      SELECT id, identity, state, manifest, manifest_sha256, published_at
      FROM runtime_poc.runtime_versions
      WHERE identity_algorithm = ${algorithm} AND identity = ${identity}`;
    if (!version) return null;
    const assets = await sql`
      SELECT a.path, a.content_sha256, a.content_type, a.size_bytes, o.object_key, o.bucket
      FROM runtime_poc.runtime_assets a
      JOIN runtime_poc.runtime_storage_objects o ON o.id = a.storage_object_id
      WHERE a.runtime_version_id = ${version.id}
      ORDER BY a.path`;
    return { ...version, assets };
  }

  // Marks an attempt failed, but only if this worker still owns the current
  // fencing token and the attempt has not reached a terminal state. A stale
  // worker that errors late must not downgrade an attempt that another worker
  // already re-leased or published (conditional update per ADR §7.3).
  async function markFailed(attemptId, token, message) {
    await sql`
      UPDATE runtime_poc.runtime_publication_attempts
      SET state = 'failed', updated_at = now()
      WHERE id = ${attemptId}
        AND fencing_token = ${token}
        AND state NOT IN ('published', 'quarantined')`;
    const error = new Error(message);
    error.attemptId = attemptId;
    return error;
  }

  // Creates (or re-leases) the attempt row and locks the runtime version row.
  // A lease lasts leaseSeconds from acquisition; re-leasing (same idempotency
  // key) extends the lease and increments the fencing token, which fences any
  // earlier holder of the same attempt.
  // Returns alreadyPublished when the runtime was published by someone else.
  async function beginAttempt(packageData, idempotencyKey, expectedAssetCount, packageSizeBytes, leaseSeconds = 30) {
    const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000);
    return sql.begin(async (tx) => {
      await tx`
        INSERT INTO runtime_poc.runtime_versions
          (id, identity, identity_algorithm, state, manifest, manifest_sha256, asset_count, package_size_bytes)
        VALUES
          (${randomUUID()}, ${packageData.identity}, ${algorithm}, 'pending', ${tx.json(packageData.manifest)},
           ${packageData.manifestSha256}, ${expectedAssetCount}, ${packageSizeBytes})
        ON CONFLICT (identity_algorithm, identity) DO NOTHING`;
      const [version] = await tx`
        SELECT id, state FROM runtime_poc.runtime_versions
        WHERE identity_algorithm = ${algorithm} AND identity = ${packageData.identity}
        FOR UPDATE`;
      if (version.state === "published") return { alreadyPublished: true, versionRowId: version.id };
      const [attempt] = await tx`
        INSERT INTO runtime_poc.runtime_publication_attempts
          (id, runtime_version_id, idempotency_key, request_fingerprint, state, staging_namespace,
           expected_asset_count, expected_package_size_bytes, fencing_token, lease_expires_at)
        VALUES
          (${randomUUID()}, ${version.id}, ${idempotencyKey}, ${packageData.identity}, 'created', ${stagingPrefix},
           ${expectedAssetCount}, ${packageSizeBytes}, 1, ${leaseExpiresAt})
        ON CONFLICT (idempotency_key) DO UPDATE SET
          fencing_token = runtime_poc.runtime_publication_attempts.fencing_token + 1,
          state = 'leased',
          lease_expires_at = ${leaseExpiresAt},
          updated_at = now()
        RETURNING id, fencing_token, request_fingerprint`;
      // Finding F2 (design doc §11.2 / ADR §9.1 step 3): an idempotency key is
      // the caller's retry identity for ONE logical request. Reusing it with a
      // different package must fail with an idempotency conflict and no side
      // effects — throwing here rolls the whole transaction back (the version
      // upsert above is undone too), so a hijacked attempt row is impossible.
      if (attempt.request_fingerprint !== packageData.identity) {
        const error = new Error("idempotency key reused for a different package fingerprint");
        error.code = "IDEMPOTENCY_CONFLICT";
        throw error;
      }
      return { alreadyPublished: false, versionRowId: version.id, attemptId: attempt.id, token: attempt.fencing_token };
    });
  }

  async function uploadStaged(packageData, attemptId, token, delayMs) {
    const stagingKeys = new Map();
    for (const [path, bytes] of packageData.files) {
      await delay(delayMs);
      const key = `${stagingPrefix}/${attemptId}/${token}/${path}`;
      await putNoOverwrite(key, bytes, contentTypeFor(path));
      stagingKeys.set(path, key);
    }
    return stagingKeys;
  }

  async function verifyStaged(packageData, stagingKeys) {
    for (const [path, bytes] of packageData.files) {
      const staged = await s3.getObject(bucket, stagingKeys.get(path));
      if (!staged.body.equals(bytes) || sha256Hex(staged.body) !== sha256Hex(bytes)) {
        throw new Error(`staged hash mismatch: ${path}`);
      }
    }
  }

  async function promoteFinal(packageData) {
    const finalKeys = new Map();
    for (const asset of packageData.manifest.assets) {
      const bytes = packageData.files.get(asset.path);
      // Content-addressed key: re-promotion after a crash dedupes via 412.
      const key = `runtime/${packageData.identity}/${asset.contentSha256}`;
      await putNoOverwrite(key, bytes, asset.contentType);
      finalKeys.set(asset.path, key);
    }
    return finalKeys;
  }

  async function putNoOverwrite(key, bytes, contentType) {
    try {
      await s3.putObject(bucket, key, bytes, { contentType, ifNoneMatch: "*" });
    } catch (error) {
      if (error.code === "PreconditionFailed") {
        const existing = await s3.getObject(bucket, key);
        if (!existing.body.equals(bytes)) throw new Error(`object key conflict with different bytes: ${key}`);
        return; // same bytes already stored: exact dedupe
      }
      throw error;
    }
  }

  // Conditional DB publication. Safe to re-run after a crash: every statement is
  // an upsert gated on the version row state, so partial states converge.
  //
  // ADR §7.3 fencing guard (runs first, inside the same transaction): the worker
  // must still hold the current fencing token and an unexpired lease. A zero-row
  // update means this worker is stale or fenced; it must stop and must not
  // write final metadata. The error code is "FENCED".
  async function finalizePublication(versionRowId, attemptId, token, packageData, finalKeys) {
    return sql.begin(async (tx) => {
      const [guard] = await tx`
        UPDATE runtime_poc.runtime_publication_attempts
        SET state = 'finalizing', updated_at = now()
        WHERE id = ${attemptId} AND fencing_token = ${token} AND lease_expires_at > now()
        RETURNING id`;
      if (!guard) {
        throw Object.assign(new Error("worker fenced: fencing token mismatch or lease expired"), { code: "FENCED" });
      }
      const [version] = await tx`
        SELECT id, state FROM runtime_poc.runtime_versions WHERE id = ${versionRowId} FOR UPDATE`;
      if (version.state === "published") return { publishedByOther: true };
      for (const asset of packageData.manifest.assets) {
        const [object] = await tx`
          INSERT INTO runtime_poc.runtime_storage_objects
            (id, content_sha256, size_bytes, content_type, state, provider, bucket, object_key)
          VALUES
            (${randomUUID()}, ${asset.contentSha256}, ${asset.sizeBytes}, ${asset.contentType},
             'available', ${provider}, ${bucket}, ${finalKeys.get(asset.path)})
          ON CONFLICT (provider, bucket, object_key) DO UPDATE SET
            state = 'available', verified_at = now()
          RETURNING id`;
        await tx`
          INSERT INTO runtime_poc.runtime_assets
            (id, runtime_version_id, storage_object_id, path, content_sha256, content_type, size_bytes)
          VALUES
            (${randomUUID()}, ${versionRowId}, ${object.id}, ${asset.path},
             ${asset.contentSha256}, ${asset.contentType}, ${asset.sizeBytes})
          ON CONFLICT (runtime_version_id, path) DO NOTHING`;
      }
      const [updated] = await tx`
        UPDATE runtime_poc.runtime_versions
        SET state = 'published', published_at = now()
        WHERE id = ${versionRowId} AND state = 'pending'
        RETURNING id`;
      if (!updated) return { publishedByOther: true };
      await tx`
        UPDATE runtime_poc.runtime_publication_attempts
        SET state = 'published', fencing_token = ${token}, updated_at = now()
        WHERE id = ${attemptId}`;
      return { publishedByOther: false };
    });
  }

  async function publish(packageData, idempotencyKey, { crashAfter = null, delayMs = 1, leaseSeconds = 30 } = {}) {
    const expectedAssetCount = packageData.manifest.assets.length;
    const packageSizeBytes = [...packageData.files.values()].reduce((total, bytes) => total + bytes.length, 0);

    const attempt = await beginAttempt(packageData, idempotencyKey, expectedAssetCount, packageSizeBytes, leaseSeconds);
    if (attempt.alreadyPublished) return getPublished(packageData.identity);

    try {
      const stagingKeys = await uploadStaged(packageData, attempt.attemptId, attempt.token, delayMs);
      if (crashAfter === "upload") throw await markFailed(attempt.attemptId, attempt.token, "simulated crash after staging upload");

      await verifyStaged(packageData, stagingKeys);
      if (crashAfter === "verify") throw await markFailed(attempt.attemptId, attempt.token, "simulated crash after verification");

      const finalKeys = await promoteFinal(packageData);
      if (crashAfter === "finalize") throw await markFailed(attempt.attemptId, attempt.token, "simulated crash before publication transaction");

      const result = await finalizePublication(attempt.versionRowId, attempt.attemptId, attempt.token, packageData, finalKeys);
      if (result.publishedByOther) return getPublished(packageData.identity);
      return getPublished(packageData.identity);
    } catch (error) {
      if (error.attemptId) throw error;
      if (error.code === "FENCED") {
        // A newer lease on the same idempotency key exists (a concurrent
        // identical submission). The logical request is the same, so converge
        // on the other worker's result instead of failing the caller.
        for (let retry = 0; retry < 20; retry += 1) {
          await delay(250);
          const settled = await getPublished(packageData.identity);
          if (settled && settled.state === "published") return settled;
        }
        throw error;
      }
      throw await markFailed(attempt.attemptId, attempt.token, error.message);
    }
  }

  function stagedKeysOf(packageData, attemptId, token) {
    const stagingKeys = new Map();
    for (const path of packageData.files.keys()) {
      stagingKeys.set(path, `${stagingPrefix}/${attemptId}/${token}/${path}`);
    }
    return stagingKeys;
  }

  // Re-leases an attempt and completes publication, per ADR §7.3/§9.4.
  // The seize is a single conditional UPDATE: recovery is allowed only when
  // the previous lease has expired, or the attempt already reported failure
  // ('failed' implies no live worker holds it). A zero-row update means the
  // lease is still validly held or the attempt is terminal: nothing is
  // changed and LEASE_HELD is thrown, so a live slow worker is never
  // preempted and its fencing token stays intact.
  async function recover(attemptRowId, packageData, { delayMs = 1, leaseSeconds = 30 } = {}) {
    const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000);
    const [attempt] = await sql`
      UPDATE runtime_poc.runtime_publication_attempts
      SET fencing_token = fencing_token + 1, state = 'leased', lease_expires_at = ${leaseExpiresAt}, updated_at = now()
      WHERE id = ${attemptRowId}
        AND state != 'published' AND state != 'quarantined'
        AND (lease_expires_at < now() OR state = 'failed')
      RETURNING id, runtime_version_id, fencing_token, state`;
    if (!attempt) {
      const [row] = await sql`
        SELECT state, lease_expires_at FROM runtime_poc.runtime_publication_attempts
        WHERE id = ${attemptRowId}`;
      if (!row) throw new Error(`attempt not found: ${attemptRowId}`);
      throw Object.assign(
        new Error(`attempt is not recoverable now (state=${row.state}); its lease must expire first`),
        { code: "LEASE_HELD" },
      );
    }
    const [version] = await sql`
      SELECT id, state FROM runtime_poc.runtime_versions WHERE id = ${attempt.runtime_version_id}`;
    if (version.state === "published") return getPublished(packageData.identity);

    // Re-run storage phases. Staging keys embed the fencing token, so recovery
    // writes a fresh staging set; final keys are content-addressed and dedupe.
    await uploadStaged(packageData, attempt.id, attempt.fencing_token, delayMs);
    await verifyStaged(packageData, stagedKeysOf(packageData, attempt.id, attempt.fencing_token));
    const finalKeys = await promoteFinal(packageData);
    const result = await finalizePublication(version.id, attempt.id, attempt.fencing_token, packageData, finalKeys);
    if (result.publishedByOther) return getPublished(packageData.identity);
    return getPublished(packageData.identity);
  }

  async function findAttempt(idempotencyKey) {
    const [attempt] = await sql`
      SELECT id, state, fencing_token, runtime_version_id
      FROM runtime_poc.runtime_publication_attempts
      WHERE idempotency_key = ${idempotencyKey}`;
    return attempt ?? null;
  }

  // Cross-check: every published asset row against the actual stored bytes.
  async function verifyPublishedAssets(identity) {
    const runtime = await getPublished(identity);
    if (!runtime || runtime.state !== "published") throw new Error("runtime is not published");
    const report = [];
    for (const asset of runtime.assets) {
      const stored = await s3.getObject(asset.bucket, asset.object_key);
      const actualSha = sha256Hex(stored.body);
      report.push({
        path: asset.path,
        objectKey: asset.object_key,
        dbSha256: asset.content_sha256,
        actualSha256: actualSha,
        sizeBytes: stored.body.length,
        contentType: stored.content_type,
        ok: actualSha === asset.content_sha256 && stored.body.length === Number(asset.size_bytes),
      });
    }
    return { runtimeId: runtime.id, state: runtime.state, assets: report, allOk: report.every((entry) => entry.ok) };
  }

  // Exposed so tests can drive individual phases (stale-worker scenarios) and
  // so separate OS processes can share the exact same publication protocol.
  const phases = { beginAttempt, uploadStaged, verifyStaged, promoteFinal, finalizePublication, markFailed };

  return { publish, recover, findAttempt, getPublished, verifyPublishedAssets, phases };
}

function contentTypeFor(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
