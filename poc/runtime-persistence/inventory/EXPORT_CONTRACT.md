# Runtime Persistence — Real-Data Export Contract (v1)

This contract defines the **anonymized export** consumed by the read-only
inventory tool (`inventory-tool.mjs`). It exists so a production-data
classification can run **without any connection to the application database**
and without exposing personal or content data.

## Hard rules

- The export contains **identifiers and timestamps only**. No lesson names,
  no user emails, no `content`, no `html_player` bytes, no share tokens.
  Identifiers may be pseudonymized (e.g. `sha256(real-id).slice(...)`) as long
  as they are **stable within one export** — joins depend on it.
- The exporter (a human with read-only access, or a nightly job) is
  responsible for producing it. The tool never connects to a database.
- The validator **rejects** any file carrying PII-shaped fields, missing
  required fields, unknown enum values, or malformed timestamps — a partial
  or incompatible export must fail loudly, never classify silently.

## Format (JSON, `exportVersion: 1`)

```json
{
  "exportVersion": 1,
  "exportedAt": "2026-11-02T00:00:00Z",
  "lessons": [
    { "lessonId": "id", "state": "draft|generating|generation_failed|approved", "currentApprovedVersionId": "id|null" }
  ],
  "lessonVersions": [
    {
      "lessonVersionId": "id",
      "lessonId": "id",
      "versionNumber": 1,
      "status": "draft|approved",
      "createdAt": "2026-01-01T00:00:00Z",
      "approvedAt": "2026-01-02T00:00:00Z|null",
      "schemaDefinitionId": "id|null",
      "runtimeBindingStatus": "unbound|bound|legacy|quarantined|unrecoverable",
      "runtimeVersionId": "id|null"
    }
  ],
  "schemaDefinitions": [
    { "schemaDefinitionId": "id", "templateId": "id|null" }
  ],
  "templates": [
    { "templateId": "id", "updatedAt": "2026-01-01T00:00:00Z" }
  ],
  "runtimes": [
    {
      "runtimeVersionId": "id",
      "identity": "sha256-v1-<64 hex>",
      "state": "pending|published|failed|quarantined|deletion_pending|collected"
    }
  ],
  "shareLinks": [
    { "lessonId": "id", "active": true }
  ]
}
```

## Evidence mapping (mirrors `lib/runtime/historical-runtime-classification.ts`)

- **E1 — player bytes available**: `schemaDefinitions.templateId != null` **and**
  the schema definition's template row exists in `templates`. (The DB engine
  also checks `html_player IS NOT NULL`; a template row present in the export
  implies its bytes existed at export time.)
- **E2 — immutability evidence**: `templates.updatedAt <= lessonVersions.createdAt`
  for the version's template. Conservative: any later template edit (any
  column) forfeits the evidence.
- **E3 — legacy decision**: operator-supplied, passed to the tool separately
  (`--decisions decisions.json`, shape: `[{ "lessonVersionId", "reason" }]`).
  A decision with a blank reason classifies as `legacy-decision` but is listed
  as a human decision to fix — it must never be applied.

## Field semantics

| Field | Meaning |
| --- | --- |
| `lessons.state` / `lessonVersions.status` | as in `database/schema/enums.ts` (string form) |
| `runtimeBindingStatus` | `RuntimeBindingStatus` string form |
| `runtimes.state` | `RuntimeVersionState` string form |
| `currentApprovedVersionId` | the version a share link actually plays |
| `shareLinks.active` | only `active: true` links are analysed |

## Minimal exporter SQL sketch (reference only — run by the data owner)

```sql
-- one statement per array; pseudonymize ids with a stable salt hash if desired
SELECT id, state, current_approved_version_id FROM lessons;
SELECT id, lesson_id, version_number, status, created_at, approved_at,
       schema_definition_id, runtime_binding_status, runtime_version_id
FROM lesson_versions;
SELECT id, template_id FROM schema_definitions;
SELECT id, updated_at FROM templates;
SELECT id, identity, state FROM runtime_versions;
SELECT lesson_id, active FROM share_links;
```
