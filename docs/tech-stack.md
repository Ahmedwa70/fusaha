# Technology Stack

Everything the project depends on, and the reason it is there. Versions reflect
`package.json` at the time of writing.

## Core framework

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.3.3 | App Router, React Server Components, Server Actions, route handlers |
| **React** | 19.2.8 | UI runtime; Server and Client Components |
| **TypeScript** | 5.x | Strict mode, `moduleResolution: "bundler"`, single path alias `@/*` → repo root |
| **pnpm** | 11.5.2 | Package manager (pinned via `packageManager`) |

> **Next.js 16 specifics.** This version differs from older Next.js in ways that matter:
> middleware is now `proxy.ts` (not `middleware.ts`), `params`/`searchParams` are
> Promises that must be awaited, and typed helpers like `LayoutProps<"/">` replace
> hand-written props. `AGENTS.md` at the repo root carries the framework's own
> generated guidance; the authoritative docs are in `node_modules/next/dist/docs/`.

## Data layer

| Technology | Role |
|---|---|
| **PostgreSQL** (hosted on Supabase) | Primary database |
| **Drizzle ORM** `^0.45` | Schema definition in TypeScript, type-safe queries |
| **drizzle-kit** `^0.31` | Migration generation and execution |
| **postgres** (`postgres-js`) `^3.4` | Postgres driver. Configured with `prepare: false`, which is **required** for the Supabase transaction-mode connection pooler |

## Authentication and identity

| Technology | Role |
|---|---|
| **Supabase Auth** (`@supabase/supabase-js`, `@supabase/ssr`) | Email/password and Google OAuth, session cookies, password reset |

Supabase supplies authentication and the Postgres instance only. **Supabase Storage is
not used** — there are no file uploads to object storage anywhere in the codebase.

Authorization is entirely application-side: a `users` table mirrors `auth.users.id` and
carries the role, and `lib/auth/dal.ts` is the single source of truth for access checks.

## AI

| Technology | Role |
|---|---|
| **Vercel AI SDK** (`ai` `^7`) | Model-agnostic generation interface, structured object output |
| **`@ai-sdk/deepseek`** | DeepSeek provider |
| **DeepSeek models** | `deepseek-v4-flash` for text sources, `deepseek-v4-flash-vision-exp` for image sources |

The DeepSeek API key is **not an environment variable**. It lives encrypted in the
`system_settings` table and is managed by admins at `/admin/settings`, so it can be
rotated without a redeploy. See [ai-pipeline.md](./ai-pipeline.md).

## Background jobs

| Technology | Role |
|---|---|
| **Trigger.dev** (`@trigger.dev/sdk` 4.5.16) | Runs lesson generation outside the request cycle |

Generation regularly exceeds serverless function timeouts (Vercel kills a Hobby function
at 60s, and platform kills bypass `try/catch`, which would strand lessons in a
`Generating` state with credits already deducted). Trigger.dev tasks get up to 600s.

## Payments

| Technology | Role |
|---|---|
| **Paddle** (`@paddle/paddle-node-sdk` `^3.10`) | Merchant of record, checkout, webhooks |
| **Paddle.js** | Loaded from Paddle's CDN at runtime — there is no npm browser package |

Paddle replaced an earlier Stripe integration (migration `0019`).

## Document parsing

| Technology | Role |
|---|---|
| **pdf-parse** `^2.4` | Extract text from uploaded PDFs (max 2 pages) |
| **mammoth** `^1.12` | Extract raw text from `.docx` |
| **jszip** `^3.10` | Unpack admin-uploaded template ZIPs into a single inlined HTML file |

## UI

| Technology | Role |
|---|---|
| **shadcn/ui** (`base-nova` style, `rtl: true`) | Component generator; components are copied into `components/ui/` and owned by this repo |
| **Base UI** (`@base-ui/react` `^1.7`) | Headless primitives behind 26 of the 29 UI components |
| **radix-ui** `^1.6` | Used by exactly one component (`color-picker.tsx`, for its Slider) |
| **Tailwind CSS** v4 | CSS-first configuration — there is no `tailwind.config.*`; all theming lives in `app/globals.css` |
| **`@tailwindcss/typography`** | `.prose` styling for generated Markdown |
| **tw-animate-css** | Animation utilities |
| **lucide-react** | Icon set |
| **next-themes** | Light/dark/system theming via a `class` attribute |
| **@tanstack/react-table** `^8.21` | Admin data tables (sorting, filtering, pagination, column visibility) |
| **react-hook-form** + **@hookform/resolvers** | All forms |
| **zod** `^4.5` | Validation schemas, shared between client and server |
| **react-markdown** + **remark-gfm** | Rendering Markdown content |
| **nextjs-toploader** | Route-change progress bar |
| **use-debounce** | Debounced inputs |

Notably absent: **there is no toast library.** All feedback is rendered inline
(field errors, status banners, save indicators) or through confirmation dialogs.

## Internationalization

| Technology | Role |
|---|---|
| **next-intl** `^4.14` | Translations, `getTranslations` on the server, `useTranslations` on the client |

Three locales: **`ar`** (default, RTL), **`en`**, **`zh`**. The locale lives in a cookie,
not in the URL — there is no `[locale]` route segment. Layout direction is applied
server-side on `<html dir>`, and the UI uses logical CSS properties
(`ms-*`, `pe-*`, `text-start`, `inset-e-*`) rather than physical left/right ones.

## Observability

| Technology | Role |
|---|---|
| **Sentry** (`@sentry/nextjs` `^10.73`) | Error tracking for browser, server, edge, and the Trigger.dev task (which initializes Sentry itself, since the Next.js config never runs in that process) |
| **pino** `^10.3` | Structured server logging, level from `LOG_LEVEL` |

Two domain-level observability tables also exist: `generation_events` (per-attempt token
counts, latency, success/failure) and `audit_logs` (who changed what).

## Utilities

| Technology | Role |
|---|---|
| **clsx** + **tailwind-merge** | The `cn()` class helper in `lib/utils.ts` |
| **class-variance-authority** | Component variant definitions |
| **color** | Hex parsing in the admin colour picker |
| **node:crypto** | AES-256-GCM encryption of stored secrets (`lib/crypto/secret-box.ts`) |
| **node:vm** | Sandbox for running admin-authored template validation scripts |

## Dependencies worth flagging

- **`@napi-rs/canvas`** is declared but **never imported**. No image generation exists in
  the codebase. It can be removed unless a future feature needs it.
- **`radix-ui`** is retained for a single Slider. Migrating `color-picker.tsx` to Base UI
  would let the dependency go.
- **`components/search-form.tsx`** is leftover shadcn scaffolding with hardcoded English
  text and no usages.
