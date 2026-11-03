# Template Runtime Phase 0 Readiness
## Baseline Audit and Implementation Readiness Report

**Document ID:** FUSAHA-ARCH-TR-003  
**Related specification:** `TEMPLATE_RUNTIME_ARCHITECTURE.md`  
**Related plan:** `TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN.md`  
**Status:** Repository inspection and planning only  
**Date:** October 2026  
**Final status:** **READY WITH CONDITIONS**

---

## 1. Scope and Constraints

This report prepares the repository for the first implementation phase described by the approved implementation plan.

No application code, database schema, database record, migration, production environment, deployment, lesson, template, or public share link was modified. No database write or production-data access was performed.

The report distinguishes:

- **Verified:** directly supported by repository files.
- **Inferred:** a reasoned conclusion from verified code, but not proof of deployed behavior.
- **Unverified:** requires live database, staging, production-like data, or runtime/browser validation.
- **Proposed:** target implementation behavior from the approved architecture and plan.

---

## 2. Exact Phase Being Assessed

The first coding phase in `TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN.md` is:

> **Phase 1 — Runtime Contract and Adapter Boundary**

Phase 0 in the implementation plan is a preparation phase consisting of documentation, inventory, fixtures, contract definition, and baseline measurement. This report is the readiness audit for beginning the first coding phase after those prerequisites are satisfied.

### 2.1 Phase 1 objective

Introduce a runtime package contract and an adapter boundary without changing database persistence, lesson generation, dashboard rendering, or public sharing behavior.

The current `htmlPlayer` should be wrapped as the first adapter. The implementation must not assume that every future template is a single HTML document or impose one visual framework, DOM shape, or activity model on future templates.

### 2.2 Phase 1 intended deliverables

- Runtime package types and manifest representation.
- Current HTML-player adapter.
- Canonical serialization and identity-hashing rules.
- Runtime capability/security policy representation.
- Unit fixtures for current and future package shapes.
- No production runtime switch.
- No migration.
- No `lesson_versions.runtime_version_id` yet.

---

## 3. Phase 1 Readiness Assessment

### 3.1 Prerequisites defined by the plan

The implementation plan defines these prerequisites before Phase 1:

1. Current repository and data model inventory.
2. Golden rendering fixtures for representative templates.
3. Explicit current `htmlPlayer` input/output contract.
4. Historical recovery policy identified, even though it is not implemented in Phase 1.
5. Baseline rendering/share/query measurements where runtime access is available.
6. Contract review covering package shape, hash inputs, sandbox policy, and future storage boundary.

### 3.2 Prerequisites verified now

| Prerequisite | Evidence | State |
|---|---|---|
| Current template fields identified | `database/schema/templates.ts` | Verified |
| Current lesson-version fields identified | `database/schema/lesson-versions.ts` | Verified |
| Current generation inputs identified | `actions/generation.ts`, `src/trigger/generate-lesson.ts` | Verified from repository inspection |
| Current player composition identified | `lib/templates/compose-player-html.ts` | Verified |
| Current dashboard template dependency identified | `lib/dashboard/queries/lesson.ts` | Verified from repository inspection |
| Public-share dependency identified | Plan records `app/l/[token]/*` and the share query path | Repository path requires final runtime test |
| Runtime entity absent from inspected schema | No active runtime entity/FK found | Verified locally |
| Live DB constraints and RLS | No live Supabase schema inspection performed | Unverified |
| Golden rendered fixtures | No new fixtures created in this documentation-only task | Not yet satisfied |
| Baseline performance metrics | No benchmark run in this documentation-only task | Not yet satisfied |
| Isolated staging database | Not established/verified in this task | Blocker for data-affecting phases, not Phase 1 contract work |

### 3.3 Achievability

Phase 1 is technically achievable as an isolated library/test change because:

- It can consume the existing `htmlPlayer` string and `lesson_versions.content` shape without changing their persistence.
- It can be tested with pure inputs and fixtures.
- It does not require a new table, migration, runtime registry, or production data.
- It does not need to alter the generation Trigger.dev task.
- It does not need to alter dashboard or public-share resolution.
- It can remain unused by existing routes until a later cutover phase.

### 3.4 Compatibility assessment

Phase 1 can be implemented without breaking existing lessons if the adapter is additive and not wired into production resolution. Existing routes continue to use the current composition path:

```text
approved lesson version
  -> lesson content
  -> current template.html_player
  -> composePlayerHtml(htmlPlayer, content)
  -> frame/player
```

The first implementation must not replace this path, mutate template rows, or populate runtime references. Those actions belong to later phases with migration and rollback controls.

### 3.5 Readiness conclusion for Phase 1

The repository is technically ready for a contract/adapter implementation, but the full Phase 0 prerequisite set is not complete because golden fixtures and baseline measurements have not yet been established and no staging environment has been verified.

Therefore the correct status is:

> **READY WITH CONDITIONS — Phase 1 may begin only as an additive, unconnected contract/adapter implementation after the conditions in Section 11 are accepted. Any database, backfill, render cutover, or production-data phase remains blocked until an isolated staging/test environment and data inventory are available.**

---

## 4. Current Baseline: Database and Relationships

### 4.1 Templates

**File:** `database/schema/templates.ts`

Verified fields:

- `id`
- `name`
- `html_player`
- `blueprint`
- `validation_script`
- optional `preview_image`
- `active`
- `created_at`
- `updated_at`

The source comment describes the template as the bundle required to render and generate one lesson shape. It also states that the current app stores the preview data as text and does not currently use Blob/S3 storage for that asset.

No active template-version table was verified in the inspected schema. The current template row is mutable administrative state.

### 4.2 Schema definitions

**File:** `database/schema/schema-definitions.ts`

Verified fields include:

- Stable `level_key`.
- Localized `level` JSONB.
- `version`.
- `content`.
- Nullable `template_id`.
- `active`.
- `created_at`.

`template_id` references `templates.id` with `onDelete: "restrict"` in the Drizzle definition. The comment explains that old rows may remain unlinked until an administrator edits them, so a null template relationship is a real compatibility case.

### 4.3 Lessons

**File:** `database/schema/lessons.ts`

The lesson row stores ownership, name, state/folder information, soft-delete data, and `current_approved_version_id`. It does not store `template_id` or `schema_definition_id` directly.

The approved lesson version is therefore the central resolution point for rendering.

### 4.4 Lesson versions

**File:** `database/schema/lesson-versions.ts`

Verified fields:

- `id`
- `lesson_id` with cascade semantics in the Drizzle definition.
- `version_number`
- status
- required `schema_definition_id` with restrict semantics.
- JSONB `content`
- optional `source_type`
- `created_at`
- optional `approved_at`

No `runtime_version_id`, runtime identity, template snapshot, asset manifest, or immutable player snapshot is present.

### 4.5 Generation events

**File:** `database/schema/generation-events.ts`

Generation events are audit/lifecycle records. They do not provide a runtime artifact reference in the inspected schema.

### 4.6 Live-schema limitation

The local Drizzle definitions are not proof of the deployed database state. The following remain unverified:

- Actual deployed foreign-key actions.
- RLS policies.
- Existing row counts and orphaned relationships.
- Whether production contains schema rows with null template IDs.
- Whether production has historical template content unavailable in the current row.
- Whether manual SQL or prior migrations added constraints not represented locally.

No production-data assumption is made in this report.

---

## 5. Current Template Storage and Retrieval

### 5.1 Administrative storage

**Files:**

- `database/schema/templates.ts`
- `actions/templates.ts`
- `lib/admin/queries/template.ts`
- `app/admin/templates/_components/templates-table.tsx`

Template player and generation fields are stored directly in the template row. Template updates mutate the current row. The admin delete action performs an application-level linked-schema check before deletion.

This provides administrative lifecycle behavior but not immutable runtime history.

### 5.2 Generation-time retrieval

**Files:**

- `actions/generation.ts`
- `lib/admin/queries/schema-definition.ts`
- `lib/admin/queries/template.ts`
- `src/trigger/generate-lesson.ts`

The generation action resolves the selected schema definition and its template, then passes schema instructions, template blueprint, and validation script to the asynchronous task. The task writes generated JSON content to the lesson version.

The template's `html_player` is not stored on the lesson version by the inspected generation path.

### 5.3 Render-time retrieval

**File:** `lib/dashboard/queries/lesson.ts`

The dashboard approved-lesson query joins from the lesson to the approved lesson version, schema definition, and template. It returns lesson content with template player context.

This means the current render path can be affected by the current administrative template record. That is the specific dependency the future runtime reference is intended to remove.

---

## 6. Current Lesson Generation Flow

Verified repository flow:

```text
Teacher request
  -> actions/generation.ts
  -> authorization and input validation
  -> resolve schema definition and template
  -> create lesson and draft lesson version
  -> enqueue Trigger.dev task
  -> src/trigger/generate-lesson.ts
  -> AI generation and validation
  -> update lesson_versions.content
  -> generation event status update
```

### 6.1 Phase 1 impact

Phase 1 must not change this flow. It may define a type/adapter that can later represent the player package, but generation continues to use the existing blueprint and validation script.

### 6.2 Future-phase implication

A later runtime-registration phase must decide whether the runtime is registered:

- When a lesson is generated.
- When a template is published.
- Or when an admin explicitly releases a runtime.

That decision is not needed to implement the isolated Phase 1 contract, but it is required before adding `runtime_version_id` or changing generation persistence.

---

## 7. Current Runtime Resolution and Rendering

### 7.1 Composition boundary

**File:** `lib/templates/compose-player-html.ts`

The current composer:

1. Serializes lesson content with `JSON.stringify`.
2. Escapes `<`, U+2028, and U+2029 to prevent breaking the script context.
3. Injects `window.LESSON_DATA` into the player HTML.
4. Injects horizontal-overflow containment style.
5. Inserts the generated script/style after `<head>` when available, otherwise prepends them.

This is an important existing security boundary. A new adapter must preserve equivalent escaping and must not treat AI-generated lesson content as trusted HTML.

### 7.2 Frame/player boundary

The repository contains dashboard and public-share page/frame paths. The current architecture uses a frame/player boundary to render template HTML with lesson data. The exact browser behavior, CSP response headers, iframe sandbox flags, and public route success must be validated in an isolated runtime test before any cutover.

### 7.3 Target change exclusion

Phase 1 must not change:

- `composePlayerHtml` behavior.
- Dashboard frame routes.
- Public share frame routes.
- Authentication or share-token authorization.
- CSP/sandbox policy.
- Template HTML content.

---

## 8. Public Sharing Dependencies

The public path is high risk because it can outlive administrative activity and is accessed without the owner dashboard context.

Relevant repository paths from the implementation plan and inspection:

- `app/l/[token]/page.tsx`
- `app/l/[token]/frame/route.ts`
- `lib/dashboard/queries/lesson.ts`
- `database/schema/share-links.ts`

Verified/expected dependency chain:

```text
share token
  -> share-link authorization
  -> lesson
  -> current approved lesson version
  -> schema definition/template context
  -> composed player HTML
```

The approved target is:

```text
share token
  -> share-link authorization
  -> approved lesson version
  -> immutable runtime reference
  -> composed/runtime package with lesson content
```

The current deployed public path, existing token rows, expiration behavior, and RLS policy are unverified. No public link was opened or changed in this audit.

---

## 9. Existing Validation and Security Boundaries

### 9.1 Existing boundaries verified from repository

- Server actions perform authentication/authorization before generation and admin mutation.
- Lesson content is treated as untrusted when inserted into the player script; `composePlayerHtml` escapes script-breaking characters.
- Schema/template relationships use restrictive semantics in the local Drizzle definitions.
- Lesson-version deletion follows lesson deletion through cascade in the local schema.
- The runtime is isolated through a frame/player boundary in the route structure.

### 9.2 Boundaries requiring runtime verification

- Exact iframe `sandbox` attributes.
- Effective CSP headers in deployed and preview environments.
- Whether templates load external origins.
- Whether the frame has access to cookies, storage, or parent-window APIs.
- RLS behavior for owner-scoped lesson queries and public share tokens.
- Error behavior when a template, schema, share link, or lesson version is missing.

### 9.3 Phase 1 security rule

Phase 1 must be pure and non-executing by default:

- It must not evaluate template JavaScript.
- It must not fetch external assets.
- It must not receive auth tokens.
- It must not create a new permissive CSP.
- It must only validate/represent the runtime package contract and adapt existing player input.

---

## 10. Migration Risks

### 10.1 Historical lessons and versions

The current lesson version does not contain a template/player snapshot or runtime reference. If a template row was edited in place, the repository cannot prove which historical player content was used for an old lesson.

Risk: a backfill may incorrectly treat current template content as historical truth.

Required mitigation: classify historical rows as exact, reconstructable, ambiguous, or unrecoverable. Never silently mark an ambiguous row as migrated.

### 10.2 Existing public share links

Share links may remain active after template administration changes. A render cutover that changes only dashboard queries can leave public links broken or behaviorally different.

Required mitigation: dashboard and public paths must be tested as one release unit, with token authorization unchanged.

### 10.3 Templates referenced by existing lessons

The local schema does not put `template_id` directly on `lessons`; the relationship is reached through schema definitions and lesson versions. A simple template-reference count over `lessons.template_id` would therefore be incorrect.

Required mitigation: reference inventory must traverse lesson versions -> schema definitions -> templates and separately account for schema definitions with null `template_id`.

### 10.4 External runtime dependencies

The current template HTML may reference fonts, images, scripts, or APIs outside the database. The local schema does not provide a complete asset manifest or integrity record.

Required mitigation: inspect representative `html_player` content in staging/sanitized fixtures, classify external origins, and define whether the first runtime package embeds, pins, proxies, or explicitly allows each dependency.

### 10.5 Data-loss and broken-reference risks

High-risk operations include:

- Making `runtime_version_id` non-null before complete backfill.
- Deleting templates before runtime artifacts are verified.
- Deleting schemas despite lesson-version restrict relationships.
- Rewriting lesson content during migration.
- Rebuilding a runtime from current mutable source without recording uncertainty.
- Changing public-share resolution without testing existing tokens.

No such operation is permitted in Phase 1.

---

## 11. Exact First Coding Task

### 11.1 Smallest independently verifiable change

Implement the runtime contract and current HTML-player adapter as an additive library/test change only.

### 11.2 Files to create

Proposed files:

- `lib/runtime/types.ts`
- `lib/runtime/manifest.ts`
- `lib/runtime/hash.ts`
- `lib/runtime/adapters/html-player.ts`
- `tests/runtime/html-player-adapter.test.ts` or the repository's established test location

Names must be checked against current project conventions before implementation.

### 11.3 Files to modify

Preferred first task: no production-route modifications.

If a shared type export is required, modify only the nearest existing runtime/template barrel file. Do not modify:

- `actions/generation.ts`
- `src/trigger/generate-lesson.ts`
- `database/schema/*`
- `lib/dashboard/queries/lesson.ts`
- dashboard or public frame routes
- admin actions

### 11.4 Expected behavior

The adapter should:

1. Accept the existing `html_player` value and a declared runtime contract version.
2. Produce a deterministic package/manifest representation.
3. Preserve the player HTML as immutable adapter input.
4. Describe how lesson content is passed through the existing `window.LESSON_DATA` contract.
5. Compute a deterministic identity over canonical package inputs.
6. Validate required entry point, contract version, and declared capabilities.
7. Return structured validation errors without executing the HTML or external assets.
8. Be usable in unit tests without database access, environment variables, network calls, or browser automation.

### 11.5 Explicit exclusions

The first coding task must not:

- Add or modify database tables.
- Add a migration.
- Add `runtime_version_id`.
- Write or read production data.
- Backfill existing lessons.
- Change generation behavior.
- Change dashboard rendering.
- Change public sharing.
- Change template CRUD.
- Execute template JavaScript.
- Fetch external runtime assets.
- Change CSP or iframe sandbox policy.
- Add Blob/S3 or another storage integration.
- Add a feature flag that changes production rendering.

### 11.6 Test cases

Minimum unit coverage:

1. Same HTML, manifest, contract version, and configuration produce the same identity.
2. Any executable or manifest input change produces a different identity.
3. JSON key ordering is canonicalized before hashing.
4. Empty HTML is rejected.
5. Missing entry point is rejected.
6. Unsupported contract version is rejected.
7. Undeclared capability is rejected.
8. HTML containing `</script>` is represented as data and is not executed during adapter creation.
9. Lesson content is represented as an input envelope, not interpolated into runtime code by the adapter.
10. Existing `composePlayerHtml` escaping behavior remains unchanged by the new module.
11. Adapter tests require no `DATABASE_URL`, Supabase key, Trigger secret, or network access.

### 11.7 Acceptance criteria

Phase 1 coding is accepted only when:

- New modules compile and pass repository lint/type checks.
- Unit tests pass deterministically.
- No production route imports the adapter.
- No database schema or migration file changes exist.
- Existing lesson-generation tests pass.
- Existing player composition tests pass.
- A code review confirms that no HTML/JavaScript is executed by the adapter.
- The package identity is documented and reproducible.
- The adapter supports the current `htmlPlayer` without forcing a visual or framework-specific structure.

### 11.8 Rollback considerations

Rollback is a file-level revert because the adapter is additive and unreferenced. No database rollback is required. Existing lessons, templates, generation tasks, routes, and public share links remain on the current path.

---

## 12. Safe Execution Strategy

### 12.1 Safe environment for Phase 1

Phase 1 can be developed using pure unit tests and local fixtures without connecting to a database or production service. The first implementation must not require an environment variable or integration.

### 12.2 Environment requirement for later phases

An isolated staging or test database is required before any of the following:

- Runtime registry tables.
- Historical inventory queries against real rows.
- Backfill.
- Rendering cutover.
- Template/schema deletion tests.
- Public-share compatibility tests using representative links.
- Runtime reference cleanup.

Preview alone is not evidence of database safety. If no isolated staging database or sanitized snapshot exists, those later phases are blocked.

### 12.3 Required staging protections

Before Phase 2 or later:

- Use a separate project/database or sanitized snapshot.
- Confirm no production credentials are loaded into migration tooling.
- Verify RLS and foreign-key policies in the isolated target.
- Seed representative templates, linked/unlinked schemas, lesson versions, share links, and historical edge cases.
- Capture a database backup/snapshot before each destructive rehearsal.
- Disable external notifications and production webhooks.
- Test rollback before any production proposal.

### 12.4 Recommended execution order

```text
Phase 0 audit and fixtures
  -> Phase 1 pure contract/adapter
  -> isolated staging schema design
  -> runtime registry migration rehearsal
  -> historical inventory and backfill rehearsal
  -> dual-read rendering in staging
  -> dashboard/public acceptance
  -> security review
  -> production change proposal
```

---

## 13. Required Evidence Before Progressing

### Before Phase 1 coding

- Contract decision approved.
- Current `htmlPlayer` fixture set selected.
- Pure adapter boundary confirmed.
- No-route/no-database scope confirmed.

### Before Phase 2 schema work

- Isolated staging database available.
- Live schema, RLS, and deployed migration state inspected in staging.
- Historical inventory query reviewed.
- Runtime storage decision approved.
- Template external-dependency inventory completed.

### Before rendering cutover

- All eligible lesson versions mapped or explicitly quarantined.
- Dashboard and public share paths pass in staging.
- Runtime-independent query plan confirmed.
- Rollback switch tested.
- Security review complete.

### Before production data migration

- Backup/restore rehearsal successful.
- Production row counts and relationship report captured read-only.
- Change approval obtained.
- Maintenance/observability plan ready.
- No unresolved critical migration or data-loss risk.

---

## 14. Final Status

# READY WITH CONDITIONS

Phase 1 can begin safely **only as an additive, pure runtime contract and current HTML-player adapter implementation** that is unconnected to production routes and persistence.

The evidence supporting this conclusion is:

1. The current template fields and lesson-version fields are local and directly inspectable.
2. The current generation path can remain unchanged.
3. The current player composition boundary is a pure function and already contains script-context escaping for untrusted lesson content.
4. The first adapter can be tested without database access, migrations, production data, or environment integrations.
5. Existing lessons and public share links remain on the current path because Phase 1 does not change rendering.

The conditions are:

1. Establish the golden fixture set and contract decision before coding.
2. Keep Phase 1 additive and unreferenced by production routes.
3. Do not begin runtime schema, backfill, deletion, or rendering-cutover work until an isolated staging/sanitized database is available.
4. Verify live foreign keys, RLS, existing rows, public share links, and external runtime dependencies before any data-affecting phase.
5. Treat historical template reconstruction as an explicit data-quality problem; never assume current mutable template content is historical truth.

No implementation, migration, database write, production-data access, or deployment was performed by this audit.

---

## 15. Related Documentation

- `docs/architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md`
- `docs/architecture/TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_MAP.md`
- `docs/README.md`

**END OF DOCUMENT**
