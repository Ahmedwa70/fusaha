# Data Model

PostgreSQL (hosted on Supabase), defined in TypeScript with Drizzle ORM under
`database/schema/` — one table per file, re-exported from `index.ts`.

## Conventions

- Primary keys are `uuid` with `defaultRandom()`, except `users.id` (mirrors
  `auth.users.id` and is supplied by Supabase) and the two settings tables (keyed by
  their `key` text column).
- All timestamps are `timestamptz` with `defaultNow()`.
- **Status enums are TypeScript numeric enums stored as `smallint`**, defined in
  `database/schema/enums.ts` — not Postgres enums. Only `purchase_status` and
  `ledger_reason` are real `pgEnum`s.
- **Localized text** is `jsonb` shaped `{ ar?: string; en?: string; zh?: string }`,
  resolved at read time by `resolveLocalizedText(value, locale)` with the fallback chain
  *requested locale → `ar` → first non-empty value*.

## Enums

**TypeScript, stored as `smallint`**

| Enum | Values |
|---|---|
| `LessonState` | `Draft = 0`, `Generating = 1`, `GenerationFailed = 2`, `Approved = 3` |
| `VersionStatus` | `Draft = 0`, `Approved = 1` |
| `SourceType` | `Images = 0`, `TextDirect = 1`, `TextPasted = 2`, `Pdf = 3`, `Docx = 4` |

**Postgres enums**

| Enum | Values |
|---|---|
| `purchase_status` | `pending`, `completed`, `failed` |
| `ledger_reason` | `purchase`, `admin_adjustment`, `generation` |

## Relationships

```
roles ──┬──< role_permissions >── permissions
        │
        └──< users ──┬──< folders ──< lessons
                     │                  │
                     ├──< lessons ──────┼──< lesson_versions >── schema_definitions ──> templates
                     │                  │
                     │                  └──< share_links
                     │
                     ├──< purchases >── credit_packages
                     ├──< credits_ledger_entries
                     ├──< generation_events
                     └──< audit_logs
```

---

## Identity and access

### `users`
Mirrors Supabase `auth.users`. Deleting a row cascades to nearly everything the user owns.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | **No default** — set from the Supabase auth user id |
| `email` | text NOT NULL | |
| `name` | text NOT NULL | |
| `role_id` | uuid NOT NULL → `roles.id` | `no action` on delete |
| `credits_balance` | int NOT NULL default 0 | Authoritative balance; the ledger is the history |
| `paddle_customer_id` | text NULL | Cached after the first checkout |
| `active` | bool NOT NULL default true | Inactive users are signed out on every request |
| `created_at` | timestamptz NOT NULL | |

### `roles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | Slug, **matched literally in code** (`"teacher"`, `"admin"`). Unique index. |
| `title` | text NOT NULL | Display name |
| `is_system` | bool NOT NULL default false | System roles cannot be edited or deleted through the UI |

### `permissions`
`id` uuid PK · `key` text NOT NULL (unique index). Seeded from
`database/seeder/permissions.mjs`, which is the single source of truth.

### `role_permissions`
`role_id` → `roles.id` CASCADE · `permission_id` → `permissions.id` CASCADE.
Composite primary key on both columns.

---

## Content

### `folders`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid NOT NULL → `users.id` CASCADE | |
| `name` | text NOT NULL | |
| `parent_id` | uuid NULL | Declared for future nesting, but **has no foreign key and is unused** |
| `created_at` | timestamptz NOT NULL | |

### `lessons`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid NOT NULL → `users.id` CASCADE | |
| `name` | text NOT NULL | Backfilled from `content.meta.title` when generation completes and the teacher left it blank |
| `current_approved_version_id` | uuid NULL | **Intentionally no foreign key** — avoids a circular FK with `lesson_versions` |
| `state` | smallint NOT NULL default `Draft` | `LessonState` |
| `folder_id` | uuid NULL → `folders.id` SET NULL | |
| `deleted_at` | timestamptz NULL | **Soft delete.** Teacher deletes set it; admins can restore or hard-delete |
| `created_at`, `updated_at` | timestamptz NOT NULL | ⚠️ `updated_at` has no trigger and is not maintained by most actions, yet the dashboard orders by it |

### `lesson_versions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `lesson_id` | uuid NOT NULL → `lessons.id` CASCADE | |
| `version_number` | int NOT NULL | No unique constraint on `(lesson_id, version_number)` |
| `status` | smallint NOT NULL default `Draft` | `VersionStatus` |
| `schema_definition_id` | uuid NOT NULL → `schema_definitions.id` **RESTRICT** | **This is how a lesson's level is known — there is no level column** |
| `content` | jsonb NOT NULL | Untyped. The shape is whatever the linked template defines |
| `source_type` | smallint NULL | `SourceType` |
| `created_at` | timestamptz NOT NULL | |
| `approved_at` | timestamptz NULL | |

Versions are append-only in practice: restoring an old version copies its content into a
new version at `max + 1` rather than rewriting history.

### `share_links`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `lesson_id` | uuid NOT NULL → `lessons.id` CASCADE | One per lesson by convention, not enforced |
| `token` | text NOT NULL | `randomBytes(24).toString("base64url")`. Unique index |
| `active` | bool NOT NULL default true | Toggling off keeps the token, so re-enabling revives old URLs |
| `created_at` | timestamptz NOT NULL | |

---

## Authoring configuration

### `schema_definitions` — "levels"
A level is a versioned AI instruction bound to a template.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `level_key` | text NOT NULL | Stable slug, server-generated as `level-<8 hex>`. Survives renames |
| `level` | jsonb NOT NULL | Localized display name |
| `version` | text NOT NULL | Matches `^\d+(\.\d+)*$` |
| `content` | text NOT NULL | The AI system prompt |
| `template_id` | uuid NULL → `templates.id` **RESTRICT** | Generation refuses a level with no template |
| `active` | bool NOT NULL default false | **At most one active version per `level_key`** — enforced in the action, not the schema |
| `created_at` | timestamptz NOT NULL | |

Unique constraint on `(level_key, version)`.

### `templates`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `html_player` | text NOT NULL | Self-contained HTML that reads `window.LESSON_DATA` |
| `blueprint` | text NOT NULL | A filled-in example lesson, used as a few-shot reference |
| `validation_script` | text NOT NULL | CommonJS module exporting `(content) => ({ errors, warnings })` |
| `preview_image` | text NULL | `data:` URI — there is no blob storage |
| `active` | bool NOT NULL default true | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

---

## Billing

### `credit_packages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | jsonb NOT NULL | Localized; required in every locale |
| `credits_amount` | int NOT NULL | |
| `price` | int NOT NULL | **Minor units (cents).** The admin form takes major units and multiplies by 100 |
| `currency` | text NOT NULL default `'USD'` | |
| `active` | bool NOT NULL default true | |
| `paddle_price_id` | text NULL | `pri_…` — without it, checkout is impossible |
| `badge_label`, `subtitle`, `footer_text` | jsonb NULL | Localized marketing copy |
| `features` | jsonb NOT NULL default `[]` | Array of localized strings, one per bullet |
| `color_dark` | text NULL | Hex accent; tints are derived at render time with CSS `color-mix` |
| `created_at` | timestamptz NOT NULL | |

### `purchases`
One row per checkout attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → `users.id` CASCADE | |
| `package_id` | uuid NOT NULL → `credit_packages.id` | `no action` — a purchased package cannot be deleted |
| `credits_amount`, `price`, `currency` | | Snapshotted at purchase time so later package edits don't rewrite history |
| `status` | `purchase_status` NOT NULL default `pending` | |
| `paddle_transaction_id` | text NOT NULL | Written as the literal `"pending"`, then patched with the real id |
| `paddle_payment_method` | text NULL | From `payments[0].methodDetails.type` on the webhook |
| `created_at`, `completed_at` | timestamptz | |

### `credits_ledger_entries`
Append-only history. `users.credits_balance` is the authoritative balance; this table
explains it.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL → `users.id` CASCADE | |
| `delta` | int NOT NULL | Signed — negative for generation |
| `reason` | `ledger_reason` NOT NULL | |
| `ref_id` | uuid NULL | Purchase id, or lesson id for generation/refund. **No foreign key** |
| `created_at` | timestamptz NOT NULL | |

> ⚠️ Two gaps worth knowing: generation **refunds** are recorded as
> `admin_adjustment` rather than a dedicated reason, and `updateTeacher` overwrites
> `credits_balance` directly **without writing a ledger entry at all**.

---

## Operations

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid NULL → `users.id` SET NULL | The actor survives their own deletion |
| `action` | text NOT NULL | A permission key |
| `resource_type`, `resource_id` | text NOT NULL | Polymorphic; `resource_id` is plain text |
| `old_values`, `new_values` | jsonb NULL | Secrets are never recorded — only key names |

`recordAuditLog` never throws; failures are logged to the console so an audit problem
can't fail the user's action.

### `generation_events`
Per-attempt telemetry, surfaced at `/admin/generation-events`.

`lesson_id` → `lessons.id` SET NULL · `teacher_id` → `users.id` SET NULL ·
`source_type` smallint · `success` bool NOT NULL · `duration_ms` int ·
`prompt_tokens` / `completion_tokens` / `total_tokens` int · `error_message` text.

### `system_settings` — encrypted secrets
`key` text PK · `encrypted_value` text NOT NULL · `updated_at` · `updated_by` → `users.id` SET NULL.

Values are AES-256-GCM, stored as `iv.authTag.ciphertext` (base64, dot-joined). The key
is derived with `scryptSync(APP_KEY, "system-settings-secret-box", 32)`.

Known key: **`deepseek_api_key`**. The admin UI only ever displays a masked value.

### `app_settings` — plaintext business values
`key` text PK · `value` text NOT NULL · `updated_at` · `updated_by`.

| Key | Default | Purpose |
|---|---|---|
| `generation_cost` | `10` | Credits deducted per generation |
| `auto_payment_enabled` | `true` | When false, `/dashboard/credits` shows a WhatsApp contact button instead of Paddle checkout |
| `whatsapp_contact_number` | — | Required when auto-payment is off |

---

## Migrations

22 migration files under `database/migrations/`, plus `meta/_journal.json` snapshots.
Notable turning points:

| Migration | Change |
|---|---|
| `0001` | Core schema: users, folders, lessons, lesson_versions, share_links, roles, permissions |
| `0005`–`0007` | Levels reworked: `level_definitions` dropped in favour of `schema_definitions` keyed on `(level, version)`, then given a uuid primary key |
| `0008`–`0009` | Billing introduced; `ledger_reason` gains `generation`; the level columns move onto the `schema_definition_id` foreign key |
| `0011`–`0014` | Templates introduced and iterated (`template_id` NOT NULL, then nullable again) |
| `0017` | `level_key` added and `level` converted to `jsonb` with a backfill |
| **`0019`** | **Stripe → Paddle.** All `stripe_*` columns dropped, `paddle_*` added |
| `0021` | Credit package display fields converted from `text` to localized `jsonb` |

### Deferred schema
`database/schema/deferred.ts` holds designed-but-unbuilt tables, commented out on
purpose: `generation_jobs` (+ its status enum), `level_definitions`, `activity_types`.
They are a parking lot, not dead code — leave them unless the feature is being built.
