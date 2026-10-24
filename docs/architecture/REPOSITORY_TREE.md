# Repository Tree

> Verified from the repository directory structure. This document records names and organization only; it is not a functional or architectural analysis.

## Root

```text
.
├── actions/                 Server actions
├── app/                     Next.js App Router routes and route-local components
├── components/              Shared React components
├── constants/               Application constants
├── content/                 Static content modules
├── database/                Schema, migrations, seeds, and seeding helpers
├── docs/                    Project documentation
├── hooks/                   Shared React hooks
├── i18n/                    Internationalization configuration/helpers
├── lib/                     Shared server/client libraries
├── messages/                Translation message catalogs
├── public/                  Public assets
├── src/                     Trigger and background entrypoints
├── validation/              Validation schemas and domain validation
├── AGENTS.md                Repository agent rules
├── CLAUDE.md                Assistant/project instructions
├── components.json          UI component configuration
├── drizzle.config.ts       Drizzle configuration
├── eslint.config.mjs       ESLint configuration
├── next.config.ts           Next.js configuration
├── package.json             Package manifest
├── proxy.ts                 Request proxy configuration
├── tsconfig.json            TypeScript configuration
├── trigger.config.ts        Trigger configuration
└── lockfiles                npm, pnpm, and workspace lock/config files
```

## Application route groups

```text
app/
├── _components/
├── admin/
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
├── api/
│   └── webhooks/
├── auth/
│   ├── _components/
│   ├── callback/
│   ├── forgot-password/
│   ├── login/
│   ├── reset-password/
│   └── signup/
├── dashboard/
│   ├── _components/
│   ├── create/
│   ├── credits/
│   ├── folders/
│   ├── history/
│   ├── lessons/
│   ├── profile/
│   └── shared/
├── help/
│   ├── _components/
│   └── page route
├── l/
│   └── [token]/
├── lesson-studio/
├── products/
├── resources/
│   └── _components/
└── unauthorized/
```

## Shared code groups

```text
components/
├── dashboard/
├── shared/
│   ├── data-table/
│   └── form/
└── ui/

lib/
├── admin/
│   └── queries/
├── ai/
├── auth/
├── crypto/
├── dashboard/
│   └── queries/
├── db/
├── supabase/
└── templates/

database/
├── migrations/
│   └── meta/
├── schema/
├── seed-data/
└── seeder/
```

## Documentation groups

```text
docs/
├── architecture/
│   ├── ADR-001-navigation-shells.md
│   └── REPOSITORY_TREE.md
└── product/
    ├── BOOK_LIBRARY_SPECIFICATION.md
    ├── TEACHER_JOURNEY.md
    └── VISION.md
```

## Scope and maintenance

- The tree intentionally excludes `node_modules/` internals and generated build output.
- Names describe repository organization, not confirmed runtime responsibilities.
- Update this document when a top-level directory or major route/library group is added, removed, or renamed.
