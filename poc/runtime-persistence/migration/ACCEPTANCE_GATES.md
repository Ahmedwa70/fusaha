# Runtime Persistence — Acceptance Gates & Checklist (Phase 9)

Every gate is **measurable** and either green, red, or not-yet-runnable.
Nothing may proceed past a red gate. Counts below reflect the state on
`feat/hide-authenticated-start-cta` after Phase 8 (160/160 tests green).

## Gate summary

| Gate | Scope | Status |
| --- | --- | --- |
| INV | Real-data inventory | 🔴 blocked — export not yet provided |
| S3 | AWS storage compatibility | 🔴 blocked — AWS runbook ready, not executed |
| DB | Schema/migration correctness | 🟢 green on disposable DBs (24 migrations, 4/4 db tests, 103/103 runtime suites) |
| BIND | Lesson↔runtime binding correctness | 🟢 green in tests; real-data validation inside INV |
| RUN | Publication protocol (idempotency, fencing, lease, recovery) | 🟢 green in tests incl. two-process concurrency |
| CUT | Feature-flag cutover & rollback | 🟢 green in tests; production flag default OFF |

## Acceptance checklist (measured at final acceptance, after migration)

| # | Criterion | How it is measured | Now |
| --- | --- | --- | --- |
| A1 | Zero lesson versions lost | `count(lesson_versions)` diff vs pre-migration snapshot = 0 | ⬜ |
| A2 | Zero share links lost or deactivated unintentionally | `share_links` snapshot diff = 0 except approved remediations | ⬜ |
| A3 | Zero approved versions unclassified | inventory: every approved version is bound, legacy, quarantined, or unrecoverable — none "out-of-scope" or blank | ⬜ |
| A4 | Zero invalid runtime references | `runtime_ops_report` integrity violations = 0 (no Bound/Legacy → missing/non-published runtime; no orphan published runtimes) | 🟡 0 today on test data; real data pending INV |
| A5 | SHA-256 match for 100% of runtime assets | storage-integrity pass over all published runtimes: `mismatches` empty, `checked == verified` | 🟡 proven on test runtimes |
| A6 | Dashboard play works for bound versions with flag ON | smoke suite on staging with flag on | 🟢 in tests; staging run pending |
| A7 | Public share play works for bound versions with flag ON | smoke suite on public share path | 🟢 in tests; staging run pending |
| A8 | Render survives template+schema deletion | staging: delete template & schema def of migrated versions, output byte-identical | ⬜ staging-only step |
| A9 | Recovery after interrupted publication | drill: kill mid-batch, lease expiry, second worker recovers, exactly one published result | 🟢 proven in tests; staging drill pending |
| A10 | Flag rollback loses nothing | flag off → byte-identical legacy rendering; runtime rows & bindings unchanged | 🟢 in tests |
| A11 | Concurrent republish creates no duplicates | two-process test + registry unique(identity_algorithm, identity) | 🟢 proven (5/5 classification + adapter concurrency tests) |
| A12 | Quarantined/unrecoverable never fall through to template under the new resolver | resolver contract tests | 🟢 proven |
| A13 | Object Lock COMPLIANCE enforced on AWS | AWS matrix: plain-overwrite probe rejected; object-lock config 200 | ⬜ blocked on S3 gate |

## Completion accounting (Phase 9 scope)

- **Runnable-now items completed:** 13-row checklist defined; 6 items have
  test-level evidence today (A4 partial, A5 partial, A6, A7, A9, A10, A11,
  A12 — counted as proven-in-tests, not accepted).
- **Blocked by external input:** A1–A3, A8 (need INV/export + staging), A13
  (needs AWS provisioning approval).
- **Gate count:** 2 red (INV, S3), 4 green (DB, BIND, RUN, CUT — test-level).

## Sign-off rule

The migration is accepted only when every ⬜ is 🟢 and every 🟡 is promoted to
🟢 on **real data numbers**, with the inventory report and AWS matrix output
attached to this document's run record.
