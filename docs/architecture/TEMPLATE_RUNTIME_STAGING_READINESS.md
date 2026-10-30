# Template Runtime Staging Readiness
## Phase 4.1 — Isolated Environment Verification and Setup Specification

**Document ID:** FUSAHA-ARCH-TR-004  
**Related specification:** `TEMPLATE_RUNTIME_ARCHITECTURE.md`  
**Related implementation plan:** `TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN.md`  
**Related readiness report:** `TEMPLATE_RUNTIME_PHASE_0_READINESS.md`  
**Status:** Verification and documentation only  
**Date:** October 2026  
**Final status:** **BLOCKED — safe persistent implementation cannot proceed**

---

## 1. Scope and Constraints

This report determines whether the repository has the prerequisites for implementing a persistent PostgreSQL runtime package store.

No database connection was opened. No environment-variable value was read or printed. No migration was generated or executed. No database record, application code, schema file, deployment, or infrastructure was changed.

The report uses only repository configuration, migration files, package scripts, and integration availability metadata. It does not treat the presence of an environment-variable name as proof that the value is configured, valid, isolated, or non-production.

---

## 2. Executive Conclusion

# BLOCKED — safe implementation cannot proceed

A persistent production adapter cannot be implemented safely yet because an isolated staging/development database was not verified in this session.

The repository is prepared to support PostgreSQL through Drizzle, but the following are not proven:

- A database separate from production exists.
- Its credentials are independently managed.
- Its connection string is not a production connection string.
- Its role has only the required staging permissions.
- The target contains no unauthorized production data.
- Migrations can be applied and rolled back safely there.
- Concurrent registration and transaction behavior can be tested against the real PostgreSQL engine.

### Exact next action required

Provision or identify a **separate non-production PostgreSQL/Supabase project** with independently managed staging credentials, then provide a safe verification context for it. Verify the connection and migration history read-only before implementing the persistent runtime store.

Do not reuse the current `DATABASE_URL`, `SUPABASE_SECRET_KEY`, or any other production credential. Do not point Drizzle at an unknown database to discover whether it is staging.

---

## 3. Evidence Collected

### 3.1 Drizzle client

**File:** `lib/db/index.ts`

Verified behavior:

- Uses `drizzle-orm/postgres-js`.
- Creates a `postgres` client from `process.env.DATABASE_URL`.
- Uses `{ prepare: false }`, matching the documented transaction-mode Supabase pooler setup.
- Imports the active schema from `database/schema/index.ts`.
- Initializes lazily through a proxy, so importing the module does not immediately open a connection.
- Throws `DATABASE_URL is not set` when the database is first used without the variable.

This proves the application database technology and connection boundary. It does not prove which database any configured value points to.

### 3.2 Drizzle Kit configuration

**File:** `drizzle.config.ts`

Verified configuration:

```text
schema: ./database/schema/index.ts
out:    ./database/migrations
dialect: postgresql
credentials: process.env.DATABASE_URL
```

The config imports `dotenv/config` and throws when `DATABASE_URL` is absent. The same connection variable is therefore used for migration commands unless the command environment is deliberately isolated.

### 3.3 Package scripts and versions

**File:** `package.json`

Verified:

- Package manager: `pnpm@11.5.2`.
- `drizzle-orm`: `^0.45.2`.
- `drizzle-kit`: `^0.31.10`.
- `postgres`: `^3.4.9`.
- `db:migrate`: `drizzle-kit migrate`.
- `db:seed`: `node database/seed.mjs`.
- No dedicated `db:generate` script; the development guide uses `pnpm dlx drizzle-kit generate`.

The repository has a migration execution path, but no script-level environment guard that rejects production URLs or requires a staging marker.

### 3.4 Schema and migration workflow

**Files:**

- `database/schema/index.ts`
- `database/schema/*.ts`
- `database/migrations/*.sql`
- `database/migrations/meta/_journal.json`
- `docs/development.md`

Verified workflow:

1. Edit or add one table per schema file under `database/schema/`.
2. Export the schema from `database/schema/index.ts`.
3. Generate SQL using Drizzle Kit.
4. Review the generated SQL.
5. Apply it with `pnpm db:migrate`.
6. Commit both SQL and the matching `meta/` snapshot.

The repository currently contains migration SQL through the `0022_add_library_books.sql` entry and matching Drizzle metadata entries through index 21 in the inspected journal. The migration directory has numbered SQL files and snapshots, which indicates an established migration history.

No migration was executed or changed by this report.

### 3.5 Environment template

**File:** `.env.example`

The template declares:

- `DATABASE_URL` — Supabase Postgres pooler URL.
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SECRET_KEY`.
- Application, Trigger.dev, Paddle, Sentry, and logging variables.

The example contains placeholders, not usable credentials. It does not define separate `STAGING_DATABASE_URL`, `DATABASE_ENV`, `SUPABASE_STAGING_*`, or an equivalent non-production safety marker.

### 3.6 Documentation evidence

**File:** `docs/development.md`

The development guide says that local setup requires a Supabase project, copying `.env.example`, filling the variables, and running `pnpm db:migrate`. It identifies `DATABASE_URL` as a Supabase Postgres pooler URL and documents `pnpm db:migrate` as applying pending migrations.

The deployment section explicitly describes running `pnpm db:migrate` against the production database as a deployment step. Therefore, an unguarded invocation with an unknown `DATABASE_URL` carries a real production-risk path.

### 3.7 Integration availability

Integration availability metadata did not verify a connected Supabase database integration for this session. Project environment-variable names are not proof of a connected staging resource and do not disclose whether any database URL points to production.

No database schema was retrieved from a live integration. No live RLS, foreign-key, role, extension, or migration-table state was verified.

---

## 4. Current Database Architecture

### 4.1 Application connection

```text
Next.js / Trigger-adjacent server code
  -> lib/db/index.ts
  -> postgres(process.env.DATABASE_URL, { prepare: false })
  -> drizzle(client, { schema })
  -> PostgreSQL / Supabase pooler
```

The same general database environment is used by application queries and Drizzle migrations. The separation between development, staging, preview, and production is therefore an environment-management concern, not an enforced repository boundary.

### 4.2 Active schema

`database/schema/index.ts` exports the active application tables, including:

- Users, folders, lessons, lesson versions, share links.
- Roles, permissions, role permissions.
- Templates and schema definitions.
- Generation events and audit logs.
- Credits, purchases, credit packages.
- Library books.
- System/app settings.

No runtime package table or lesson-version runtime foreign key exists in the inspected active schema. That is expected at this phase; adding them requires a later approved migration.

### 4.3 Migration history

The repository follows Drizzle's SQL-plus-snapshot workflow:

```text
schema source
  -> drizzle-kit generate
  -> database/migrations/<number>_<tag>.sql
  -> database/migrations/meta/<number>_snapshot.json
  -> drizzle-kit migrate
```

The migration journal is PostgreSQL/Drizzle Kit version 7 metadata. The current workflow does not provide a repository-level database-target allowlist or a production-URL rejection guard.

---

## 5. Isolated Environment Determination

### 5.1 Required condition

The persistent runtime store needs a PostgreSQL target that is:

- Separate from production.
- Independently credentialed.
- Safe for destructive migration rehearsal.
- Empty or populated only with authorized synthetic/sanitized data.
- Reachable by the migration and test runner.
- Capable of PostgreSQL transactions, unique constraints, foreign keys, and concurrent writes.

### 5.2 What was verified

| Requirement | Evidence | Result |
|---|---|---|
| PostgreSQL client exists | `lib/db/index.ts`, `postgres` dependency | Verified |
| Drizzle migration workflow exists | `drizzle.config.ts`, scripts, migration directory | Verified |
| Active schema source exists | `database/schema/index.ts` | Verified |
| Migration history is committed | SQL files and `meta/_journal.json` | Verified |
| Staging database is separate from production | No repository or integration evidence | Not verified |
| Staging credentials independently managed | No staging-specific variable or integration verified | Not verified |
| Staging connection is safe to migrate | No live read-only verification | Not verified |
| No unauthorized production data | No live database inspection | Not verified |
| Staging RLS/constraints/roles | No live schema inspection | Not verified |
| Migration rollback rehearsal | Not performed, correctly prohibited | Not satisfied |
| Concurrent PostgreSQL registration test | Not performed against PostgreSQL | Not satisfied |

### 5.3 Why the status is BLOCKED rather than READY WITH CONDITIONS

The requested phase is specifically to establish readiness for a persistent PostgreSQL store. The central prerequisite—an independently verified isolated database—is absent. Proceeding to schema or adapter implementation would require guessing the target database, relying on an unverified `DATABASE_URL`, or risking production writes.

The repository-only portion is ready for planning, but the environment itself is not ready for safe persistence work.

---

## 6. Required Staging Setup Specification

The following is the minimum provisioning specification. It is not an instruction to execute provisioning in this task.

### 6.1 Resource

Provision one of:

- A separate Supabase project dedicated to development/staging; or
- A separate PostgreSQL database/cluster with an independently managed owner and migration role.

Do not use a separate schema in the production database as the default substitute. A separate database/project is required to prevent cross-environment destructive operations and credential confusion.

### 6.2 Required identity and credentials

Create separate credentials for:

1. **Migration owner/DDL role**
   - Can create/alter runtime tables, indexes, constraints, and migration bookkeeping in staging.
   - Used only by controlled migration commands.
   - Not embedded in application code.

2. **Application runtime role**
   - Can read/write runtime package and binding records required by the application.
   - Cannot drop unrelated application tables.
   - Cannot bypass authorization or RLS accidentally.

3. **Read-only verification role**
   - Can inspect migration history, schema, constraints, indexes, and row counts.
   - Used for readiness evidence and post-migration verification.

If Supabase is used, retain the distinction between publishable client access and server-only secret/service access. Never copy production service-role credentials into staging or local files.

### 6.3 Required connection configuration

Use a staging-only variable, preferably:

```text
STAGING_DATABASE_URL=<separate non-production PostgreSQL pooler or direct URL>
```

The migration command must receive that value explicitly in a controlled environment. The existing `DATABASE_URL` must not be silently repointed for this task.

Recommended additional non-secret metadata:

```text
DATABASE_ENV=staging
STAGING_PROJECT_REF=<non-production project reference>
```

The metadata is not a security boundary by itself. The actual database identity must be verified through a read-only query and provider/project metadata.

### 6.4 Required database capabilities

The staging target must support:

- PostgreSQL transactions.
- `INSERT ... ON CONFLICT` or equivalent atomic insert-if-absent behavior.
- Unique constraints/indexes on runtime identity.
- Foreign keys with `ON DELETE RESTRICT` for referenced runtime packages.
- Transactional staging/publication of package metadata and files.
- Concurrent sessions for race-condition tests.
- The extension/features required by the current schema.
- Migration bookkeeping compatible with the repository's Drizzle Kit version.

### 6.5 Data policy

The target must start empty or contain only:

- Synthetic fixtures; or
- Explicitly authorized, anonymized data with documented provenance.

Do not copy production credentials, raw user data, private lesson content, share tokens, service secrets, or encrypted settings into staging without a separate authorization and anonymization process.

---

## 7. Verification Checklist for the Next Environment Review

The following checks must be executed only after the staging resource is provisioned and its credentials are available through the approved environment mechanism. Values must not be printed.

### 7.1 Connection identity

Using a read-only staging connection, record masked/non-secret results for:

```sql
select current_database(), current_user, inet_server_addr(), inet_server_port(), version();
```

Verify:

- Database/project identifier is the staging resource.
- Host/project reference is not production.
- Current user is the intended staging role.
- No production host or project reference appears.

### 7.2 Migration state

Read-only inspection must confirm:

- Drizzle migration bookkeeping table exists where expected.
- Applied migration set matches the repository-approved baseline.
- No unknown migration rows exist.
- No migration is partially applied.
- The staging snapshot is recorded before introducing runtime tables.

Do not run `pnpm db:migrate` until this inspection passes.

### 7.3 Schema and permissions

Verify read-only:

- Existing tables and constraints match the committed schema baseline.
- RLS policies match the intended staging behavior if Supabase is used.
- Migration role has DDL privileges only in staging.
- Application role has only required DML privileges.
- Application role cannot drop unrelated tables.
- Read-only verification role cannot mutate data.

### 7.4 Safety marker

Require an explicit non-production marker from the provider/project metadata. A convention such as `DATABASE_ENV=staging` is useful but insufficient without database identity verification.

### 7.5 Data inventory

Verify:

- Row counts are zero or match an approved synthetic fixture manifest.
- No production identifiers, domains, share tokens, or user records appear unless authorized and anonymized.
- No application secret values exist in copied settings.

---

## 8. Minimum Runtime Store Schema Prerequisites

These are design prerequisites for the next implementation phase, not schema changes made by this report.

### 8.1 Runtime package table

A future migration should define an immutable runtime package record with at least:

- Stable UUID primary key or stable runtime identity key.
- Unique content identity, e.g. `sha256-...`.
- Runtime logical ID and implementation version.
- Contract version.
- Package kind and entry point.
- Manifest/package metadata.
- Publication/status timestamps and audit fields.
- Optional source-template reference for audit only, never for render-time resolution.

If package files are stored separately, add an asset/file table keyed to the runtime package with:

- Relative path.
- Content type.
- Integrity hash.
- Byte size.
- Immutable content location or bytes.

### 8.2 Lesson-version binding

A future migration should add a nullable `lesson_versions.runtime_version_id` during expand. It must eventually have:

- A foreign key to the runtime package table.
- `ON DELETE RESTRICT` or equivalent reference safety.
- An index for approved lesson-version resolution.
- A unique/immutable binding rule at the application and database layers.

Existing lesson versions must remain explicitly legacy/unbound until historical evidence is classified. The migration must not infer historical runtime identity from the current mutable `templates` row.

### 8.3 Immutability and deduplication

The schema and repository must enforce:

- Unique runtime content identity.
- No update to executable package content after publication.
- Atomic insert-if-absent behavior for concurrent identical registration.
- Reuse of the existing record for an identical identity.
- A different identity for any executable/manifest change.
- Runtime deletion blocked while any lesson version references it.

### 8.4 Migration shape

Use expand/backfill/contract:

1. Add runtime tables and nullable lesson-version reference.
2. Deploy registry code that can read/write new records without changing existing render behavior.
3. Backfill only rows with verified historical evidence.
4. Report ambiguous/unrecoverable legacy rows explicitly.
5. Dual-read with observable legacy fallback.
6. Cut over dashboard and public sharing together.
7. Only later enforce non-null/legacy removal after acceptance evidence.

---

## 9. Safe Testing Strategy

### 9.1 Before first migration

- Restore the staging database to a known snapshot or verify it is empty.
- Save migration journal, schema, constraints, roles, and row-count evidence.
- Run generated SQL review without applying it.
- Verify migration target identity again in the same controlled session.

### 9.2 Migration rehearsal

- Apply the migration to staging only.
- Capture migration output and resulting journal state.
- Inspect tables, constraints, indexes, RLS, and grants.
- Insert synthetic runtime packages and lesson-version bindings.
- Verify duplicate identities reuse one record.
- Verify changed content creates a new identity.
- Verify referenced runtimes cannot be deleted.
- Verify source template/schema changes do not affect bound runtime records.

### 9.3 Concurrency tests

Use multiple PostgreSQL sessions against staging to attempt identical registration simultaneously. Assert:

- Exactly one durable package record exists.
- All callers receive the same identity.
- No partial package is visible.
- A failed transaction leaves no incomplete record.
- Different package contents never collapse to one identity.

### 9.4 Rollback tests

Test both:

- **Application rollback:** revert the runtime-store release while leaving additive runtime rows intact.
- **Migration rollback/recovery:** restore the staging snapshot or apply the approved reverse procedure before contract enforcement.

Do not delete runtime rows as a first-line rollback mechanism. Preserve them for retry and forensic comparison.

### 9.5 Data and security tests

- No production data is present.
- Application role cannot perform DDL.
- Read-only role cannot write.
- Runtime content is isolated from auth/session secrets.
- RLS and owner scoping remain correct.
- Public share authorization remains unchanged.
- Runtime package integrity failure is observable and fails closed.

---

## 10. Production-Safety Controls Required Before Any Future Apply

Before a future staging or production migration command:

1. Use an explicit environment file or secret reference for the intended target.
2. Verify database identity with a read-only query.
3. Require a non-production marker for staging commands.
4. Refuse to run if the target identity is unknown or production when staging is expected.
5. Capture a backup/snapshot and migration journal state.
6. Review generated SQL and its destructive operations.
7. Run the migration first against isolated staging.
8. Record post-migration constraints, grants, and row counts.
9. Obtain approval before any production migration.
10. Keep production credentials out of local shell history, logs, tests, and fixtures.

The current repository does not enforce all of these controls automatically. The operator/runbook must supply them until a guarded migration wrapper is separately approved.

---

## 11. Environment Configuration Summary

### Existing repository configuration

- `DATABASE_URL` is the active application and Drizzle migration connection variable.
- `.env.example` documents a Supabase pooler URL placeholder.
- `drizzle.config.ts` reads `DATABASE_URL` directly.
- `pnpm db:migrate` invokes `drizzle-kit migrate` with no explicit staging guard.
- No staging-specific connection variable is present in `.env.example`.
- No repository code proves that the active project environment is staging.

### Required new environment arrangement

For a safe isolated implementation, provision through the approved project/integration mechanism:

- A separate non-production PostgreSQL/Supabase resource.
- A separate staging connection variable, preferably `STAGING_DATABASE_URL`.
- Independently managed staging migration and application credentials.
- Non-secret environment metadata identifying staging.
- A controlled migration command that cannot silently select production.

These are setup requirements. This report intentionally does not request, print, or configure credential values.

---

## 12. Final Status and Exact Next Action

# BLOCKED — safe implementation cannot proceed

### Evidence

1. The repository has a valid Drizzle/PostgreSQL client and migration workflow.
2. The active schema and migration history are locally inspectable.
3. The environment template contains only a generic `DATABASE_URL` and no staging isolation marker.
4. The migration command uses `DATABASE_URL` directly and has no production-target guard.
5. No isolated staging database, independent credentials, live migration state, RLS, grants, or non-production data boundary was verified.
6. The required database integration is not connected for live schema verification.

### Exact next action

Provision or identify a separate non-production PostgreSQL/Supabase project with independent credentials and a read-only verification role. Then perform the checklist in Section 7 against that staging target, without running migrations initially.

After the checklist passes, the next implementation phase may:

- Add the runtime schema files and migration in an isolated branch.
- Generate and review SQL.
- Apply it to staging only.
- Implement the Drizzle-backed persistent adapter with atomic insert-if-absent semantics.
- Run concurrency, integrity, rollback, and reference-safety tests.

Until then, do not execute `pnpm db:migrate`, do not repoint `DATABASE_URL`, do not add runtime tables, and do not proceed to Phase 5.

---

## 13. Related Documentation

- `docs/architecture/TEMPLATE_RUNTIME_ARCHITECTURE.md`
- `docs/architecture/TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN.md`
- `docs/architecture/TEMPLATE_RUNTIME_PHASE_0_READINESS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_MAP.md`
- `docs/development.md`
- `drizzle.config.ts`
- `lib/db/index.ts`
- `database/schema/index.ts`
- `database/migrations/meta/_journal.json`

**END OF DOCUMENT**
