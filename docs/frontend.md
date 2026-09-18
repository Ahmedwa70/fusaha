# Frontend Guide

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui on Base UI · next-intl

## 1. Route map

There are **no route groups** `(...)`, and **no `loading.tsx`, `error.tsx`, or
`not-found.tsx` files anywhere.** Loading is handled ad-hoc with `Spinner` /
`Loader2Icon` and the `nextjs-toploader` progress bar; missing records call `notFound()`
and fall through to the Next.js built-in 404.

### Root

| Path | Type | Notes |
|---|---|---|
| `app/layout.tsx` | Server | Resolves the locale server-side, sets `<html lang dir>`, loads `IBM_Plex_Sans_Arabic`. Provider stack: `NextTopLoader` → `ThemeProvider` → `NextIntlClientProvider` → `DirectionProvider` → `TooltipProvider`. `generateMetadata()` pulls title and description from the `app` message namespace |
| `/` | Server | Public marketing landing page — hero, before/after, six-step explainer, levels, features, CTA, footer. Swaps the arrow icon by direction |
| `/unauthorized` | Server | Permission-denied screen; `requirePermission()` redirects here |

### Auth — public

`/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` are each a
Server Component page wrapping a `"use client"` form. `/auth/callback` is a route handler.

The login page is a split screen: a branded panel (`ArchPattern`, logo, tagline) beside
the form, with a floating theme toggle and language switcher. The form reads
`?error=account_inactive|account_not_found` from `useSearchParams`.

### Teacher dashboard — `requireTeacher()`

The layout uses a **top bar, not a sidebar**: `<DashboardHeader name email creditsBalance />`.

| Path | Notes |
|---|---|
| `/dashboard` | Welcome banner, four `StatCard`s (total / approved / drafts / active share links), then `LessonsExplorer`. Accepts `?folder=` to pre-select a folder. Fetches lessons, share count, and folders in parallel |
| `/dashboard/create` | Checks `creditsBalance >= generationCost` first — shows a buy-credits empty state if short, otherwise the three-step `CreateLessonWizard` |
| `/dashboard/folders`, `/dashboard/folders/[id]` | Folder grid; detail view with rename/delete and a lesson picker dialog |
| `/dashboard/lessons/[id]` | State badge, level badge, folder select, actions (play / approve / delete), share link card, version history with restore, and `LessonContentEditor` when the latest version is an editable draft. Mounts `GenerationPoller` while generating |
| `/dashboard/lessons/[id]/run` | Fullscreen classroom player: `<iframe sandbox="allow-scripts">` plus a floating exit link |
| `/dashboard/history` | Cross-lesson version history |
| `/dashboard/shared` | Lessons with active share links, with a copy-link button |
| `/dashboard/credits` | Package cards, Paddle buy button or WhatsApp fallback, credits ledger, `PurchaseBalancePoller`. Derives "best value" and savings % from real cost-per-credit rather than an admin flag |
| `/dashboard/profile` | Name and password |

### Admin — `requireAdmin()` + per-page `requirePermission()`

The layout is a `SidebarProvider` / `AdminSidebar` / `SidebarInset` shell. The sidebar is
filtered by `getRolePermissionKeys(roleId)`, so a user never sees a link that would
bounce them to `/unauthorized`.

Every admin page follows the same shape: a **Server Component** awaits
`requirePermission(...)`, fetches, and hands the data to a `"use client"` table.

`/admin` (overview) · `/admin/teachers` · `/admin/employees` · `/admin/roles` ·
`/admin/lessons` + `[id]` · `/admin/credit-packages` · `/admin/templates` ·
`/admin/schema` + `[id]` · `/admin/audit-logs` · `/admin/generation-events` ·
`/admin/settings` · `/admin/profile`

### Public share

`/l/[token]` — fully anonymous, renders a full-viewport sandboxed iframe with no exit
control (there is nothing to exit to). `/l/[token]/frame` serves the HTML.

---

## 2. Components

```
components/
  ui/          29 shadcn primitives — owned by this repo, safe to edit
  shared/      cross-feature composites: forms, data tables, dialogs, badges
  dashboard/   teacher-facing reusable widgets
  language-switcher.tsx, theme-provider.tsx, theme-toggle.tsx
```

Feature-specific components live in `app/**/_components/` beside their route, and
feature hooks in `app/**/_hooks/`. The underscore keeps them out of routing.

### The UI kit is Base UI, not Radix

`components.json`:

```json
{ "style": "base-nova", "rsc": true, "tsx": true,
  "iconLibrary": "lucide", "rtl": true,
  "tailwind": { "config": "", "css": "app/globals.css",
                "baseColor": "neutral", "cssVariables": true } }
```

`style: "base-nova"` with `rtl: true` is the RTL-aware Base UI variant of shadcn. **26 of
the 29 components import from `@base-ui/react`.** The single exception is
`components/ui/color-picker.tsx`, which still uses the Radix Slider — the only reason
`radix-ui` remains a dependency.

Consequences for how you write components:

- Composition uses `render={<Link href=... />}` and `nativeButton={false}`, **not** Radix's
  `asChild`.
- Icon side is expressed as `data-icon="inline-start" | "inline-end"` so button padding
  adapts to writing direction — never `ml-2` / `mr-2`.
- `mergeProps` + `useRender` appear in `badge`, `breadcrumb`, and `sidebar`.

### Key reusable components

**`components/shared/form/base-form.tsx`** — a headless react-hook-form wrapper using a
render prop:

```ts
BaseFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues?: DefaultValues<z.input<T> & FieldValues>;
  onSubmit: (data: z.output<T>) => Promise<{ error: string } | void> | void;
  isLoading?: boolean;
  children: (methods: FormMethods<z.input<T>>) => React.ReactNode;
}
```

The render prop exposes `{ register, setValue, getValues, watch, trigger, control,
errors, rootError }`. Returning `{ error }` from `onSubmit` is mapped to
`setError("root")` automatically — which is exactly the shape every Server Action
returns, so no adapter code is ever needed.

**`components/shared/form/dialog-form.tsx`** — `BaseForm` inside a dialog. Cancels the
close event while a submit is in flight.

**`components/shared/data-table/`** — `data-table.tsx` (state owner) plus `toolbar`,
`content`, `footer`, and `base-columns`. Props: `columns`, `data`, `searchPlaceholder`,
`showSearch`, `toolbarActions`, `showColumnVisibility`, `defaultPageSize = 10`,
`emptyMessage`, `emptyDescription`, `initialColumnVisibility`.

`base-columns.tsx` provides column factories: `createTextColumn` (nullable-safe `—`,
optional truncation), `createStatusColumn`, `createDateColumn`, `createBadgeColumn`,
`createCrudActionsColumn`.

**Others:** `crud-actions.tsx` (view/edit/delete menu), `delete-confirmation-dialog.tsx`
(with `confirmLabel` / `confirmingLabel` / `isLoading`), `status-badge.tsx`,
`info-field.tsx`.

**`components/dashboard/`:** `lessons-explorer.tsx` (search plus level/state/folder
filters, a mobile filter sheet with an active-count badge, self-polling while any lesson
is generating), `lessons-table.tsx` (hand-rolled, **not** TanStack), `lesson-state-badge.tsx`
(exports `lessonStateClassName` and `lessonStateLabelKey` so the label can be resolved by
either `useTranslations` or `getTranslations` — keeping the badge usable from both
environments), `filter-select.tsx`, `stat-card.tsx`.

---

## 3. Styling

**Tailwind v4, CSS-first.** There is no `tailwind.config.*`; `postcss.config.mjs` loads
only `@tailwindcss/postcss`.

`app/globals.css` imports, in order: `tailwindcss` → `tw-animate-css` →
`shadcn/tailwind.css` (from the npm package — supplies `@utility no-scrollbar`,
`scroll-fade-*` with logical `-s`/`-e` variants, `shimmer*`) → `@plugin "@tailwindcss/typography"`.

- `@custom-variant dark (&:is(.dark *))`
- `@theme inline` maps every semantic token to a CSS variable and exposes two brand ramps
  as utilities: **`brand-50…950`** (navy) and **`gold-50…900`**
- All colours are **OKLCH**. Light mode is a warm off-white background with a navy primary
  and gold accent; dark mode flips the primary to `--gold-500` on `--brand-950`
- The radius scale is derived from `--radius: 0.75rem` by multipliers (0.6 → 2.6)
- **Sidebar tokens are deliberately fixed dark navy in both themes** — it is brand chrome,
  not themed surface

Three pieces of custom CSS exist for specific reasons:

1. `.prose :where(code, pre, kbd, samp)` is forced to `var(--font-sans)`, because the
   default monospace stack has no Arabic shaping and **disconnects Arabic letters** in
   generated Markdown.
2. `::view-transition-old/new(root)` is neutralized globally and re-enabled only under
   `html[data-magicui-theme-vt="active"]`, so the theme toggle's view transition does not
   leak into Next.js navigation.
3. `@keyframes wave` for the dashboard greeting emoji — it plays **once**, not on a loop.

**Theming.** `next-themes` with `attribute="class"`, `defaultTheme="system"`,
`disableTransitionOnChange`. `ThemeToggle` wraps `AnimatedThemeToggler` (View Transitions
API + `flushSync`), reads `resolvedTheme` (never `theme`), and always writes an explicit
`light` or `dark`. Mount detection uses
`useSyncExternalStore(noop, () => true, () => false)` — chosen over `useState` +
`useEffect` to avoid a set-state-in-effect render cascade — and renders an `opacity-0`
placeholder before mount so layout doesn't shift.

Motion is consistently gated behind `motion-safe:`.

---

## 4. Internationalization

Locales: **`ar`** (default, RTL), **`en`**, **`zh`**.

`i18n/config.ts` holds `locales`, `defaultLocale`, `localeDirections`, and `localeLabels`
(`العربية` / `English` / `中文`).

`i18n/request.ts` is **cookie-based**: it reads the `locale` cookie, validates it with
`hasLocale()`, falls back to `ar`, and dynamically imports `messages/${locale}.json`.
**There is no `[locale]` URL segment** and no next-intl routing module — so no locale
prefixes, and no `Link` wrapper to remember.

Switching locale: `actions/locale.ts#setLocale` writes the cookie, then the client calls
`router.refresh()` inside a transition.

`messages/*.json` share identical top-level namespaces: `app`, `landing`, `common`
(`actions` / `status` / `dataTable`), `auth`, `validation`, `admin`, `unauthorized`,
`sharedLesson`, `sidebar`, `dashboard`.

### RTL

- `<html dir>` is set server-side from `localeDirections`
- Base UI's `DirectionProvider` wraps the tree; `useDirection()` drives runtime decisions
  such as `<Sidebar side={dir === "rtl" ? "right" : "left"}>`, dropdown side, and sheet side
- **Use logical CSS properties everywhere**: `ms-auto`, `ps-9`, `pe-3`, `text-start`,
  `text-end`, `inset-s-3`, `inset-e-4`, `border-s`. Physical `left`/`right` utilities will
  break Arabic
- `IBM_Plex_Sans_Arabic` (subset `arabic`) is the only font, used for body, headings, and
  forced onto `.prose` code blocks

---

## 5. Forms and data flow

### Schemas are translator-taking factories

`validation/*.ts` exports functions like `updateTeacherSchema(t)` that read messages from
the `validation.<resource>` namespace. The **same** schema is used by the client via
`useTranslations` and by the server action via `getTranslations`, so validation messages
are written once and stay in sync.

Two form patterns coexist:

1. **Dialog CRUD** → `DialogForm` + `BaseForm` render prop (every admin `*-form-dialog.tsx`)
2. **Standalone pages** → `useForm({ resolver: zodResolver(schema(t)) })` directly (auth,
   profile, settings)

Non-native inputs (switch, select, colour, localized text) are bridged with `<Controller>`.
Field markup is consistently `Field` / `FieldGroup` / `FieldLabel` / `FieldError` with
`data-invalid={!!errors.x}` on the `Field`.

### Calling Server Actions

The canonical pattern bridges `useTransition` into the react-hook-form promise so the
dialog stays disabled until the action settles **and** the revalidated page has streamed:

```tsx
onSubmit={(values) => new Promise((resolve) => {
  startTransition(async () => {
    const result = await updateTeacher(teacher.id, values);
    if ("error" in result) { resolve({ error: result.error }); return; }
    onOpenChange(false);
    resolve();
  });
})}
```

`useTransition` appears in 33 files. **`useOptimistic`, `useActionState`, and
`useFormStatus` are not used anywhere** — there is no optimistic UI. Freshness comes from
`revalidatePath` in the action plus an explicit `router.refresh()` where needed.

### Polling instead of realtime

There are no websockets and no Supabase Realtime subscriptions.

| Poller | Cadence | Purpose |
|---|---|---|
| `GenerationPoller` | every 4s while generating | The Trigger.dev task outruns the request |
| `LessonsExplorer` | every 4s while any row is generating | Same, for the list view |
| `PurchaseBalancePoller` | every 2s, up to 5 attempts | The Paddle webhook can lose the race with the success redirect. Renders *processing* / *success* / *delayed* rather than claiming success early |

`LessonContentEditor` uses a 650 ms hand-rolled debounced autosave with a monotonic
`saveTokenRef` counter to discard stale in-flight responses, plus an immediate first save
to populate the preview.

### Tables

`@tanstack/react-table` is used **only** in `components/shared/data-table/` — that is,
admin tables. Client-side global filter, column visibility, and pagination (default 10);
changing the filter resets to page 0. Teacher-facing tables (lessons, history, shared,
credits ledger) are hand-rolled `components/ui/table` markup.

### Feedback

**There is no toast library.** Feedback is rendered inline:

- form-level errors via `FieldError` on the root
- delete errors as a `text-destructive` paragraph under the table
- purchase status as a coloured banner
- autosave state as a `saving` / `saved` / `error` line
- destructive confirmations via `DeleteConfirmationDialog`

---

## 6. Hooks and client utilities

`hooks/` holds one global hook: **`use-mobile.ts`** (`useIsMobile()`, 768px breakpoint,
lazily initialized from `window.innerWidth` so it is SSR-safe). Everything else is
feature-local:

- `app/dashboard/create/_hooks/use-lesson-wizard.ts` — the wizard's whole state machine:
  step, source type, word count against `MAX_TEXT_WORDS`, image list with
  `createObjectURL`/`revokeObjectURL` lifecycle, per-step validity gates, `FormData`
  assembly, Sentry-guarded submit, redirect to the new lesson
- `json-editor/use-narrow-viewport.ts` — drives the mobile drill-down sheet
- Five near-identical `use-*-table.ts` admin CRUD hooks (teacher, employee, role,
  credit-package, template), each holding `rowToDelete` / `rowToEdit` / `rowToShow`,
  `deleteError`, and `isDeleting`. **This is the most duplicated pattern in the codebase**
  and the obvious candidate if you are looking for something to consolidate

**Client utilities:** `lib/utils.ts` (`cn` = clsx + tailwind-merge),
`lib/dashboard/format.ts` (shared date and price formatters — prices divide by 100 since
they are stored in minor units), `lib/paddle-client.ts` (`loadPaddle()`),
`lib/localized-text.ts`, `constants/routes.ts`, `constants/permissions.ts`,
`constants/lesson-source-limits.ts`.
