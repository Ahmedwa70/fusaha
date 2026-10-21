# ADR-001: Global Navigation Shells

- **Status:** Accepted
- **Date:** 2026-10-21

## Context and problem

Fusaha currently renders navigation at several page and layout boundaries. Public pages, authentication pages, the teacher dashboard, and administration each have different responsibilities, but their headers and branding controls are not yet governed by one explicit ownership model. Without a shell boundary, future changes could duplicate headers, leak marketing navigation into authenticated workspaces, or make route classification dependent on fragile URL checks.

## Decision

Fusaha will use three explicitly separated navigation shells. Each shell owns one reusable navigation component or composition, and route classification is based on the route tree and layouts rather than substring checks.

### 1. Public Website Shell

Owns anonymous marketing and information experiences. It provides the approved Fusaha logo, public navigation, responsive desktop/mobile behavior, language switching, theme control, and relevant authentication calls to action.

Confirmed current routes:

- `/` — homepage and marketing landing page.
- `/products` — public products page.

Planned public categories with no current route found in `constants/routes.ts` or `app/**/page.tsx`:

- Pricing
- Resources
- Help Center
- About Fusaha

### 2. Authentication Shell

Owns the simplified authentication header: approved logo, language switcher, theme control where supported, and no full marketing navigation. It must preserve all existing forms, callbacks, providers, redirects, and authentication behavior.

Confirmed current routes:

- `/auth/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/reset-password`

`/auth/callback` is a route handler, not a page shell; it performs the callback flow and renders no navigation.

### 3. Application Shell

Owns authenticated workspaces and internal navigation. It preserves workspace-specific navigation, account controls, permissions, and actions. It must not inject public marketing navigation.

Confirmed current routes:

- `/dashboard`
- `/dashboard/create`
- `/dashboard/folders`
- `/dashboard/folders/[id]`
- `/dashboard/history`
- `/dashboard/lessons/[id]`
- `/dashboard/lessons/[id]/run`
- `/dashboard/shared`
- `/dashboard/credits`
- `/dashboard/profile`
- `/lesson-studio`
- `/admin`
- `/admin/teachers`
- `/admin/employees`
- `/admin/roles`
- `/admin/lessons`
- `/admin/lessons/[id]`
- `/admin/credit-packages`
- `/admin/audit-logs`
- `/admin/generation-events`
- `/admin/templates`
- `/admin/schema`
- `/admin/schema/[id]`
- `/admin/settings`
- `/admin/profile`

The application shell may have workspace-specific compositions: the teacher dashboard uses `DashboardHeader` from `app/dashboard/_components/dashboard-header.tsx`; administration uses `AdminSidebar` plus the admin layout header from `app/admin/layout.tsx`. These remain separate internal navigation experiences, not public navigation.

## Shared-component ownership and reuse rules

- The future public shell owns one reusable public header and responsive navigation. It replaces duplicated public header markup currently present in `app/page.tsx` and `app/products/page.tsx` without changing public behavior.
- The authentication shell owns one reusable simplified header composition. The four auth pages currently repeat equivalent logo, `ThemeToggle`, and `LanguageSwitcher` markup and are candidates for consolidation.
- The application shell continues to own dashboard and admin navigation separately because their permissions, workspace actions, and information architecture differ.
- Route constants in `constants/routes.ts` are the source of truth for navigable application routes. Shell selection must follow the route tree/layout boundary, not `pathname.includes(...)` checks.
- The approved `/book-transparent.png` asset is the shared brand mark. Legacy assets remain untouched in this phase.

## Theme, responsive, and branding requirements

- All shells must support the existing light/dark theme system without changing semantic tokens or global theme behavior.
- Public and authentication headers must support desktop, tablet, and mobile layouts without horizontal scrolling.
- Language switching and theme controls must remain available wherever they exist today.
- Logo sizing may adapt to the shell and viewport, but the approved asset and accessible alternative text must remain consistent.
- Existing application shell controls, account menus, permissions, and workspace actions are protected behavior.

## Non-goals and protected behavior

This decision does not implement or redesign the shells. It does not change routes, permissions, authentication providers, callbacks, business logic, page content, assets, CSS tokens, or workspace layouts. It does not add a navigation framework or dependency. It does not delete legacy assets. It does not create missing public pages for pricing, resources, help, or about content.

## Unresolved route classifications

- `/l/[token]` is a public shared-lesson player route, but it is not a marketing page and currently has no explicit shell classification. Treat it as **standalone/shared-player** for implementation review rather than forcing it into the Public Website Shell.
- `/unauthorized` is an access-denied page with no clear current shell ownership. Classify it during implementation review; default recommendation is a minimal standalone/auth-adjacent shell, not full public navigation.

### Implementation clarification (2026-10-21)

- `/l/[token]` is confirmed as **standalone/shared-player**: it resolves an approved lesson by share token and renders only the sandboxed lesson frame, so it must not receive the public or application header.
- `/unauthorized` is confirmed as **standalone/access-denied**: it renders an access-denied message and an admin return action without session navigation, so it remains outside the three reusable shells.
- The Public Website Shell is implemented by `app/_components/public-header.tsx` and is shared by `/` and `/products`; its mobile links preserve section destinations from either route.
- The Authentication Shell is implemented by `app/auth/_components/auth-header.tsx` and is shared by all four authentication pages.
- Dashboard, studio, and administration retain their distinct application compositions because their controls and permissions differ.
- `/dashboard/lessons/[id]/run/frame` and `/l/[token]/frame` are route handlers used to render/embed lesson frames, not navigation pages.
- The requested future pages for Pricing, Resources, Help Center, and About Fusaha have no current routes and therefore remain unclassified until routes are created.

## Acceptance criteria for later implementation

1. Every rendered page route has one explicit shell classification or is listed as unresolved above.
2. Public pages share one reusable public header with consistent logo, order, spacing, responsive behavior, language control, theme control, and auth CTA.
3. Auth pages share one simplified header and show no full marketing navigation.
4. Dashboard and admin workspaces retain their existing internal navigation and account/permission behavior.
5. No shell uses fragile URL substring checks for classification.
6. Existing routes, permissions, authentication behavior, business logic, assets, and workspace layouts remain unchanged.
7. Desktop, tablet, and mobile checks pass in both themes with no horizontal overflow or header overlap.
8. No new dependency is introduced solely for navigation.
