# Template Runtime Implementation Plan
## Safe Migration to Immutable Shared Runtime Versions

**Document ID:** FUSAHA-ARCH-TR-002  
**Related specification:** `docs/architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md`  
**Status:** Implementation plan — not an execution record  
**Scope:** Documentation and planning only  
**Date:** October 2026

---

## 1. Purpose and Planning Boundary

This plan converts the approved target architecture into an ordered, reversible implementation program for the current Fusaha repository.

This document does **not** authorize or perform:

- Application-code changes
- Database migrations
- Database writes or deletes
- Production-data access
- Infrastructure provisioning
- Deployment

The plan preserves the current Next.js App Router, React Server Actions, Drizzle/PostgreSQL schema, Supabase-compatible database access, Trigger.dev generation task, and existing HTML player model. It does not redesign unrelated lesson, billing, authentication, or navigation behavior.

---

## 2. Executive Decision Summary

### 2.1 Target outcome

A `lesson_version` must resolve the exact immutable runtime artifact used for its rendering without querying the mutable `templates` or `schema_definitions` records. Multiple lesson versions may reference the same runtime artifact. A runtime artifact may contain a multi-file package and must be addressable by an immutable ID and content identity.

### 2.2 Recommended implementation boundary

The first implementation should introduce a **runtime package registry and explicit lesson-version reference**, while preserving the existing template fields as the administrative/generation source during migration.

The target should not assume that every template is a single HTML document. The registry should support:

- The current `htmlPlayer` player as an initial adapter.
- Future packages containing HTML, CSS, JavaScript, manifests, and assets.
- A runtime adapter/contract version so player implementations can evolve independently.

### 2.3 Important correction to the architecture specification

The specification describes a runtime artifact as if the template is rendered into a complete runtime during lesson generation. The current repository does not do that:

- `templates` stores `html_player`, `blueprint`, and `validation_script`.
- `actions/generation.ts` passes `blueprint` and `validationScript` to the asynchronous AI generation task.
- The generated lesson content is stored in `lesson_versions.content`.
- The play and share queries later resolve `templates.html_player` and combine it with the approved lesson content.

Therefore, the safe first target is to snapshot/register the **player package and its execution contract**, not to rewrite the AI generation pipeline into a template compilation pipeline. A later package-build phase may add compilation/bundling only if heterogeneous templates require it.

This is a material implementation clarification, not a modification to the architecture specification.

---

## 3. Verified Current State

### 3.1 Database and domain model

Relevant repository files:

- `database/schema/templates.ts`
- `database/schema/schema-definitions.ts`
- `database/schema/lessons.ts`
- `database/schema/lesson-versions.ts`
- `database/schema/generation-events.ts`
- `database/schema/share-links.ts`

Verified facts:

1. `templates` stores mutable `html_player`, `blueprint`, `validation_script`, optional `preview_image`, `active`, and timestamps.
2. `schema_definitions.template_id` references the template with restrict semantics in the Drizzle definition.
3. `lessons` selects its playable version through `current_approved_version_id`.
4. `lesson_versions` stores `schema_definition_id`, JSONB `content`, status, version number, source type, and approval timestamps.
5. No `runtime_version_id` or runtime package entity was found in the inspected active schema.
6. `lesson_versions.lesson_id` uses cascade semantics in the Drizzle definition; `lesson_versions.schema_definition_id` uses restrict semantics.
7. Live database constraints, RLS policies, deployed rows, and production data were not inspected.

### 3.2 Generation path

Relevant files:

- `actions/generation.ts`
- `src/trigger/generate-lesson.ts`
- `lib/ai/generate-lesson.ts`
- `lib/admin/queries/template.ts`
- `lib/admin/queries/schema-definition.ts`

Current flow:

1. A teacher selects a schema definition.
2. The action resolves its template.
3. The action creates a lesson and draft lesson version with empty content.
4. The action passes schema content, template blueprint, and validation script to Trigger.dev.
5. The task generates and validates lesson JSON.
6. The task writes the result to `lesson_versions.content`.

No runtime artifact or immutable player snapshot is recorded on the lesson version.

### 3.3 Rendering and sharing paths

Relevant files:

- `lib/dashboard/queries/lesson.ts`
- `app/dashboard/lessons/[id]/run/page.tsx`
- `app/dashboard/lessons/[id]/run/frame/route.ts`
- `app/l/[token]/page.tsx`
- `app/l/[token]/frame/route.ts`
- `lib/templates/compose-player-html.ts`

Verified query behavior:

- `getApprovedLessonForPlay` joins `lessons -> lesson_versions -> schema_definitions -> templates` and returns `templates.html_player` with lesson content.
- `getApprovedLessonByShareToken` follows the same template-dependent join for public sharing.
- The current rendering path therefore depends on current administrative template availability and current `html_player` content.

### 3.4 Administrative lifecycle

Relevant files:

- `actions/templates.ts`
- `actions/schema-definitions.ts`
- `app/admin/templates/_components/templates-table.tsx`
- `app/admin/schema/_components/schema-definitions-table.tsx`

Template updates mutate the current template row. Template deletion performs an application-level linked-schema check before deleting. Existing lessons do not have an explicit runtime package reference that would protect them from future template changes.

---

## 4. Proposed Target Architecture

### 4.1 New conceptual entities

#### `runtime_versions`

One immutable shared runtime record. Proposed responsibilities:

- Stable UUID primary key.
- Content identity, preferably SHA-256 over a canonical package manifest and package bytes.
- Runtime contract/adapter version.
- Package entry point and package format.
- Immutable metadata and publication status.
- Optional source `template_id`/`template_version_id` for audit only.
- No rendering dependency on source template after publication.

#### `runtime_assets` or package storage manifest

Use only if the selected package format requires separate asset records. It must support:

- Logical asset identifier.
- Content hash.
- MIME type and size.
- Storage location or embedded-package path.
- Immutable association to `runtime_versions`.

The first phase should prefer the smallest storage model that supports the current HTML player. Object storage should not be introduced until package size or binary assets justify it.

#### `lesson_versions.runtime_version_id`

Required explicit reference from each lesson version to the exact runtime used for rendering. It belongs at lesson-version level because a lesson may have multiple historical versions using different runtimes.

### 4.2 Runtime package contract

The platform contract must standardize integration behavior, not visual design or internal framework. Every runtime adapter/package must declare:

- Entry point.
- Accepted lesson-data envelope.
- Player protocol and initialization function.
- Runtime contract version.
- Asset manifest and integrity identity.
- Sandbox/CSP requirements.
- Error reporting protocol.
- Browser/runtime requirements.
- Compatibility and migration metadata.

The current `htmlPlayer` should be wrapped by an adapter first. A future multi-file package can implement the same contract without changing lesson-domain tables.

### 4.3 Rendering target

Target resolution:

```text
lesson/share authorization
  -> approved lesson_version
  -> lesson_versions.runtime_version_id
  -> immutable runtime_versions package
  -> player/frame with lesson_versions.content
```

The target path must not join `templates` or `schema_definitions` for rendering. Those records may remain as audit/generation history until a separate retention decision is approved.

---

## 5. Ordered Implementation Phases

## Phase 0 — Baseline, Contract Freeze, and Inventory

### What changes

Documentation and test fixtures only. No runtime behavior changes.

### Why necessary

The current implementation has two important unresolved facts: historical template content is not captured on lesson versions, and the exact deployed database/RLS state is not verified. A migration must not begin without a measured inventory and rollback baseline.

### Affected components

- `database/schema/*`
- `lib/dashboard/queries/lesson.ts`
- `app/dashboard/lessons/[id]/run/*`
- `app/l/[token]/*`
- `lib/templates/compose-player-html.ts`
- Existing test setup

### Deliverables

- Inventory query/report for lesson versions, templates, schema definitions, approved lessons, share links, and missing/invalid references.
- Golden rendering fixtures for representative current templates.
- Explicit player input/output contract for the current `htmlPlayer` path.
- Decision record for whether historical recovery uses current template content, an available template snapshot, or a deliberately quarantined state.
- Baseline metrics: render success, share success, and query latency.

### Compatibility preservation

No production behavior changes. All existing queries and actions remain unchanged.

### Verification

- Repository tests pass.
- Fixture renders match current output.
- Every approved lesson is classified as recoverable, ambiguous, or unrecoverable.
- No migration proceeds if the inventory is incomplete.

### Gate to Phase 1

Approved inventory, rollback backup/restore procedure, and accepted historical recovery policy.

---

## Phase 1 — Runtime Contract and Adapter Boundary

### What changes

Add a design-level and testable runtime adapter boundary, without changing database persistence yet.

### Why necessary

The architecture must support heterogeneous templates and multi-file packages. Directly coupling the new registry to `htmlPlayer` would reproduce the current single-format assumption.

### Affected components

Proposed modules, names subject to repository conventions:

- `lib/runtime/types.ts`
- `lib/runtime/contract.ts`
- `lib/runtime/adapters/html-player.ts`
- `lib/runtime/manifest.ts`
- `lib/runtime/hash.ts`
- `lib/templates/compose-player-html.ts`
- Frame routes under `app/dashboard/lessons/[id]/run/frame/` and `app/l/[token]/frame/`

### Deliverables

- Runtime package type and manifest schema.
- Current HTML-player adapter that maps existing `templates.html_player` plus the current player protocol into the package contract.
- Canonical serialization rules for identity hashing.
- Security policy interface for sandbox/CSP requirements.
- Unit fixtures for single-file and multi-file package shapes.

### Compatibility preservation

The adapter is used only by tests or an opt-in internal resolver. Existing rendering continues to use the current path until Phase 4.

### Verification

- Same lesson data produces deterministic package identity.
- Different package content produces different identity.
- Two logically identical manifests hash identically.
- Contract rejects missing entry points, invalid manifests, and unsafe undeclared capabilities.

### Gate to Phase 2

Contract review approved, including package format, hashing inputs, sandbox policy, and whether runtime content is database-resident or object-backed.

---

## Phase 2 — Database Schema and Immutable Registry

### What changes

Introduce the runtime registry and lesson-version reference through a reviewed migration. This phase is intentionally not to be executed by this document.

### Why necessary

Rendering cannot become independent from mutable templates until the exact runtime artifact is persisted and referenced at lesson-version level.

### Affected components

Proposed schema files:

- `database/schema/runtime-versions.ts`
- `database/schema/runtime-assets.ts` if separate asset rows are approved
- `database/schema/lesson-versions.ts`
- `database/schema/index.ts`
- Migration directory and Drizzle metadata

Proposed columns/constraints:

- `lesson_versions.runtime_version_id` nullable during backfill, non-null after cutover.
- `runtime_versions.runtime_identity` unique.
- Immutable content/package fields.
- Publication/status fields.
- `runtime_version_id` foreign key with `ON DELETE RESTRICT`.
- Indexes for identity lookup and lesson-version resolution.

### Deliverables

- Schema migration with expand/backfill/contract compatibility.
- Registry insert-or-reuse transaction keyed by runtime identity.
- Immutability enforcement at application and database permission/policy level where available.
- Reference-safe deletion policy.
- Audit event definition for creation, publication, deprecation, and deletion attempts.

### Compatibility preservation

- `runtime_version_id` starts nullable.
- Existing template/schema foreign keys remain untouched.
- Existing rendering remains the fallback while backfill is incomplete.
- No template or schema is deleted as part of this phase.

### Verification

- Migration applies to a sanitized copy of the schema.
- Duplicate identity insertion is idempotent.
- Runtime mutation is rejected by the chosen enforcement layer.
- Runtime deletion is rejected while lesson-version references exist.
- Rollback restores the pre-phase schema without deleting source records.

### Gate to Phase 3

All active lesson versions are either mapped to a valid runtime or explicitly quarantined under the approved recovery policy. No runtime reference points to a mutable source row as its execution content.

---

## Phase 3 — Historical Backfill and Compatibility Resolver

### What changes

Populate immutable runtime references for existing lesson versions and add a resolver that prefers the new runtime reference and falls back only for explicitly classified legacy rows.

### Why necessary

Backward compatibility is the highest-risk part of the change. Existing lessons cannot simply be regenerated, and current records do not contain the historical template content needed for perfect reconstruction.

### Affected components

- Backfill script/job under a documented migration tooling location.
- Runtime registry service.
- `lib/dashboard/queries/lesson.ts`.
- Admin diagnostics for unmapped lessons.
- Generation-event/audit reporting.

### Deliverables

- Idempotent backfill operation with checkpoints.
- Mapping report: mapped, reused, ambiguous, failed.
- Runtime resolver with explicit `legacy` mode and telemetry.
- No silent fallback: every legacy rendering event is observable.
- Reconciliation query comparing reference counts with actual lesson-version rows.

### Compatibility preservation

- Do not delete or mutate templates.
- Preserve current output for rows that can be reconstructed.
- Keep legacy fallback available until Phase 5 acceptance is complete.
- Do not mark `runtime_version_id` non-null until all allowed legacy cases have an approved disposition.

### Verification

- Backfill can be safely rerun.
- Reference counts equal actual references.
- Golden fixtures render identically before and after resolution.
- Public share links render for all mapped historical lessons.
- Failed mappings are visible and do not silently become playable.

### Gate to Phase 4

Zero unclassified approved lessons; all public share links have a verified rendering path; rollback to legacy resolver is tested.

---

## Phase 4 — Rendering Cutover for Dashboard and Public Sharing

### What changes

Change both authenticated play and public share paths to resolve runtime from `lesson_versions.runtime_version_id`.

Target files:

- `lib/dashboard/queries/lesson.ts`
- `app/dashboard/lessons/[id]/run/page.tsx`
- `app/dashboard/lessons/[id]/run/frame/route.ts`
- `app/l/[token]/page.tsx`
- `app/l/[token]/frame/route.ts`
- `lib/templates/compose-player-html.ts` or its runtime replacement

### Why necessary

Both current paths explicitly join `schema_definitions` and `templates`; this is the dependency the architecture is intended to remove.

### Deliverables

- Dashboard resolver: approved lesson version -> runtime package.
- Public resolver: authorized share token -> approved lesson version -> runtime package.
- Runtime/player frame integration that passes lesson content through the approved contract.
- Temporary feature flag or resolver switch for rollback.
- Structured errors for missing runtime, invalid package, or failed initialization.

### Compatibility preservation

- Authorization rules remain unchanged.
- Share-token authorization remains unchanged.
- Lesson approval semantics remain unchanged.
- Legacy fallback remains available behind an explicit operational switch.

### Verification

- Rendered dashboard and public fixtures match expected output.
- Deleting or deactivating the source template in a test database does not break mapped lessons.
- Removing schema access from the render query does not break mapped lessons.
- No runtime query loads mutable template/schema content.
- Security tests confirm the same sandbox boundary as the current player or a stricter one.

### Gate to Phase 5

Cutover metrics meet the agreed error budget; rollback switch is tested; no unresolved critical security or data-isolation issue remains.

---

## Phase 5 — Administrative Lifecycle Decoupling

### What changes

Separate administrative template/schema lifecycle from runtime retention.

Affected modules:

- `actions/templates.ts`
- `actions/schema-definitions.ts`
- `lib/admin/queries/*`
- Admin tables/dialogs
- Runtime registry service and audit events

### Deliverables

- Logical deactivation/archive for templates used by runtime versions.
- Schema deletion/deprecation policy that cannot break lesson rendering.
- Runtime deprecation separate from source template deletion.
- Reference-safe runtime cleanup job or documented manual process.
- Admin visibility into runtime references before any destructive action.

### Compatibility preservation

- Existing lessons retain runtime references.
- New generation may use only active/approved sources.
- Physical runtime deletion is prohibited while references exist.
- Existing admin permissions and audit logging remain required.

### Verification

- Source template update does not change mapped historical rendering.
- Source template deletion/deactivation does not break dashboard or public rendering.
- Schema deprecation/deletion does not break rendering.
- Runtime deletion is denied with active references.

### Gate to Phase 6

Deletion scenarios pass in a production-like staging database; retention and legal/audit requirements are approved.

---

## Phase 6 — Remove Legacy Dependency and Enforce Invariants

### What changes

After evidence-based cutover:

- Make `lesson_versions.runtime_version_id` non-null.
- Remove template/schema joins from render queries.
- Disable legacy fallback.
- Add invariant checks and operational alerts.

### Why necessary

A permanent fallback would preserve the same hidden dependency and make the target architecture non-enforceable.

### Compatibility preservation

Only proceed after all historical rows have a valid runtime or an explicitly approved archival state. Do not regenerate lessons merely to satisfy a schema constraint.

### Verification

- Static query review confirms no rendering path depends on templates/schema definitions.
- Runtime deletion and immutability constraints pass integration tests.
- Historical and public-share acceptance suites pass.
- Rollback procedure is documented as a controlled release rollback, not a data-destructive reverse migration.

### Gate to completion

Architecture owner approves evidence pack, migration report, security review, and operational runbook.

---

## 6. Migration and Rollback Strategy

### 6.1 Expand, backfill, cut over, contract

1. **Expand:** Add nullable runtime registry and nullable lesson-version reference.
2. **Backfill:** Register/reuse runtimes and map existing lesson versions.
3. **Dual-read:** Prefer runtime reference; explicitly observe legacy fallback.
4. **Cut over:** Switch dashboard and public rendering.
5. **Contract:** Make reference required and remove fallback only after acceptance.

### 6.2 Backfill limitation

The current database does not prove which historical `html_player` content was active when each lesson was generated. A perfect historical snapshot may therefore be impossible for old rows if the template was edited in place. This must be reported as a data-quality classification, not hidden by claiming the current template is historical truth.

### 6.3 Rollback

- Application rollback: restore the prior resolver release while keeping newly created runtime rows.
- Migration rollback: only remove nullable/additive structures before contract enforcement, after verifying no dependent records remain.
- Data rollback: do not delete runtime artifacts during initial rollout; preserve them for retry and forensic comparison.
- Failed backfill: resume from checkpoint; do not overwrite an existing immutable runtime.

---

## 7. Testing and Acceptance Criteria

### 7.1 Unit tests

- Canonical manifest hashing is deterministic.
- Runtime identity changes when any executable or manifest content changes.
- Identical packages reuse one runtime record.
- Runtime package validation rejects missing entry point, undeclared capability, invalid asset hash, and unsupported contract version.
- Resolver selects runtime by lesson-version reference and never falls back silently.

### 7.2 Integration tests

- New generation persists a lesson version and a valid runtime reference.
- Two users generating the same runtime share the runtime record but not lesson content.
- A lesson can render after its source template is deactivated.
- A lesson can render after its source schema is unavailable to the render query.
- Runtime deletion is blocked while referenced.
- Lesson deletion cannot cascade into runtime deletion.

### 7.3 Historical compatibility tests

- All mapped existing lessons render in dashboard play route.
- All mapped public share links render.
- Historical lesson versions render with their own runtime, not the current template.
- Ambiguous/unrecoverable rows are reported and are not silently marked healthy.

### 7.4 Security tests

- Runtime cannot access platform cookies, auth tokens, or unrelated lesson data.
- Frame sandbox and CSP are enforced consistently in dashboard and public routes.
- Runtime cannot call unapproved external origins.
- Share-token authorization remains the only authorization mechanism for public links.
- Runtime content is treated as untrusted even when authored by an admin.

### 7.5 Operational acceptance

- Runtime resolution latency is measured against the current baseline.
- Runtime cache behavior is observable before optimization.
- Reference counts have a reconciliation query.
- Missing runtime, package integrity failure, and initialization failure produce actionable structured logs.

---

## 8. Security and Data Governance

1. Do not expose runtime registry write operations to teachers or public clients.
2. Validate and authorize every admin runtime publication/deprecation operation.
3. Treat HTML, CSS, JavaScript, and assets as untrusted executable content.
4. Preserve the current authenticated owner scoping and share-token checks.
5. Never include authentication credentials or platform secrets in lesson runtime payloads.
6. Use explicit CSP and iframe sandbox policies; do not grant broad permissions for convenience.
7. Keep immutable runtime artifacts private to the application path unless public delivery is explicitly approved.
8. Log runtime publication, identity, source reference, deprecation, and deletion attempts.
9. Avoid destructive cleanup until retention, audit, and reference reconciliation are proven.

---

## 9. Risks, Dependencies, and Unresolved Decisions

### 9.1 Critical risks

| Risk | Consequence | Mitigation |
|---|---|---|
| Historical template content was edited in place | Exact runtime cannot be reconstructed for some old lessons | Inventory and classify; preserve legacy fallback or quarantine explicitly |
| Runtime package assumptions match only current HTML player | Future heterogeneous templates become constrained | Adapter/contract first; support package manifests |
| Public and dashboard paths diverge | One access mode works while the other breaks | Cut over and test both paths together |
| Reference count becomes inaccurate | Runtime deleted too early or storage grows indefinitely | FK restriction plus periodic reconciliation |
| Runtime code is trusted implicitly | XSS, data leakage, or token exposure | Sandbox, CSP, capability declaration, security tests |
| Large assets are forced into database | Query/storage performance degradation | Start database-first for current text player; decide object storage from measured size |

### 9.2 Dependencies

- Architecture approval for the runtime package contract.
- Representative template and lesson fixtures.
- Sanitized staging database for migration rehearsal.
- Confirmed deployed database constraints and RLS before migration execution.
- Owner for operational runtime retention and cleanup.
- Security review of iframe/frame routes and CSP.

### 9.3 Decisions required before implementation

1. Is the first runtime artifact the current `htmlPlayer` document, a complete packaged player, or a compiled multi-file bundle?
2. Are runtime artifacts stored in PostgreSQL, object storage, or a hybrid? What size threshold triggers object storage?
3. Is `runtime_identity` global across templates or scoped to a template contract/version?
4. Should schema snapshots be stored for audit, or is `lesson_versions.content` sufficient?
5. What is the retention policy for deprecated runtimes and source templates?
6. What is the approved disposition for historical lessons whose original template content cannot be reconstructed?
7. Is runtime publication automatic at generation time or approved through an admin release gate?
8. Which capabilities, if any, may a runtime use outside its sandbox?

---

## 10. Proposed Files and Module Boundaries

These are proposed locations only; none were created by this planning task.

### Database

- `database/schema/runtime-versions.ts`
- `database/schema/runtime-assets.ts` if required
- `database/migrations/<generated-runtime-migration>.sql`

### Runtime domain

- `lib/runtime/types.ts`
- `lib/runtime/manifest.ts`
- `lib/runtime/hash.ts`
- `lib/runtime/registry.ts`
- `lib/runtime/resolver.ts`
- `lib/runtime/security-policy.ts`
- `lib/runtime/adapters/html-player.ts`

### Rendering integration

- `lib/dashboard/queries/lesson.ts`
- `app/dashboard/lessons/[id]/run/frame/route.ts`
- `app/l/[token]/frame/route.ts`
- `lib/templates/compose-player-html.ts`

### Operations and tests

- `scripts/runtime-backfill.ts` or the repository-approved migration tooling location
- `lib/admin/queries/runtime-version.ts`
- `actions/runtime-versions.ts`
- `tests/runtime/*` or the repository's established test location

New modules should be added only when the relevant phase is approved. The plan does not require all proposed files to be created together.

---

## 11. Completion Definition

Implementation is complete only when:

- Every playable lesson version has a valid immutable runtime reference or an explicitly approved archival state.
- Dashboard and public rendering resolve runtime without template/schema joins.
- Template and schema lifecycle operations do not break existing lessons.
- Runtime identity, immutability, deduplication, and deletion safety are tested.
- Historical rendering and public sharing acceptance suites pass.
- Security review signs off on runtime execution isolation.
- Operational reconciliation and rollback procedures are documented.

Until those criteria are met, the existing rendering path must remain available as a controlled compatibility path and the architecture must not claim full implementation.

---

## 12. Related Documentation

- `docs/architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md` — target architecture and invariants
- `docs/architecture/SYSTEM_ARCHITECTURE_MAP.md` — current platform architecture map
- `docs/README.md` — documentation index
- `database/schema/lesson-versions.ts` — current lesson-version schema
- `actions/generation.ts` — current generation entry point
- `lib/dashboard/queries/lesson.ts` — current dashboard and public lesson resolution

**END OF DOCUMENT**
