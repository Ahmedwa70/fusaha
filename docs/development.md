# Development Guide

## Prerequisites

- **Node.js 20+** (the Trigger.dev task targets the `node-24` runtime)
- **pnpm 11.5.2** — pinned in `package.json`; enable with `corepack enable`
- A **Supabase** project (provides both Postgres and authentication)

## First-time setup

```bash
pnpm install
cp .env.example .env     # then fill it in — see below
pnpm db:migrate          # apply schema
pnpm db:seed             # roles, permissions, the first level
pnpm dev
```

The app runs at `http://localhost:3000`.

### After seeding, before you can generate

The seeder creates the `teacher` and `admin` roles, all 31 permissions, grants them all
to `admin`, and inserts the level-1 schema definition (prompt read from
`database/seed-data/lesson-schema-v2.md`).

Two manual steps remain:

1. **Create an admin user.** Sign up through `/auth/signup` (which creates a *teacher*),
   then change that user's `role_id` to the `admin` role directly in the database.
2. **Link a template to the level.** The seeded schema definition has
   `template_id = NULL`, and `createLesson` rejects any level without a template
   (`invalidLevel`). Upload a template ZIP at `/admin/templates`, then edit the level at
   `/admin/schema` to point at it.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Supabase Postgres pooler URL. Throws at module load if missing |
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **yes** | Anon/publishable key |
| `SUPABASE_SECRET_KEY` | **yes** | Service-role key for `auth.admin.*`. Bypasses RLS — **server only, never expose** |
| `APP_KEY` | **yes** | Master secret for AES-256-GCM encryption of `system_settings` |
| `TRIGGER_SECRET_KEY` | **yes** | Authenticates `tasks.trigger()` and the deploy CLI. Read by the SDK itself |
| `NEXT_PUBLIC_SITE_URL` | production | Allowed public host for the `x-forwarded-host` open-redirect guard in the auth callback |
| `PADDLE_API_KEY` | for payments | Paddle server API key |
| `PADDLE_ENV` | for payments | `"production"` selects production; anything else is sandbox |
| `PADDLE_WEBHOOK_SECRET` | for payments | Signature verification. Without it the webhook returns 500 |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | for payments | Paddle.js client token |
| `NEXT_PUBLIC_PADDLE_ENV` | for payments | Paddle.js environment |
| `SENTRY_DSN` | optional | Server, edge, and Trigger.dev error reporting |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Browser error reporting |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | optional | Build-time source-map upload |
| `LOG_LEVEL` | optional | pino level; defaults to `info` |

**There is no `DEEPSEEK_API_KEY`.** The DeepSeek key is stored encrypted in the
`system_settings` table and set by an admin at `/admin/settings`. This is intentional —
it lets the key be rotated without a redeploy. See
[ai-pipeline.md §2](./ai-pipeline.md).

Paddle and Sentry both **fail soft**: if their variables are absent the app runs
normally with those features disabled, which is the expected local-development state.

> ⚠️ `APP_KEY` cannot be rotated casually. Every value in `system_settings` is encrypted
> with a key derived from it; changing it makes those values unrecoverable and they must
> be re-entered.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build (uploads Sentry source maps when configured) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (flat config, `next/core-web-vitals` + TypeScript) |
| `pnpm db:migrate` | Apply pending migrations (`drizzle-kit migrate`) |
| `pnpm db:seed` | Idempotent seed — safe to re-run |

There is **no** test script, no typecheck script, and no `db:generate` script. Generate
migrations with `pnpm dlx drizzle-kit generate`.

## Common workflows

### Changing the database schema

1. Edit or add a file in `database/schema/` (one table per file, kebab-case).
2. Export it from `database/schema/index.ts`.
3. `pnpm dlx drizzle-kit generate` — review the generated SQL before trusting it.
4. `pnpm db:migrate`.
5. Commit both the `.sql` file **and** the `meta/` snapshot. Drizzle needs the snapshot
   to diff correctly next time.

### Adding a permission

1. Add the key to `database/seeder/permissions.mjs` — the single source of truth.
2. `pnpm db:seed`.
3. Guard the action or page with `requirePermission("<key>")`.
4. Grant it to the relevant roles at `/admin/roles`.

Re-seeding also **deletes** permission keys removed from that file, cascading to
`role_permissions`. That is deliberate, but it means removing a key revokes it everywhere.

### Adding a feature

The read/write split is the main thing to respect:

- Mutation → a new exported action in `actions/<domain>.ts`, with its zod schema in
  `validation/<domain>.ts` as a translator-taking factory.
- Read → a function in `lib/dashboard/queries/` or `lib/admin/queries/`.
- Admin mutations should call `recordAuditLog`.
- Route-local UI goes in `_components/` and `_hooks/` beside the route; only genuinely
  cross-route components belong in `components/`.
- Add translations to **all three** of `messages/ar.json`, `en.json`, `zh.json`.
  Arabic is the default locale and the one users see first.
- Use logical CSS properties (`ms`, `me`, `ps`, `pe`, `text-start`) so RTL works with no
  extra effort.

### Working on the Trigger.dev task

`src/trigger/generate-lesson.ts` deploys **separately** from the Next.js app, via the
`trigger.dev` CLI. Project `proj_wpqmgsqxtcdhsnaaimqc`, runtime `node-24`,
`maxDuration` 3600s globally and 600s for the task, 3 retries with exponential backoff.

Remember that this process is not a Next.js request: `next-intl` server APIs and the
Next.js Sentry config do not apply, which is why the task handles both itself.

## Deployment

The target is **Vercel** — the task's own comments cite Vercel's 60-second Hobby function
timeout as the reason generation was moved off-request.

Checklist:

1. Set every environment variable above in the hosting environment.
2. Run `pnpm db:migrate` against the production database.
3. Deploy the Trigger.dev task separately with the `trigger.dev` CLI.
4. Point the Paddle webhook at `https://<your-domain>/api/webhooks/paddle` and set
   `PADDLE_WEBHOOK_SECRET` to match.
5. Add `https://<your-domain>/auth/callback` to the Supabase redirect allow-list, and set
   `NEXT_PUBLIC_SITE_URL` to the canonical domain (the open-redirect guard depends on it).
6. Set the DeepSeek API key at `/admin/settings` — it is not an environment variable.

## Notes on this Next.js version

This project runs **Next.js 16.3.3**, which differs from older versions in ways that will
bite you if you assume otherwise:

- Middleware is **`proxy.ts`** at the root, exporting `proxy(request)` and `config.matcher`.
- `params` and `searchParams` are **Promises** and must be awaited.
- Typed helpers such as `LayoutProps<"/">` replace hand-written prop types.
- `experimental.serverActions.bodySizeLimit` is raised to `10mb` for template uploads.

`AGENTS.md` at the repo root is **generated and rewritten by `next dev`**. If it shows up
dirty in your diff, commit it with your work rather than reverting it — reverting only
recreates the change on the next dev run. The authoritative docs for this version live in
`node_modules/next/dist/docs/`.

## Code style

- Kebab-case filenames throughout, including components.
- `"use server"` at the top of the module, never per-function.
- `import "server-only"` in any module that must not reach the browser.
- Server Actions return `{ error }` / `{ success: true }` — they do not throw for
  expected failures.
- Reference routes through the `ROUTES` object in `constants/routes.ts`.
- Commits follow a loose Conventional Commits style: imperative subject, mostly `feat:`,
  no scopes.
