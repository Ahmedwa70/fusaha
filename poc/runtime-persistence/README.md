# Runtime Persistence POC

**Status:** Disposable technical proof of concept — **not a production implementation.**

This directory proves the publication protocol of `docs/architecture/PERSISTENT_RUNTIME_STORAGE_ADR.md` (§7–§9) on real infrastructure. It does not implement Runtime Versions inside the Fusaha application, does not touch application code, schema migrations, Supabase, Staging, or Production, and must not be pointed at any of them. Nothing here claims that the ADR requirements are complete; see "Remaining gaps" below.

## Layout

- `runtime-persistence-poc.mjs` — the original **in-memory model** of the publication state machine (pending/published/failed, idempotent registration, manifest identity). It simulates persistence; it is not database integration.
- `runtime-persistence-poc.test.mjs` — tests for the in-memory model (6/6 passing).
- `integration-adapter-poc.mjs` — **real integration adapter**: publication protocol over actual PostgreSQL + S3-compatible object storage. Imports the identity algorithm from the frozen V1 canonicalizer (single source of truth, no parallel identity path).
- `integration-adapter-poc.itest.mjs` — 10 integration tests against real services, including proof that the adapter publishes exactly the reference V1 identity for identical inputs and that idempotency-key reuse with a different package fails with no side effects (F2). Requires the integration environment running. **Not auto-discovered by `pnpm test`** (`.itest.mjs` suffix) — run it explicitly via `pnpm test:poc-integration` or `node --test integration-adapter-poc.itest.mjs`. See "Known issue" below.
- `lease-concurrency-poc.itest.mjs` — lease-expiry, fencing, recovery-eligibility, cross-process, and crash-recovery tests, all on V1 identities. Also requires the integration environment; also excluded from the default suite for the same reason.
- `publisher-process.mjs` — standalone publisher CLI used to run **real OS processes** against the same environment for cross-process tests; builds its package through the same V1 canonicalizer, so cross-process identity agreement is guaranteed by construction.
- `runtime-identity-v1.mjs` — frozen reference implementation of the `runtime-package/v1` identity contract (ADR §8, frozen 2026-11-01): byte mode, canonical JSON (UTF-8 byte-order keys), path normalization, content-type allowlist, framed hashing.
- `generate-identity-vectors.mjs` — regenerates `identity-vectors.json` from the reference implementation; every expected digest is computed, never hand-written.
- `identity-vectors.json` — the frozen V1–V7 vector spec: inputs (base64), canonical manifest, manifest SHA-256, identity, and equivalence/inequality relations.
- `identity-vectors-poc.test.mjs` — reproduces all frozen vectors byte-for-byte and asserts rejection rules (6/6 passing).
- `s3-client.mjs` — minimal S3 REST client with hand-rolled AWS SigV4 signing (`node:crypto` only, zero new dependencies).
- `integration-environment/` — disposable Docker environment (PostgreSQL 16 + SeaweedFS 4.48 S3 gateway). See its own README.

## Current adapter architecture

`createPgS3RuntimeStore({ sql, s3, bucket, ... })` implements the ADR publication flow end to end:

1. **Registration (`beginAttempt`)** — inside a transaction: upsert the Runtime row (`pending`), upsert the publication attempt by `idempotency_key` with `ON CONFLICT ... DO UPDATE SET fencing_token = fencing_token + 1`, and `SELECT ... FOR UPDATE` the version row so a concurrent publisher blocks instead of double-publishing. A retry with a different fingerprint under the same key fails as an idempotency conflict.
2. **Staging (`uploadStaged`)** — bytes are uploaded to an attempt-owned staging prefix.
3. **Verification (`verifyStaged`)** — every staged object is re-read; **SHA-256** of the returned bytes is compared against the manifest. The SeaweedFS ETag is never used as a content fingerprint (it is not guaranteed to be an MD5).
4. **Finalization (`promoteFinal`)** — final objects use content-addressed keys `runtime/{identity}/{content_sha256}` and are created with **`If-None-Match: *`** so the provider itself rejects any overwrite. A 412 on a key whose stored bytes already match is treated as deduplication, not failure.
5. **Publication (`finalizePublication`)** — one transaction that starts with the ADR §7.3 fencing guard: `UPDATE runtime_publication_attempts ... WHERE id AND fencing_token = $token AND lease_expires_at > now()`. A zero-row update throws `FENCED` — the worker is stale or its lease expired and it must stop. Then: conditional `UPDATE runtime_versions SET state='published' WHERE state='pending'`, then insert storage-object and asset rows. The Runtime becomes visible only after every object is verified and the transaction commits.

Leases are parameterized (`leaseSeconds`, default 30): acquisition and every re-lease (same `idempotency_key`, or `recover`) extend `lease_expires_at` and increment the fencing token. When `publish()` is fenced because a concurrent identical submission holds a newer lease on the same key, it converges on the other worker's published result instead of failing the caller.

`crashAfter: 'upload' | 'verify' | 'finalize'` simulates a process crash at that point (marks the attempt `failed` then throws), which is how the recovery tests work. `recover` re-acquires with an incremented fencing token and re-runs staging/finalization; because final keys are content-addressed, re-publishing is idempotent.

### How PostgreSQL and SeaweedFS are actually linked

- **PostgreSQL** (POC database `runtime_poc` on `127.0.0.1:55432`) is the source of truth for identity, state, attempts, and asset/object metadata (tables `runtime_versions`, `runtime_publication_attempts`, `runtime_storage_objects`, `runtime_assets`, created by `integration-environment/postgres/init-db.sql`).
- **SeaweedFS** (S3 API on `127.0.0.1:59000`) holds bytes only. `runtime_storage_objects` maps each logical object to a provider key; `runtime_assets` maps each runtime file path to a logical object.
- The link is the **content SHA-256 stored in PostgreSQL and recomputed from S3 bytes on every verification** — never the provider ETag.

## Integration test results

**Known issue (test 4, sequencing-dependent):** when the whole adapter suite runs in one process, test 4 ("two concurrent publishers converge") observes only **1 attempt row instead of the expected 2** — the second publisher's `beginAttempt` observes the version already `published` and takes the short-circuit path, which by design records no attempt row. The test **passes when run on its own** (`node --test --test-name-pattern '^4\.' integration-adapter-poc.itest.mjs`), and the convergence invariants it exists to prove hold in every observed run: exactly one `runtime_versions` row, both publishers returning the same runtime id, and byte-for-byte integrity (`verifyPublishedAssets` all-ok). No leaked transactions or connections remain afterwards. The production port (`lib/runtime/runtime-publication.ts`) has its own unit-level concurrency/stale-worker coverage, all passing. Root cause: test-isolation state carried by the shared pool/process from tests 1–3 — under investigation; do not treat a green full-suite run of this file as guaranteed until it is fixed.

| # | Test | Proves |
|---|---|---|
| 1 | Publish a Runtime and record it in PostgreSQL | end-to-end publish, rows in all four tables |
| 2 | Object exists and matches an independent SHA-256 | byte integrity, content-addressed keys |
| 3 | Overwrite of a published object is rejected | provider-level `If-None-Match: *` → 412 |
| 4 | Two concurrent publish attempts → one winner | row locking + fencing; one version, two attempts recorded |
| 5 | Crash after staging leaves nothing published | staged bytes survive; nothing visible |
| 6 | Recovery re-leases with a higher fencing token and publishes | crash recovery, monotonic fencing |
| 7 | PostgreSQL and storage are consistent after crash + recovery | storage-upload/DB-update divergence converges |
| 8 | Re-reading the published runtime returns every intact file | byte-for-byte round trip incl. `content_type` |
| 9 | Adapter publishes exactly the frozen V1 identity | independently reconstructed reference identity matches the stored runtime row (`identity_algorithm`, `manifest_sha256`, canonical manifest) and content-addressed storage keys |
| 10 | Idempotency key reuse with a different package | publishes A under key K, then B under K → `IDEMPOTENCY_CONFLICT`; the transaction rolls back completely: no `runtime_versions` row for B's identity, the attempt row still carries A's `request_fingerprint`, zero objects under B's namespace, A's publication byte-for-byte intact (closes design-doc finding F2 / ADR §9.1 step 3) |

Each run uses a unique `int-a-<timestamp>` / `lease-a-<timestamp>` identity prefix, so runs are independent and no cleanup is required for correctness.

## Lease, fencing, and cross-process results (7/7 passing)

| # | Test | Proves |
|---|---|---|
| 1 | Expired lease is refused at finalize | `FENCED` after `lease_expires_at`; rollback leaves runtime `pending` and the attempt row untouched; recovery publishes afterwards |
| 2 | Stale fencing token cannot finalize after re-lease | a worker holding a superseded token is refused even though its lease was acquired first; exactly one published runtime |
| 3 | Two real OS processes, one idempotency key | `publisher-process.mjs` spawned twice concurrently: both exit 0 and resolve the same runtime; one version row, one attempt (token fenced to the re-lease), 3 distinct content-addressed objects, SHA-256 verified |
| 4 | Two real OS processes, two idempotency keys | 2 attempt rows converge on 1 runtime, exactly 1 attempt recorded `published`, no duplicate publish |
| 5 | Worker crash after staging, recovered after lease lapse | SIGKILL-style stop → `recover()` is refused while the dead worker's lease is still valid (`LEASE_HELD`, token unchanged); after expiry it re-leases with token 2 and publishes; PostgreSQL and storage agree byte-for-byte |
| 6 | Recovery eligibility: lease-valid worker cannot be preempted | recovery refused while the first worker's lease is valid (no token change); after expiry recovery succeeds (token 2), the first worker's late finalize is `FENCED`, and the second worker publishes exactly one runtime |

`recover()` seizes an attempt with a single conditional `UPDATE ... WHERE id AND state NOT IN ('published','quarantined') AND (lease_expires_at < now() OR state = 'failed')`. A zero-row update throws `LEASE_HELD` and changes nothing, so a live slow worker is never preempted and a crashed one stays unreachable only until its lease lapses. The `'failed'` exception keeps crash-marked attempts immediately recoverable.

These complement the adapter suite: the 10 tests prove the protocol phases on one process; these 6 prove lease expiry, stale-worker fencing, recovery eligibility, and real cross-process convergence.

## Reproducing

Prerequisites: the integration environment running (see `integration-environment/README.md`) and Node able to resolve the repo's existing `postgres` dependency.

```sh
cd poc/runtime-persistence

# in-memory model only (no services needed)
node --test runtime-persistence-poc.test.mjs

# real integration tests (require POC postgres + SeaweedFS up)
node --test integration-adapter-poc.itest.mjs

# lease / fencing / cross-process tests (spawn real child processes)
node --test lease-concurrency-poc.itest.mjs
```

Or from the repo root: `pnpm test:poc-integration` runs both live-infra suites. They are intentionally excluded from the default `pnpm test` discovery: they require the disposable Docker environment, touch real services, and must never run against any non-POC database.

The tests read credentials exclusively from `integration-environment/.env.integration` (mode 600, git-ignored) and connect to `127.0.0.1` only. They never read `.env`, `DATABASE_URL`, or any Fusaha/Supabase credential.

## Mechanisms demonstrated (ADR §7–§9)

- **Idempotency** — unique `idempotency_key` on attempts; fingerprint conflict detection; content-addressed dedupe on 412.
- **Fencing & lease expiry** — monotonic `fencing_token` incremented on every lease/re-lease; `finalizePublication` refuses workers with a superseded token or an expired lease (`FENCED`, ADR §7.3), proven by tests 1–2 of the lease suite.
- **Cross-process convergence** — two real OS processes publishing the same package under one idempotency key resolve to exactly one published runtime (lease suite test 3).
- **Failed-state recovery race** — `markFailed` is conditional (own fencing token, non-terminal state), so a stale worker can neither finalize nor downgrade an attempt that another worker already re-leased or published (lease suite test 7).
- **Frozen identity** — the `runtime-package/v1` contract is frozen with computed vectors V1–V7 (`identity-vectors.json`), including byte mode (V6/V6b) and byte placement (ADR §8.4): identity covers the canonical manifest plus exact file bytes; assets are content-addressed; dedupe is by identity and by content hash.
- **Write-once at the provider** — `If-None-Match: *` makes the storage layer itself refuse overwrites; the adapter never issues update/delete on published objects.
- **Integrity** — independent SHA-256 verification of bytes at staging, finalization, recovery, and read-back; ETag explicitly not trusted.
- **Crash recovery** — crash matrix rows "during staging", "after staging before publish", and "DB update divergence" converge to invisible-until-published or fully consistent, with no duplicated Runtime identity.
- **No premature visibility** — a Runtime is playable (queryable as `published`) only after all objects verify and the final transaction commits.

## Remaining gaps (not proven by this POC)

- **Background lease reaper** — expiry is enforced when a fenced worker tries to finalize, and `recover()` only seizes expired-lease (or `failed`) attempts, but nothing asynchronously expires abandoned attempts or reconciles `expired` state; recovery is explicit (`recover()`). A production reconciler still needs a reaper with bounded retries and quarantine on budget exhaustion (ADR §7.2/§9.4).
- **Crash detection latency** — a genuinely crashed worker's attempt cannot be recovered until its lease lapses (lease suite test 5), and a crashed-but-unmarked attempt and a slow worker look identical (no heartbeats). Shorter leases recover faster but risk fencing slow workers.
- **Cross-process scale** — cross-process convergence is proven with 2 concurrent processes and small packages; no high-contention stress (dozens of workers), no multi-file multipart.
- **Large packages / multipart uploads** — small fixtures only; multipart abort/incomplete behavior is configured in the bucket lifecycle but not exercised.
- **Delivery route** — the package-serving HTTP route from ADR §11 (`/runtime/v1/<id>/<path>` with authorization, `nosniff`, cache policy) is not implemented by the adapter; the in-memory model's server is a simulation.
- **Identity wiring** — the storage adapter, its tests, the lease/concurrency tests, and the cross-process publisher all build packages through the frozen V1 canonicalizer. The only remaining v0-legacy path is the original in-memory `runtime-persistence-poc.mjs` model, deliberately kept as a labeled legacy simulation (ADR §8.1) — it never touches PostgreSQL or SeaweedFS.
- **Backup/restore reconciliation, provider migration, quarantine, collection, DLQ** — untested.
- **Supabase Storage verification** — the ADR's decision rule requires verifying Supabase Storage write-once/generation semantics before provider selection; this POC proves the *protocol* on S3-compatible storage only.
- **CSP/sandbox/postMessage delivery security** (ADR §11.4) — not in scope here.

## Isolation guarantees

- All resources are POC-local: ports `55432`/`59000`/`59001` bound to `127.0.0.1` only, private Docker network, POC-named volumes and bucket, synthetic fixtures only.
- No migration runs against the platform database; no application code imports this directory.
- `.env.integration` contains disposable credentials only, is excluded from Git, and must never be reused elsewhere.
