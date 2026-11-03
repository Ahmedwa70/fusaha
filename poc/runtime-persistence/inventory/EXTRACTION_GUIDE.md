# Real-Data Export — Extraction Guide (for the data owner)

This guide tells the person with **read-only** production access how to produce
the anonymized export consumed by `inventory-tool.mjs`. The schema below was
verified column-by-column against the Drizzle schema in
`database/schema/` on branch `feat/hide-authenticated-start-cta`.

You only need: `psql` (or any SQL client) with a **read-only** role, and a
machine that can run `node` to validate the result.

---

## 1. Safety rules

1. Use a read-only database role. Every statement below is a `SELECT` —
   nothing writes, locks, or mutates.
2. Never export: lesson names, user emails, `lesson_versions.content`,
   `templates.html_player`, `templates.blueprint`,
   `templates.validation_script`, or `share_links.token`.
   The validator rejects any export containing PII-shaped fields.
3. IDs may be pseudonymized with a stable salted hash
   (`sha256(salt || id)`), but they must be **stable within one export** —
   the tool joins across arrays.
4. Keep the raw export off shared drives; treat it like production metadata.

## 2. Enum mapping (DB stores smallint — convert to strings)

| Enum | smallint → string |
| --- | --- |
| `LessonState` | 0→draft, 1→generating, 2→generation_failed, 3→approved |
| `VersionStatus` | 0→draft, 1→approved |
| `RuntimeBindingStatus` | 0→unbound, 1→bound, 2→legacy, 3→quarantined, 4→unrecoverable |
| `RuntimeVersionState` | 0→pending, 1→published, 2→failed, 3→quarantined, 4→deletion_pending, 5→collected |

## 3. Extraction SQL (six statements, one per export array)

```sql
-- lessons
SELECT id, state, current_approved_version_id
FROM lessons
WHERE deleted_at IS NULL;

-- lessonVersions  (map status + runtime_binding_status per §2)
SELECT id, lesson_id, version_number, status, created_at, approved_at,
       schema_definition_id, runtime_binding_status, runtime_version_id
FROM lesson_versions;

-- schemaDefinitions
SELECT id, template_id
FROM schema_definitions;

-- templates  (updated_at only — never the player bytes)
SELECT id, updated_at
FROM templates;

-- runtimes  (identity/state per contract; state mapped per §2)
SELECT id, identity, state
FROM runtime_versions;

-- shareLinks  (token deliberately excluded)
SELECT lesson_id, active
FROM share_links;
```

Notes:

- `lessons.deleted_at IS NULL` excludes soft-deleted lessons; remove the
  filter only if the inventory must reason about them.
- `lesson_versions.schema_definition_id` is NOT NULL in the app schema, but
  a `schema_definitions` row with `template_id IS NULL` yields no player
  evidence — the contract's `null` semantics still apply via the join, so
  export the raw FK value as-is.
- Timestamps: emit ISO-8601 UTC (`2026-11-02T00:00:00Z`); the validator
  rejects non-ISO stamps.

## 4. Assemble and validate

Assemble the six result sets into one JSON document:

```json
{
  "exportVersion": 1,
  "exportedAt": "<ISO-8601 UTC now>",
  "lessons": [ ... ],
  "lessonVersions": [ ... ],
  "schemaDefinitions": [ ... ],
  "templates": [ ... ],
  "runtimes": [ ... ],
  "shareLinks": [ ... ]
}
```

Field names must match `EXPORT_CONTRACT.md` exactly (camelCase).

Validate and classify in one step — the runner validates per the contract,
prints the classification summary, and writes a timestamped report under
`migration/reports/`:

```bash
bash poc/runtime-persistence/inventory/run-inventory.sh export.json
```

- Exit `0` = valid; the report holds the classification summary.
- Exit `1` = invalid file — nothing is classified; fix and re-validate.
- Exit `2` = wrong invocation.

(Underlying tool, equivalent: `node poc/runtime-persistence/inventory/inventory-tool.mjs export.json`.)

## 5. Optional: operator decisions

If product/ops already knows certain historical versions were rendered from a
now-edited template (or otherwise), supply them separately so the tool records
a human decision instead of guessing:

```bash
node poc/runtime-persistence/inventory/inventory-tool.mjs export.json \
  --decisions decisions.json
```

`decisions.json` shape: `[{ "lessonVersionId": "...", "reason": "..." }]`.
A decision with a blank `reason` classifies as `legacy-decision` but is listed
as a human decision to fix — it is never applied silently.

## 6. What comes back

The tool prints, per run:

- counts per classification bucket (already-bound, bound-candidate, legacy,
  quarantined-gap, quarantined-conflict, out-of-scope-draft, remediated),
- share links affected by each bucket,
- integrity violations (Bound/Legacy pointing at missing or non-published
  runtimes, orphan published runtimes),
- the human-decision list for sign-off.

That summary is the input to the migration execution plan
(`../migration/MIGRATION_EXECUTION_PLAN.md`) — the plan does not start until
the inventory numbers are known and the acceptance gates in
`../migration/ACCEPTANCE_GATES.md` are agreed.
