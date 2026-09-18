# Architecture

## 1. The shape of the system

Fusaha is a single Next.js 16 application. There is no separate backend service and no
REST API. The application is split by **audience**, not by tier:

```
                      ┌──────────────────────────────────────────┐
  Anonymous  ────────▶│  /               marketing landing page  │
  visitor            │  /l/[token]      shared lesson player     │
                      └──────────────────────────────────────────┘

                      ┌──────────────────────────────────────────┐
  Teacher    ────────▶│  /dashboard/**   library, create, credits │
                      └──────────────────────────────────────────┘

                      ┌──────────────────────────────────────────┐
  Admin /    ────────▶│  /admin/**       users, roles, levels,    │
  employee            │                  templates, settings      │
                      └──────────────────────────────────────────┘
```

Three layers sit underneath:

| Layer | Location | Responsibility |
|---|---|---|
| **Read side** | `lib/dashboard/queries/`, `lib/admin/queries/` | Every database read. Called from Server Components. All modules are `server-only`. |
| **Write side** | `actions/` | Every mutation, as a Server Action. Validates, authorizes, writes, audits, revalidates. |
| **Domain** | `lib/ai/`, `lib/templates/`, `lib/paddle.ts`, `lib/crypto/`, `lib/auth/` | Business logic that neither reads nor writes on its own. |

The read and write sides mirror each other by entity: `actions/teachers.ts` writes what
`lib/admin/queries/teacher.ts` reads.

## 2. Request lifecycle

### A page load

1. **`proxy.ts`** (Next.js 16's replacement for `middleware.ts`) matches `/dashboard/**`,
   `/admin/**`, and `/auth/login`. It refreshes the Supabase session cookie and performs
   an **optimistic** redirect for obviously-unauthenticated requests.
   This is a fast path for UX, **not a security boundary.**
2. The **layout** calls `requireTeacher()`, `requireAdmin()`, or the page calls
   `requirePermission(key)`. These live in `lib/auth/dal.ts` and are the real gate. They
   `redirect()` rather than returning an error.
3. The Server Component awaits a query from `lib/*/queries/` and renders.
4. Client Components receive plain serializable props. Where translated strings are
   needed in a leaf that may be rendered from either side, the module exports the
   translation *key* rather than the resolved string.

### A mutation

1. A Client Component calls an imported Server Action directly.
2. The action re-authorizes from scratch — it never trusts the caller.
3. It parses input with a zod schema built from the request's translations.
4. It writes, usually inside a transaction, and records an audit log for admin actions.
5. It calls `revalidatePath(...)` for every affected route.
6. It returns `{ error: string }` or `{ success: true }`. **Actions do not throw for
   expected failures.** Callers narrow with `if ("error" in result)`.

The client wraps the call in `useTransition` so the form stays disabled until the
action settles and the revalidated page has streamed back.

### Async generation

Lesson generation cannot complete inside a request. `createLesson` deducts credits,
creates the lesson in a `Generating` state, and enqueues a Trigger.dev task. The browser
polls with `router.refresh()` every 4 seconds until the state changes. There are no
websockets and no Supabase Realtime subscriptions anywhere.

## 3. Authorization model

```
users.role_id ──▶ roles ──▶ role_permissions ──▶ permissions
```

- **`teacher`** and **`admin`** are system roles (`is_system = true`) and cannot be
  edited or deleted through the UI.
- **"Employees"** are users holding any other, admin-created role.
- `requireAdmin()` means **"any role that is not `teacher`"**. It grants entry to the
  admin shell, nothing more.
- Actual capability is always `requirePermission("<key>")` against one of 31 permission
  keys. `database/seeder/permissions.mjs` is the single source of truth for that list,
  and re-seeding **prunes** keys that have been removed from it.
- `getRolePermissionKeys(roleId)` also filters the admin sidebar, so a user never sees a
  link that would bounce them to `/unauthorized`.

Every lookup in the DAL is wrapped in React's `cache()`, so repeated calls within one
request hit the database once.

## 4. Repository layout

```
actions/          Server Actions — one file per domain. "use server" on line 1.
app/              App Router.
  _components/      shared with the landing page
  admin/**          staff area; each route has private _components/ and _hooks/
  api/webhooks/     the only real HTTP API surface (Paddle)
  auth/             login, signup, password reset, OAuth callback
  dashboard/**      teacher area
  l/[token]/        anonymous shared lesson player
components/
  ui/               shadcn primitives (Base UI). Owned by this repo, safe to edit.
  shared/           cross-feature composites: forms, data tables, dialogs
  dashboard/        teacher-facing reusable widgets
constants/        permissions, ROUTES, lesson source limits
database/
  schema/           one table per file + barrel index.ts
  migrations/       drizzle-kit SQL + meta snapshots
  seeder/           idempotent seed modules (plain .mjs, run by node directly)
  seed-data/        the level-1 AI prompt, as Markdown
hooks/            global hooks only (currently just use-mobile)
i18n/             locale config + next-intl request config
lib/              server-side domain logic and query layers
messages/         ar.json / en.json / zh.json
public/           static assets
src/trigger/      Trigger.dev tasks — see note below
validation/       zod schemas, one file per domain
```

### Two layout details that surprise people

**`src/` is not a Next.js `src` directory.** `app/` lives at the repository root. `src/`
exists solely because `trigger.config.ts` declares `dirs: ["./src/trigger"]`, and
Trigger.dev tasks must live in a directory it scans, outside the Next.js app tree. It
contains exactly one file.

**`proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the convention. It exports
`proxy(request)` plus a `config.matcher`.

## 5. Conventions in force

**Files and naming**
- Every file is `kebab-case`, including components (`credit-package-form-dialog.tsx`).
- Exports are `PascalCase` for components, `camelCase` for functions.
- Route-local components and hooks live in `_components/` and `_hooks/` beside the route.
  The underscore excludes them from routing.
- `database/schema/index.ts` is the only barrel file.
- Routes are never hardcoded in JSX — use the `ROUTES` object from `constants/routes.ts`.

**Server boundaries**
- Server-only modules start with `import "server-only"`.
- `"use server"` goes at the **top of the module**, never per-function.

**Validation**
- zod schemas are **factory functions taking a translator**:
  `updateTeacherSchema(t)`. The same schema is used by the client (`useTranslations`)
  and the server action (`getTranslations`), so error messages are localized once.
- Field-level zod issues are surfaced on the client. The server returns a single generic
  translated message on parse failure.

**Database**
- Status enums are **plain TypeScript numeric enums stored as `smallint`**
  (`database/schema/enums.ts`), not Postgres enums. The two exceptions —
  `purchase_status` and `ledger_reason` — are genuine `pgEnum`s.
- Multilingual user-facing values are stored as `jsonb` in the shape
  `{ ar?: string; en?: string; zh?: string }` and resolved with
  `resolveLocalizedText(value, locale)`.
- Admin-managed secrets go in `system_settings` (encrypted). Admin-tunable business
  values go in `app_settings` (plaintext). Neither belongs in `constants/`.

**Styling**
- Tailwind v4, CSS-first. All tokens are OKLCH and defined in `app/globals.css` under
  `@theme inline`.
- Two brand ramps: `brand-50…950` (navy) and `gold-50…900`.
- Sidebar chrome is deliberately dark navy in **both** themes.
- Use logical properties (`ms`, `me`, `ps`, `pe`, `text-start`, `inset-s`, `inset-e`)
  so RTL works without overrides. Motion is gated behind `motion-safe:`.

## 6. Known architectural gaps

These are accurate as of this writing and worth knowing before extending the system.

| Area | Current state |
|---|---|
| Template validation sandbox | `lib/templates/run-validation.ts` uses `node:vm`, which is **not a security boundary**. Admin-authored scripts are trusted. `isolated-vm` is the noted follow-up. |
| Generated content validation | `updateLessonVersionContent` accepts `content: unknown` and persists it to `jsonb` without validation. |
| Refund accounting | Generation refunds are written to the ledger with `reason: "admin_adjustment"`, not a dedicated refund reason, which makes reconciliation ambiguous. |
| `lessons.updated_at` | Has no database trigger and is not set by `moveLessonToFolder`, `approveLesson`, or content edits — yet the dashboard orders by it. |
| `deleteRole` | Does not check for users still assigned to the role; the `users.role_id` foreign key is `no action`, so it surfaces a raw constraint violation. |
| `deleteTeacher` | Performs no role check, so it can delete an admin by id. Only self-deletion is blocked. |
| `setLocale` | Unauthenticated and writes the cookie value without validating it against the locale list. |
| PRD §9.4 | The "3 corrections = 1 credit" internal-correction accounting is not implemented. |
| `database/schema/deferred.ts` | A deliberate parking lot of designed-but-unbuilt tables (`generation_jobs`, `level_definitions`, `activity_types`). |
