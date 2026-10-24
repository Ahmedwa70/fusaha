# System Architecture Map

> A selective map of the current repository architecture. It records confirmed structure and observed responsibilities from a limited set of entrypoints and configuration files; it is not a replacement for implementation documentation.

## 1. System shape

Fusaha is a Next.js 16 App Router application with React 19, TypeScript, next-intl, Supabase SSR/session handling, Drizzle ORM over PostgreSQL, AI SDK integrations, Trigger.dev background tasks, Sentry observability, and Paddle billing dependencies.

```text
Browser
  │
  ▼
Next.js App Router (app/)
  ├── Root layout, locale, direction, theme, translations
  ├── Public routes: homepage, products, resources, shared lesson
  ├── Auth routes: login, signup, recovery, callback
  ├── Teacher workspace: dashboard, lesson creation, lesson editor/player,
  │   folders, history, credits, profile, shared lessons
  ├── Admin workspace: teachers, employees, roles, lessons, templates,
  │   schema, settings, audit and generation events
  └── API/webhook and frame routes
        │
        ├── Server actions / route handlers (actions/, app/api/)
        ├── Authentication/session proxy (proxy.ts → lib/supabase/)
        ├── Domain queries and services (lib/)
        ├── Database access (lib/db/ → database/schema/)
        ├── Background lesson generation (src/trigger/)
        └── External services: Supabase, AI providers/Gateway, Paddle, Sentry
```

## 2. Runtime and request boundaries

### 2.1 Next.js request boundary

- `app/` is the primary route tree and uses the App Router.
- `app/layout.tsx` establishes locale, direction, Arabic font, theme, translation provider, tooltip provider, and the global top loader.
- Route layouts provide workspace boundaries. `app/dashboard/layout.tsx` requires a teacher and renders the dashboard header and content container.
- `proxy.ts` delegates request session handling to `lib/supabase/proxy` for dashboard, admin, and login matcher paths.
- `next.config.ts` composes next-intl and Sentry configuration, defines the login redirect, and raises the Server Actions body limit for template payloads.

### 2.2 Server-side mutation and query boundary

- `actions/` contains server actions for application mutations.
- `app/api/` contains route handlers, including webhook boundaries.
- `lib/admin/queries/` and `lib/dashboard/queries/` group read/query logic by workspace.
- `lib/auth/` owns authentication data-access helpers; the dashboard layout uses `requireTeacher` to protect the teacher workspace.
- `lib/db/` is the database access boundary, while `database/schema/` exports the active Drizzle schema modules.

### 2.3 Background generation boundary

`src/trigger/generate-lesson.ts` defines the `generate-lesson` Trigger.dev task. It receives a lesson/version/teacher payload, calls `lib/ai/generate-lesson`, validates the generated content, updates lesson and version records transactionally, records generation events, logs failures, and marks failed generations. The task exists outside the request timeout boundary and can run for up to 600 seconds.

## 3. Route and shell architecture

The route tree separates four practical experience types:

1. **Public website:** `/` and `/products`, with public information and product discovery.
2. **Authentication:** `/auth/login`, `/auth/signup`, password recovery/reset, and callback handling.
3. **Authenticated application:** `/dashboard/**`, `/lesson-studio`, and `/admin/**`, with teacher and administrator compositions.
4. **Standalone routes:** `/l/[token]` for shared lesson playback and `/unauthorized` for access-denied handling.

The accepted navigation decision in `ADR-001-navigation-shells.md` establishes three reusable shells—Public Website, Authentication, and Application—while keeping shared-player and access-denied routes standalone. The application shell is intentionally split between teacher dashboard and admin workspace because their permissions and controls differ.

## 4. Domain and persistence map

The active schema export in `database/schema/index.ts` includes:

- **Identity and authorization:** users, roles, permissions, and role-permissions.
- **Teaching content:** lessons, lesson versions, folders, share links, templates, and schema definitions.
- **Generation and operations:** generation events, audit logs, system settings, and app settings.
- **Credits and billing:** credit packages, purchases, and credit ledger entries.

The repository also contains `database/migrations/`, seed data, and seeding helpers. The schema index explicitly distinguishes active schema modules from deferred tables, so deferred design ideas should not be represented as current persistence capabilities.

## 5. Lesson-generation flow

```text
Teacher submits lesson creation input
  │
  ▼
Application action/route creates or updates lesson/version state
  │
  ▼
Trigger.dev `generate-lesson` task receives source, blueprint,
validation script, locale, and ownership identifiers
  │
  ▼
`lib/ai/generate-lesson` calls the AI generation pipeline
  │
  ▼
Generated content is validated
  ├── errors → generation-failed state + failed generation event + logs/Sentry
  └── valid → lesson version content saved + lesson returns to draft
              + successful generation event
  │
  ▼
Teacher reviews/edits/approves and can run or share the lesson
```

The flow is intentionally asynchronous. Generation failures are persisted as domain state and generation events; the task comments state that credits are not refunded because the AI call and retries consume real cost.

## 6. Cross-cutting services

- **Localization:** `next-intl`, locale messages under `messages/`, and locale configuration under `i18n/`.
- **UI system:** shared components under `components/`, including `components/ui/`, plus route-local components under `app/**/_components/`.
- **Validation:** `validation/` and lesson/template validation helpers protect input and generated content.
- **Observability:** Sentry is configured for Next.js and initialized explicitly in the Trigger.dev process; application logging uses the shared logger.
- **Billing:** Paddle SDK and related configuration are present; credit packages, purchases, and ledger entries are part of the active schema.
- **File/content processing:** PDF and DOCX parsing dependencies are present for content extraction in the lesson workflow. This does not establish a persistent book library.
- **Security boundary:** Supabase SSR session handling, route proxy matching, authenticated layouts, role/permission schema, and server-side actions form the current security layers.

## 7. Architectural strengths

- Clear App Router route boundaries for public, authentication, teacher, and admin experiences.
- Dedicated persistence modules and a single schema export boundary.
- Long-running AI generation moved into a durable/background task rather than the request lifecycle.
- Generated lesson content is validated before a successful version update.
- Generation success/failure is recorded as domain data, with logging and Sentry coverage.
- Navigation shell ownership is documented in an accepted ADR.

## 8. Architectural gaps and boundaries

- The repository contains no confirmed persistent book/resource-library domain. PDF/DOCX parsing supports lesson creation rather than a catalog of books.
- The product vision includes future products and resource concepts, but the architecture map treats them as future until routes, services, and schema prove otherwise.
- The active schema index does not by itself document foreign-key details or row-level policies; those require targeted inspection of individual schema modules and Supabase configuration.
- `next.config.ts` currently documents redirects, dev origins, Server Actions size, next-intl, and Sentry composition; response security headers are not mapped here because they were not observed in the inspected configuration.
- The architecture map does not infer deployment topology beyond the configured Next.js, Trigger.dev, Supabase, Sentry, AI, and Paddle boundaries.

## 9. Source-of-truth files inspected

- `package.json`
- `next.config.ts`
- `proxy.ts`
- `app/layout.tsx`
- `app/dashboard/layout.tsx`
- `src/trigger/generate-lesson.ts`
- `database/schema/index.ts`
- `docs/architecture/ADR-001-navigation-shells.md`
- `docs/architecture/REPOSITORY_TREE.md`

## 10. Maintenance rule

Update this map when a route boundary, persistence domain, background task, external service, or shell ownership decision changes. Keep claims labeled as current, planned, or unresolved; do not promote a product-vision proposal into the current architecture without implementation evidence.
