# Migration Runbook — Immutable Shared Runtime Versions

Unified operational runbook. Everything here is gated by
`ACCEPTANCE_GATES.md`; this document is the *how*, the gates document is the
*whether*. Do not reorder steps; do not skip human approvals.

---

## 0. Preconditions (all must be true before step 1)

- [ ] Branch under change control is `feat/hide-authenticated-start-cta`;
      `main` untouched; no force pushes.
- [ ] Test evidence current: 160/160 tests green (`lib/runtime` 103,
      `lib/db` 4, inventory 19, POC 29, classification 5).
- [ ] Feature Flag for the runtime resolver is **OFF** in every environment.
- [ ] `runtime_ops_report` tooling reviewed by ops (stale-attempt recovery,
      failed-attempt triage).
- [ ] Named humans assigned: data owner (export), cloud owner (bucket/IAM),
      product/ops owner (legacy decisions), migration operator.

## 1. Inventory (read-only)

**Run:**
```bash
bash poc/runtime-persistence/inventory/run-inventory.sh export.json [decisions.json]
```
(export produced by the data owner per `inventory/EXTRACTION_GUIDE.md`)

**Verify:** exit 0; report under `migration/reports/`; zero integrity
violations unexplained; every `legacy-decision` row has a written reason.

**Human approval ★1:** product/ops signs the classification report.
If rejected → stop; export and re-classify. Nothing else is affected.

## 2. AWS storage (no app writes)

**Provision (cloud owner, per `s3-compat/AWS_S3_READINESS.md` §1):**
private bucket, versioning enabled, Object Lock COMPLIANCE at creation,
SSE, least-privilege IAM (no DeleteObject).

**Run:**
```bash
export RUNTIME_CONTENT_S3_ENDPOINT=... REGION=... ACCESS_KEY=... SECRET_KEY=... BUCKET=...
bash poc/runtime-persistence/s3-compat/run-aws-compat.sh A
# later (persistence over time):
S3_COMPAT_RUN=<label-from-A> bash poc/runtime-persistence/s3-compat/run-aws-compat.sh B
```

**Verify:** all required checks PASS; object-lock probe returns 200 with a
COMPLIANCE rule; plain-overwrite probe rejected by retention. **Gate S3.**

**Human approval ★2:** cloud owner signs the compat report.

## 3. Staging rehearsal (disposable data only)

1. Apply migrations to a disposable/staging DB; run `lib/db` + `lib/runtime`
   suites against it.
2. Point staging storage env at the new bucket; run publication + binding +
   resolver suites with the flag ON.
3. Kill-a-publisher drill: mid-batch kill, lease expiry, second worker
   recovers → exactly one published result.
4. Template-independence proof: delete a migrated version's template +
   schema definition in staging → render is byte-identical → restore.

**Verify:** all green; drill matches test-proven behavior.

**Human approval ★3:** migration operator signs the rehearsal record.

## 4. Backfill (production data, additive only)

Batches of ~500 approved versions, driven by ops-report health, never by
wall-clock pressure.

Per batch:
1. Render → identity V1 + asset SHA-256.
2. Publish through the production publication path (idempotency key per
   version; concurrent publishers safe by fencing).
3. Bind (`bound`/`legacy` per classification) in the same transaction as
   the publication record.
4. Duplicate identity → adopt existing runtime row; never a second version.
5. Quarantined/unrecoverable rows: never published, never auto-fallback.

**Verify per batch:** `runtime_ops_report` shows `mismatches` empty;
zero new integrity violations; share-link snapshot diff = 0.

**Stop conditions:** any integrity violation, any share-link diff, any
failed attempt without a recorded failure code → stop, triage, resume only
after approval.

## 5. Production cutover

1. Enable flag for staff/internal accounts. Observe ops report ≥ 1 day.
2. Enable for a small cohort. Observe ≥ 3 days: zero resolver errors, zero
   share-link complaints, storage-integrity pass clean.
3. Full enable. Legacy template path remains for quarantined/unrecoverable/
   legacy fallbacks as designed.

**Verify:** acceptance checklist A1–A13 all green on real-data numbers.

**Human approval ★4 (final):** product owner signs the acceptance record.

## 6. Rollback (safe at every point)

- **Any time before ★4:** flag OFF → rendering returns to the template
  path instantly. Runtime rows, bindings, and buckets are untouched.
  Re-enabling resumes without any migration. No data is ever deleted;
  a bad runtime is *quarantined*, not removed (Object Lock COMPLIANCE
  also prevents deletion during retention).
- **Partial batch failure:** re-run the batch — publication is idempotent.
- **No reverse migration exists or is needed:** all changes are additive.

## 7. Production permission criteria (gate to live cutover)

All of: ★1–★4 signed; gates INV/S3/DB/BIND/RUN green on real evidence;
A1–A13 green; a named on-call for the first 72 hours of full enable;
rollback tested on staging within the preceding 7 days.

## 8. Reporting

Every run writes to `migration/reports/` (inventory, AWS phases A/B,
per-batch backfill logs). Attach these to the acceptance record at ★4.
