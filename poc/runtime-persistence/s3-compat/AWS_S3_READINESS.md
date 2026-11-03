# AWS S3 Production Storage Readiness

How to prove — on a **real AWS account, with explicit approval** — that the
Runtime persistence storage contract holds on AWS S3. SeaweedFS results
(10/10 + 9/9) are necessary but **not sufficient**: Object Lock in
COMPLIANCE mode and real SigV4 against AWS endpoints remain unverified until
this runbook is executed.

Nothing in this document creates cloud resources by itself; it is a
checklist + test invocation for the person authorized to provision them.

---

## 1. Provisioning checklist (performed by the cloud owner)

Create, in the account/region chosen for production:

1. **Bucket** — private, block-all-public-access on.
   - Versioning: **Enabled**.
   - Object Lock: **Enabled at bucket creation** (cannot be added later),
     default retention **COMPLIANCE** with a period chosen by ops (e.g. 30
     days) — this closes the "plain overwrite without condition" gap the
     SeaweedFS run documented as a discipline-only control.
   - Default encryption: SSE-S3 (or SSE-KMS if org policy requires).
2. **IAM principal for the app** — least privilege, scoped to this bucket:
   `s3:GetObject`, `s3:PutObject` (conditional writes use headers, no extra
   permission), `s3:ListBucket`, `s3:GetObjectVersion`, plus
   `s3:GetObjectRetention` if ops needs audit reads. No `s3:DeleteObject`.
3. **IAM principal for this test** — may reuse the app's principal; the test
   writes only under `poc/s3-compat/<run>/`.

Cost note: this test writes a few KB. Object Lock and versioning have no
extra per-request cost beyond normal S3 pricing; data amounts are trivial.

## 2. Running the compatibility matrix against AWS

The same script used for SeaweedFS is endpoint-agnostic. Run it through the
one-command wrapper, which verifies configuration, never echoes credentials,
and writes a timestamped report under `migration/reports/`:

```bash
export RUNTIME_CONTENT_S3_ENDPOINT="https://s3.<region>.amazonaws.com"
export RUNTIME_CONTENT_S3_REGION="<region>"            # must match bucket region
export RUNTIME_CONTENT_S3_ACCESS_KEY="<test-access-key>"
export RUNTIME_CONTENT_S3_SECRET_KEY="<test-secret-key>"
export RUNTIME_CONTENT_S3_BUCKET="<bucket>"

bash poc/runtime-persistence/s3-compat/run-aws-compat.sh A
```

(Equivalent direct form: `node poc/runtime-persistence/s3-compat/s3-compat-check.mjs A` with `S3_COMPAT_RUN` set.)

On AWS, every check must pass, and the probes change meaning:

| Check | SeaweedFS result | AWS expectation |
| --- | --- | --- |
| If-None-Match:* first write | PASS | **required PASS** |
| If-None-Match:* second write → 412 | PASS | **required PASS** |
| Content unchanged after rejected overwrite | PASS | **required PASS** |
| Plain overwrite without condition | succeeds (gap) | must be **rejected by COMPLIANCE retention** once default retention covers the object — verify explicitly; if it succeeds, default retention is not effective |
| Presigned GET fetches exact bytes | PASS | **required PASS** |
| Tampered presigned URL → 403 | PASS | **required PASS** |
| Bucket versioning probe | Enabled | `Status=Enabled` in GET response |
| Enable-versioning PUT | 200 | 200 (idempotent) |
| Object Lock configuration probe | 404 (unsupported) | **must return 200 with COMPLIANCE rule** — this is the check that upgrades from PROBE to PASS on AWS |
| List under prefix | PASS | **required PASS** |

For persistence-over-time on AWS, phase B is reinterpreted: instead of a
container restart, re-run any time later with the same `S3_COMPAT_RUN` value
to prove the objects are still byte-identical (durability is otherwise an AWS
SLA, not something a script can prove in minutes).

## 3. Recording the result

Append the run summary (date, region, bucket ARN, pass/fail table) to
`poc/runtime-persistence/README.md` and flip the "Object Lock unverified"
note in the Phase 8 section to verified — or record the failure and stop the
migration until the bucket config is fixed.

## 4. Until this run passes

The migration plan's storage gate (see
`../migration/ACCEPTANCE_GATES.md`, gate S3) stays **red**: production
cutover is blocked even if every database and classification gate is green.
