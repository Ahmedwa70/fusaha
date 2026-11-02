# Runtime Persistence — Migration Execution Plan (Phase 9)

Status: **prepared, not started**. Every step below is gated by
`ACCEPTANCE_GATES.md`; nothing here has been executed against real data.

## 0. Inputs required before step 1

| Input | Owner | Status |
| --- | --- | --- |
| Anonymized export per `inventory/EXPORT_CONTRACT.md` (guide: `inventory/EXTRACTION_GUIDE.md`) | Data owner | **missing** |
| AWS S3 bucket + IAM, compatibility matrix green per `s3-compat/AWS_S3_READINESS.md` | Cloud owner | **missing** |
| Signed-off human decisions for `legacy-decision` rows | Product/Ops | pending inventory |

## 1. Inventory and classification (read-only)

1. Run `inventory-tool.mjs` on the export; record the bucket counts.
2. Resolve every `legacy-decision` row with a written reason or escalate.
3. Sign off the classification report. **Gate: INV.**

## 2. Storage provisioning (no app writes yet)

1. Provision the AWS bucket/IAM per `AWS_S3_READINESS.md`.
2. Run the compatibility matrix against AWS; record results. **Gate: S3.**
3. Point a **staging** environment's storage config at the new bucket and run
   the publication test suite there.

## 3. Backfill — publish runtimes for historical content

Principle: **group by identical rendered bytes, not by lesson**. Two lesson
versions whose rendered runtime bytes (and metadata inputs) hash to the same
Runtime Identity V1 share one `runtime_versions` row — the registry's
`unique(identity_algorithm, identity)` constraint enforces this dedup.

Per batch (batches of e.g. 500 versions, size driven by `runtime_ops_report`
stale/failed counts, never a fixed wall-clock deadline):

1. Render each approved historical version through the **current** render
   pipeline to a runtime package (entry point + assets).
2. Compute Runtime Identity V1 + per-asset SHA-256.
3. Publish via the production publication path (idempotency key per
   version; concurrent publishers are safe — fencing guarantees one winner).
4. On success: bind the version (`runtime_binding_status = bound`,
   `runtime_version_id` set) in the same transaction that records the
   publication — a failed bind never leaves a dangling published runtime.
5. On `OBJECT_KEY_CONFLICT`/duplicate identity: adopt the existing runtime
   row (idempotent re-join), do not create a second version.

## 4. Classification handling

- **bound-candidate** (template unchanged since version creation):
  normal path, §3.
- **legacy-decision**: publish with a recorded provenance note
  (`source_template_id` on the runtime row), bind as `legacy`. These render
  from bytes captured at migration time, not from the live template.
- **quarantined-gap** (no template/player evidence): mark
  `quarantined`; do **not** publish. Surface in the ops report.
  Recovery path: only if a human supplies the original player bytes later.
- **quarantined-conflict** (template edited after creation): default to
  **quarantined** unless a human decision converts specific rows to legacy.
  Never silently re-render from the edited template — that changes what the
  lesson looked like when approved.
- **unrecoverable**: mark `unrecoverable`, no runtime. Share links on these
  versions keep their current (template-based) behavior in compatibility
  mode and are listed for content-team action.

## 5. Share-link protection

- Before binding any version, snapshot `share_links` (id, lesson_id,
  active) — gate INV requires zero unexplained diffs against this snapshot.
- Binding never touches share links; the public play path resolves through
  the lesson's `current_approved_version_id` → runtime, so an active link
  keeps working if and only if its target version ends bound/legacy.
- For every active link whose target version lands in quarantined or
  unrecoverable: emit an explicit remediation list (contact lesson owner /
  regenerate from source) — the inventory tool already produces this list.

## 6. Post-migration verification (per batch and globally)

1. For every bound/legacy version: fetch every runtime asset, verify
   SHA-256 against the manifest (the ops report's storage-integrity pass
   does exactly this — run it until `mismatches` is empty).
2. Smoke-render N random lessons through Dashboard and the public share
   path with the Feature Flag **on**.
3. Template independence proof (staging): remove the version's template and
   schema definition from the staging DB, re-render — must be byte-identical
   output. Restore afterwards. This is the strongest evidence the runtime no
   longer depends on mutable sources.
4. Recovery drill: kill a publication attempt mid-batch, let the lease
   expire, recover from a second worker, confirm exactly one published
   outcome. (Already proven by test; drill proves it on the staging stack.)

## 7. Rollback and recovery (no data loss)

- **Feature Flag rollback** (primary lever): turn
  `resolveLessonVersionRuntime` usage off — rendering returns to the
  template path instantly. Runtime rows and bindings are untouched; turning
  the flag back on resumes without any migration. This is why rollback is
  safe: the legacy path is kept intact until the migration is accepted.
- **Partial batch failure**: publication is idempotent; re-running the batch
  resumes. Failed attempts stay visible in `runtime_ops_report` until
  remediated — nothing is silently retried in a way that hides state.
- **Bad runtime published** (wrong bytes): mark the runtime `quarantined`
  (never delete — Object Lock COMPLIANCE also prevents deletion during
  retention), bind affected versions back to `unbound`-equivalent handling
  under the flag-off path, and republish corrected bytes under a new
  identity. Old identity remains auditable.
- **No migration reverse script exists nor is needed**: all changes are
  additive columns + new tables; the legacy render path is the rollback.

## 8. Cutover sequence (after all gates green)

1. Enable flag for staff/internal accounts on staging; observe ops report.
2. Enable for a small cohort (or admin-only) in production.
3. Full enable. Keep the template path for quarantined/unrecoverable/legacy
   fallbacks as designed — the flag governs only the resolver, not data.

## 9. Sequencing constraints

- Steps 1–2 can run in parallel.
- Step 3 starts only after INV + S3 are green.
- Step 8 never starts before gates INV, S3, DB, BIND, RUN are green and the
  acceptance checklist is signed.
