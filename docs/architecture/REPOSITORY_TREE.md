# Repository Tree

> Verified against the checkout on `v0/homepage-redesign`. This document records the repository structure and representative important files; it is not a functional or product-architecture catalog.

## Root

```text
.
├── actions/                 Server Actions for auth, lessons, billing, admin, and settings
├── app/                     Next.js App Router routes and route-local components
├── components/              Shared React components and UI primitives
├── constants/               Application constants and route/permission definitions
├── content/                 Static content modules, including library and resources
├── database/                Drizzle schema, SQL migrations, seeds, and seed helpers
├── docs/                    Project, product, and architecture documentation
├── hooks/                   Shared React hooks
├── i18n/                    Internationalization configuration and request helpers
├── lib/                     Database, auth, Supabase, AI, admin, dashboard, and utility modules
├── messages/                Arabic, English, and Chinese translation catalogs
├── public/                  Public images and static assets
├── src/trigger/             Background lesson-generation entrypoint
├── validation/              Server-input validation schemas
├── AGENTS.md                Repository agent rules
├── CLAUDE.md                Assistant/project instructions
├── components.json          UI component configuration
├── drizzle.config.ts        Drizzle Kit configuration
├── eslint.config.mjs        ESLint configuration
├── instrumentation.ts       Server instrumentation entrypoint
├── instrumentation-client.ts Client instrumentation entrypoint
├── next.config.ts           Next.js configuration
├── package.json              Package manifest and scripts
├── pnpm-lock.yaml            pnpm dependency lockfile
├── package-lock.json         npm dependency lockfile present in the checkout
├── pnpm-workspace.yaml       pnpm workspace configuration
├── postcss.config.mjs        PostCSS configuration
├── proxy.ts                  Request proxy entrypoint
├── trigger.config.ts         Trigger configuration
└── tsconfig.json             TypeScript configuration
```

## Application routes and pages

```text
app/
├── _components/
│   ├── image-slot.tsx
│   ├── mobile-header-menu.tsx
│   └── public-header.tsx       Shared public header/navigation
├── admin/                       Admin layout, pages, tables, forms, and hooks
│   ├── _components/admin-sidebar.tsx
│   ├── audit-logs/
│   ├── credit-packages/
│   ├── employees/
│   ├── generation-events/
│   ├── lessons/
│   ├── profile/
│   ├── roles/
│   ├── schema/
│   ├── settings/
│   ├── teachers/
│   └── templates/
├── api/webhooks/paddle/route.ts Paddle webhook endpoint
├── auth/                         Login, signup, recovery, and callback routes
├── dashboard/                    Teacher dashboard, lesson creation, folders, history, and sharing
├── help/                         Public help page and browser component
├── l/[token]/                    Public share-link lesson route and frame route
├── lesson-studio/page.tsx        Lesson studio page
├── library/                      Public educational library
│   ├── _components/library-browser.tsx
│   ├── [slug]/page.tsx
│   └── page.tsx
├── products/page.tsx              Public products page
├── resources/                    Public resources page and resource card
├── unauthorized/page.tsx          Unauthorized access page
├── globals.css                    Global styles
├── icon.png                       App icon
├── layout.tsx                     Root layout
└── page.tsx                       Home page
```

The library navigation is implemented in `app/_components/public-header.tsx` and `components/mobile-navigation.tsx`; the route is `/library`.

## Shared components and hooks

```text
components/
├── dashboard/                    Dashboard filters, tables, explorers, and stat cards
├── shared/                       CRUD actions, dialogs, data tables, forms, and status fields
├── ui/                           Installed reusable UI primitives
├── language-switcher.tsx
├── mobile-navigation.tsx         Responsive public mobile navigation
├── search-form.tsx
├── theme-provider.tsx
├── theme-toggle.tsx
└── ...

hooks/
└── use-mobile.ts
```

## Actions, validation, and backend libraries

```text
actions/                          Server Actions for auth, lessons, folders, generation, purchases, and admin domains
├── auth.ts
├── generation.ts
├── lessons.ts
├── purchases.ts
└── ...

validation/                       Input schemas for auth, profile, admin, settings, and domain forms
├── auth.ts
├── lessons-related domain validators are colocated where applicable
└── ...

lib/
├── admin/                        Admin permissions, audit logging, settings, and query modules
├── ai/                           Lesson generation, file-text extraction, schemas, and AI client
├── auth/                         Auth DAL and auth-flow helpers/tests
├── crypto/                       Secret-box utilities
├── dashboard/                    Teacher dashboard formatting and queries
├── db/                           Drizzle database connection and database test helpers
├── supabase/                     Supabase client, server, proxy, and admin clients
├── templates/                    Template bundling, player composition, and validation
├── paddle.ts and paddle-client.ts Payment integration helpers
└── ...
```

## Database

```text
database/
├── schema/                       Drizzle table and enum definitions
│   ├── index.ts
│   ├── users.ts, roles.ts, permissions.ts, role-permissions.ts
│   ├── lessons.ts, lesson-versions.ts, folders.ts, share-links.ts
│   ├── generation-events.ts, audit-logs.ts
│   ├── templates.ts, schema-definitions.ts
│   ├── credit-packages.ts, credits-ledger-entries.ts, purchases.ts
│   ├── app-settings.ts, system-settings.ts, enums.ts
│   └── deferred.ts
├── migrations/                   SQL migrations and Drizzle metadata snapshots
│   ├── 0001_*.sql through 0021_*.sql
│   └── meta/
├── seed-data/                    Seed-data documentation
├── seeder/                       Permission, role, schema, and definition seed helpers
└── seed.mjs                      Seed entrypoint
```

Migration filenames are summarized with `*` because the directory contains the numbered files from `0001` through `0021`; the exact files and snapshots are present in the checkout.

## Background workflows and tests

```text
src/trigger/generate-lesson.ts    Background lesson-generation trigger entrypoint
trigger.config.ts                 Trigger runtime configuration

lib/ai/*.test.ts                  AI generation tests and test hooks
lib/auth/*.test.ts                Auth, OAuth, PKCE, and recovery tests
lib/db/index.test.ts              Database test coverage/helpers
lib/lesson-levels.test.mjs        Lesson-level utility test
```

## Static assets and content

```text
content/
├── help.ts
├── library.ts                     Current static library catalog data
└── resources.ts

public/
├── images/                        Product, hero, and library artwork
├── book.png
├── book-transparent.png
├── logo.png
└── ...

messages/
├── ar.json
├── en.json
└── zh.json
```

## Documentation

```text
docs/
├── architecture/
│   ├── ADR-001-navigation-shells.md
│   ├── REPOSITORY_TREE.md
│   └── SYSTEM_ARCHITECTURE_MAP.md
├── product/
│   ├── BOOK_LIBRARY_SPECIFICATION.md
│   ├── TEACHER_JOURNEY.md
│   └── VISION.md
├── PRD.md
├── README.md
├── ai-pipeline.md
├── api-reference.md
├── architecture.md
├── data-model.md
├── development.md
├── frontend.md
└── tech-stack.md
```

## Scope and maintenance

- This tree intentionally excludes `node_modules/`, build output, caches, and generated dependency internals.
- Entries with `...` are deliberate concise groupings of verified directory contents, not invented paths.
- Keep exact route and file names in source control; update this document when a major directory, route group, or shared subsystem is added, removed, or renamed.
