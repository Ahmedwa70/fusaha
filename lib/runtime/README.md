# Runtime Contract and Adapter Boundary

This module is an additive Phase 1 boundary. It is intentionally not imported by generation, dashboard rendering, public sharing, database code, or production routes.

## Minimum contract

A runtime package has:

- `manifest.contractVersion`: platform contract version.
- `manifest.runtimeId`: stable logical runtime identifier.
- `manifest.runtimeVersion`: implementation version supplied by the runtime owner.
- `manifest.packageKind`: `single-file` or `multi-file`.
- `manifest.entryPoint`: package-relative entry file.
- `manifest.capabilities`: explicitly declared platform capabilities.
- `manifest.assets`: optional package asset metadata and integrity values.
- `files`: package-relative file content.

Lesson data is represented separately as `RuntimeLessonData`. The contract does not embed lesson content into runtime files and does not execute HTML or JavaScript.

## Adapter responsibilities

An adapter converts one template implementation into the common package shape. It must:

1. Preserve the implementation's files without imposing visual structure.
2. Declare the entry point and capabilities.
3. Produce deterministic package metadata.
4. Validate package completeness and supported contract values.
5. Avoid network calls, database access, credential access, and runtime execution.

The current `htmlPlayerAdapter` wraps the repository's existing HTML player as `index.html`. It does not change `composePlayerHtml` and is not connected to production rendering.

## Identity and versioning

`getRuntimeIdentity` computes a deterministic SHA-256 identity over canonical manifest data and sorted package files. Manifest keys, metadata keys, capabilities, assets, and file paths are normalized before hashing. Any executable content or contract metadata change produces a different identity.

The identity is an in-memory/content identity for Phase 1. It is not persisted to the database and does not create a runtime registry.

## Extension examples

### Single-file HTML player

```ts
const runtime = htmlPlayerAdapter.createPackage({
  runtimeId: "html-player",
  runtimeVersion: "1.0.0",
  htmlPlayer: "<!doctype html><html><body><main id=app></main></body></html>",
});
```

The adapter exposes one `index.html` entry point and the `lesson-data` capability.

### Multi-file canvas runtime

A future adapter could create a package with `index.html`, `runtime.js`, `styles.css`, and declared assets. It would implement the same `RuntimeAdapter` shape, set `packageKind` to `multi-file`, and choose `index.html` as its entry point. The core lesson, database, and sharing contracts would not need to know how the runtime draws its canvas.

```ts
const runtime = canvasAdapter.createPackage({
  runtimeId: "canvas-activity",
  runtimeVersion: "2.0.0",
  files: {
    "index.html": "...",
    "runtime.js": "...",
    "styles.css": "...",
  },
  assets: [],
});
```

A future adapter may support a different structure, but it must still return a validated `RuntimePackage` and remain isolated from application persistence.

## Registry storage

`RuntimePackageRegistry` is the Phase 2 storage boundary. Its default `InMemoryRuntimePackageStore` is intentionally local and process-scoped because this phase forbids database migrations, production writes, and new external infrastructure. The store interface is small enough to back with an approved persistent repository in a later phase without changing identity, validation, or retrieval semantics.

Registration validates the package, calculates its identity, reuses an existing identical package, and stores a defensive clone. There is no update operation. A different package receives a different identity; a package stored under a mismatched identity is rejected on retrieval. `get` and `has` recalculate the full package identity before returning, so corrupted contents are detected.

The package identity is independent of template IDs, schema IDs, lesson IDs, and user IDs. It covers canonical manifest metadata and every sorted package file. Asset integrity and declared UTF-8 byte sizes are checked before registration.

## Lesson-version runtime binding

There are two binding layers, kept deliberately separate:

1. **`lesson-version-binding.ts` — the in-memory Phase 1 boundary** (below). It
   demonstrates the state machine against the pre-freeze `sha256-<hex>` v0
   content identity and is not persisted anywhere.
2. **`lesson-version-runtime-binding.ts` — the DB-backed Phase 3 service.**
   It operates on the immutable runtime registry schema (migration
   `0023_runtime_versions.sql`, design doc `RUNTIME_VERSION_SCHEMA_DESIGN §3.6`)
   and binds an approved lesson version to a **published** runtime by its
   frozen V1 content identity (`sha256-v1-<64 hex>`, ADR §8). It validates
   identity format, requires `state = Published`, enforces binding immutability
   with a conditional UPDATE race guard (concurrent binds of different
   runtimes yield exactly one winner), writes an `audit_logs` entry per state
   change, and resolves through an explicit `template-fallback` mode for
   `Unbound` rows — while `Quarantined`/`Unrecoverable` rows fail closed in the
   resolver and in the reconciliation report. Field naming is identical across
   ADR §5.4/§5.5, the design doc, the Drizzle schema, migration 0023, and the
   POC adapter (`identity`, `identity_algorithm`, `runtime_identity`,
   `idempotency_key`, `request_fingerprint`, `runtime_version_id`,
   `runtime_binding_status`); the v0 identity above is intentionally not
   reused by the DB path.

The in-memory service binds one lesson version to one exact runtime identity. The binding records:

- `lessonVersionId`: the version-level owner of the reference.
- `status`: `bound` or explicit `legacy-unbound`.
- `runtimeIdentity`: the content identity returned by `RuntimePackageRegistry` when bound.
- `contractVersion`: the exact runtime contract expected by the binding.
- `reason`: required only for a legacy/unbound state.

Binding validates that the runtime exists, passes registry integrity checks, and exposes the expected contract version. A binding is immutable after its first established state. Reasserting the same bound identity is idempotent; assigning a different runtime or replacing a legacy/unbound state is rejected. Resolving a legacy/unbound version returns no runtime rather than silently selecting the current template or generating a replacement.

The model intentionally contains no lesson ID, template ID, or schema-definition ID. Those identities remain separate domain concerns. The binding only establishes the exact runtime required by a specific lesson version.

Existing lesson versions are represented as `legacy-unbound` until future backfill has verified evidence of the exact historical runtime. This phase does not assign those states in production and does not claim that current lesson versions are runtime-independent.

## Persistent storage boundary

Phase 3 uses `InMemoryLessonVersionRuntimeBindingStore` only. `LessonVersionRuntimeBindingStore` is the persistence boundary for a later approved database implementation. A future repository must provide atomic insert-if-absent semantics, read-by-lesson-version, a unique lesson-version constraint, immutable update behavior, and a foreign-key/reference check against the persistent runtime registry. The future migration must be expand/backfill/contract and must not infer historical runtime identity from a mutable current template row.

Phase 4 defines `PersistentRuntimePackageStore` and `PERSISTENT_RUNTIME_STORE_CONTRACT` in `persistent-store.ts`, but the production adapter remains blocked. The repository uses PostgreSQL through Drizzle (`lib/db/index.ts`), while this session has no connected Supabase/database integration and no verified isolated staging database. No `DATABASE_URL` connection, table creation, migration, data write, or production credential use is permitted by this phase gate.

A production adapter must use a transactional or compare-and-swap `putIfAbsent` operation. It must stage the complete manifest and all files, verify package identity before publication, publish atomically, hide incomplete writes, never overwrite an existing identity, and return the already-published package for an identical concurrent registration. Runtime deletion is not part of registration and is permitted only after reference reconciliation confirms no lesson-version references; the default policy requires explicit approval and prevents deletion of referenced packages.

The application generation and rendering paths do not import this binding service or persistent-store contract yet. Production integration belongs to a later phase after persistent runtime storage, staging data inventory, historical recovery evidence, and database migration approval are available.

## Testing the DB-backed binding service

`lesson-version-runtime-binding.test.ts` runs against a real PostgreSQL created by applying repo migrations `0001`–`0023` to a disposable database — never the project `DATABASE_URL`:

```sh
RUNTIME_BINDING_TEST_DATABASE_URL='postgres://<user>:<password>@127.0.0.1:<port>/<db>' \
  node --experimental-transform-types --experimental-test-module-mocks --test \
  lib/runtime/lesson-version-runtime-binding.test.ts
```

Without the variable the suite skips itself. `--experimental-transform-types` is required because `database/schema/enums.ts` uses TypeScript enums (strip-only mode cannot execute them), and `lesson-version-runtime-binding.test-hooks.mjs` redirects the `@/` tsconfig aliases plus `schema_definitions` (which imports `@/i18n/config`) to Node-resolvable test doubles.

## Phase 4 — controlled cutover resolver

`lesson-play-resolution.ts` is the single place both render paths — the
authenticated dashboard play route and the anonymous public share route — decide
which player HTML a lesson version gets. The play queries in
`lib/dashboard/queries/lesson.ts` keep their authorization scoping (owner /
share token) and now stop joining `templates`; the resolver decides:

- **Flag off** (`RUNTIME_RESOLVER_CUTOVER_ENABLED` unset): legacy template HTML,
  byte-identical to the pre-cutover behavior. The templates join moved behind
  an explicit fetch that preserves the old inner-join semantics (no linked
  template → 404).
- **Flag on + Bound/Legacy**: entry-point bytes come from `runtime-entry-content.ts`
  (S3-compatible GET, dependency-free SigV4, verified against the recorded
  content SHA-256 — never the ETag). The mutable template row is never read for
  a bound version.
- **Flag on + Unbound**: explicit, logged `template-fallback` mode — historical
  lessons render exactly as before, observably.
- **Flag on + Quarantined/Unrecoverable**: fail closed (null → 404), never a
  template fallback.

Rollback is instantaneous and data-preserving: unsetting the flag returns every
path to the template without a reverse migration and without touching stored
bindings. Storage wiring is env-driven (`RUNTIME_CONTENT_S3_ENDPOINT`,
`RUNTIME_CONTENT_S3_ACCESS_KEY`, `RUNTIME_CONTENT_S3_SECRET_KEY`); until it is
configured, runtime reads fail closed instead of guessing a provider.

Tests: `lesson-play-resolution.test.ts` (decision table, injected fakes) and
`lesson-play-cutover.test.ts` (real migrated database; includes an end-to-end
S3 read against live object storage when the `RUNTIME_CONTENT_*` variables are
set).

## Phase 5 — runtime publication and the approval lifecycle

Phase 5 closes the loop between the POC publication protocol and lesson
approval: approving a lesson version publishes its runtime package and binds
the version to it, through the production schema.

- **`runtime-identity-v1.ts`** — the faithful TypeScript port of the frozen
  reference (`poc/runtime-persistence/runtime-identity-v1.mjs`). It computes
  Runtime Identity V1 (`runtime-package/v1`) byte-for-byte identically;
  `runtime-identity-v1.test.ts` reproduces every frozen vector from
  `identity-vectors.json` and cross-checks the port against the reference
  module at runtime.
- **`s3-sigv4.ts`** — the single dependency-free SigV4 implementation for the
  whole module (reads and writes sign identically). `runtime-entry-content.ts`
  was refactored onto it without behavior change.
- **`runtime-content-store.ts`** — the write-side storage boundary:
  write-once `putIfAbsent` (`If-None-Match: *`; identical bytes are an exact
  dedupe, different bytes at a content-addressed key are a hard conflict) and
  `get`. Configuration is env-driven (`RUNTIME_CONTENT_S3_*` plus the publish
  target `RUNTIME_CONTENT_S3_BUCKET`); unconfigured stores fail closed.
- **`runtime-publication.ts`** — the production port of the POC publisher onto
  the app schema with smallint state enums: durable idempotency
  (`unique(idempotency_key)`, F2 fingerprint-conflict rejection with zero
  side effects), staging upload → independent SHA-256 verification →
  content-addressed final promotion → conditional finalization behind the
  ADR §7.3 fencing guard. Recovery seizes only expired/failed leases with a
  fresh fencing token; failed attempts record `Failed` on the attempt and the
  still-Pending version; retries (fresh key or `recover`) converge because
  storage keys are content-addressed and every DB write is conditional.
- **`lesson-approval-publishing.ts`** — the orchestrator wired into
  `actions/lessons.ts#approveLesson`. Ordering: publish first (stable
  idempotency key `lesson-approve:<lessonVersionId>` — publishing does not
  require the Approved state), then the unchanged approval transaction, then
  the Phase 3 binding. A bind failure compensates by restoring the version to
  Draft and the lesson to its exact pre-approval state; the published runtime
  stays published and unreferenced (deduplicated on retry). When the version
  has no template player or storage is not configured, approval falls back to
  the legacy behavior with a logged warning — production deployments without
  storage wiring behave exactly as before Phase 5.

Tests: `runtime-publication.test.ts` (real migrated disposable database +
injected store; includes a live SeaweedFS end-to-end when the
`RUNTIME_CONTENT_*` variables are set) and `lesson-approval-publishing.test.ts`
(publish → approve → bind, publish-failure isolation, bind-failure
compensation, idempotent retry, earlier-runtime immutability).

## Phase 6 — historical lesson runtime classification & migration

`historical-runtime-classification.ts` classifies every historical lesson
version into exactly one deterministic class — never by guessing:

- **Evidence model** — E1: player bytes still resolvable from the template
  (`schema_definition.template_id` present); E2: immutability evidence
  (`templates.updated_at <= lesson_versions.created_at` — conservative: any
  later template edit forfeits the evidence); E3: an explicit, logged operator
  legacy decision.
- **Classes** — E1 ∧ E2 → `bound-candidate` (rebind to a freshly published,
  content-addressed runtime); E1 ∧ ¬E2 ∧ E3 → `legacy-decision` (bind with the
  recorded reason); E1 ∧ ¬E2 ∧ ¬E3 → `quarantined-conflict` (human review);
  ¬E1 → `quarantined-gap`; `unrecoverable` is unreachable on schema-healthy data
  and stays a defensive class; drafts are out of scope; rows already classified
  (Bound/Legacy/Quarantined/Unrecoverable) are reported, never reclassified.
  A legacy decision without a reason is rejected loudly by the applier — the
  classifier fails closed, never inventing evidence.
- **Three entry points** — `classifyHistoricalLessonVersions` (read-only
  inventory + counts + integrity violations, e.g. a Bound row pointing at a
  runtime that never reached Published), `planHistoricalRuntimeMigration`
  (dry run: zero writes, per-template publication groups showing how many
  distinct runtimes publication would create — one per distinct player,
  deduplicated content-addressed), `applyHistoricalRuntimeMigration`
  (writes, disposable/staged databases only — the caller owns the environment
  gate; reruns are safe and idempotent).
- **Safety gate** — proven in tests: no lesson version lost or created, no
  content bytes changed, no approvals touched, share links untouched, nothing
  bound without evidence, and classified rows are never converted back.

Scope note: this was executed on a disposable database seeded with synthetic
versions covering every evidence combination. Running the inventory against
real production data — and approving legacy decisions — requires a human
decision, not an agent.

Tests: `historical-runtime-classification.test.ts` (real migrated disposable
database; requires its own clean database — other DB suites assume a fresh
schema and must not share a database with this one).

## Phase 7 — template independence

`template-independence.test.ts` closes the loop the whole protocol was
building toward: a Bound lesson version plays **exclusively** from its
published runtime. On a real migrated disposable database + live object
storage it proves:

- approve → publish → bind → play, then **hard-deleting the Template row**
  (schema FK unlinked first — `schema_definitions.template_id` is
  `ON DELETE RESTRICT`): resolution, storage reads, and
  `assemblePlayableLesson` all keep serving the identical published bytes;
- with the flag off and the template gone, the legacy path 404s — the
  runtime path was the only thing keeping the lesson alive;
- mutating the mutable template row after binding changes nothing
  (identity-pinned, no republication, same manifest hash);
- a multi-file package (entry + JS + CSS) survives template deletion with
  every asset's SHA-256 re-verified against live storage;
- sibling versions of other lessons on other templates are unaffected.

Browser-route verification (Phase 7): the anonymous public share route
`/l/[token]/frame` was exercised against a real `next dev` server — bound
version with deleted template serves runtime HTML (200), unbound historical
serves the template explicitly, quarantined fails closed (404), and
disabling `RUNTIME_RESOLVER_CUTOVER_ENABLED` rolls every path back to the
legacy behavior instantly. The authenticated dashboard route runs through
the same central `assemblePlayableLesson` and was covered by unit and
integration tests; an end-to-end authenticated browser session requires the
project's Supabase backend, which is outside the POC's allowed boundaries.

## Error handling

`validateRuntimePackage` returns structured issues instead of throwing for expected contract violations. It reports invalid contract/version values, empty or missing entry points, unsupported capabilities, and manifest assets missing from the package. `RuntimePackageRegistry` adds clear errors for invalid packages, missing identities, identity conflicts, and corrupted stored packages. `LessonVersionRuntimeBindingService` adds clear errors for missing/nonexistent runtimes, contract mismatches, invalid legacy reasons, and reassignment attempts. Callers decide whether a validation result is a warning or a publication blocker in a later phase.
