# Fusaha Dark Mode Specification

## A. Purpose and Scope

Fusaha already has working theme infrastructure, but dark-mode treatment is not yet uniform across all pages and components. Public pages, the library, navigation, authentication, dashboards, and shared UI use a mixture of semantic CSS variables, Tailwind `dark:` overrides, brand colors, raw hexadecimal values, and fixed light surfaces.

This specification defines one coherent dark-mode system for the platform. It is an implementation contract for future work, not an implementation change. The objective is to preserve Fusaha's warm educational brand while ensuring that equivalent surfaces, controls, states, and content remain consistent and readable everywhere.

The scope includes the public website, authentication, the teacher dashboard, administration, lesson-related interfaces, the library, shared UI components, and desktop/mobile navigation. It covers color semantics, theme behavior, accessibility, RTL/LTR behavior, verification, and the recommended implementation sequence.

This document separates:

- **Verified facts:** behavior and tokens found in the current source.
- **Proposed standards:** rules that future implementation must follow.
- **Unresolved decisions:** points that need product/design approval or browser validation.

## A1. Binding Homepage Source of Truth

The current Fusaha homepage at `https://www.fusaha.com/` is the sole authoritative visual reference for the platform's dark-mode identity. This is a binding product decision, not optional inspiration. Public pages, library pages, authentication, teacher and administration dashboards, lesson studio, educational tools, shared components, and desktop/mobile interfaces may use different layouts when functionality requires it, but they must not invent different visual identities.

The platform contract is:

> The homepage defines the approved visual reference; the centralized semantic theme tokens implement that reference; all other pages and components consume those same tokens.

The homepage must be inspected before defining or changing dark-mode values. Evidence must be gathered in this order: rendered homepage in a browser, homepage repository implementation, centralized theme variables, then shared components used by the homepage. No hex value, color relationship, gradient, shadow, opacity, or state may be attributed to the homepage unless it is verified from one of those sources. If the live homepage is unavailable, the specification must explicitly say so and label repository-based findings provisional; visual equivalence must not be claimed.

### Verified live homepage evidence (2026-10-25)

The live homepage was successfully opened at `https://www.fusaha.com/` in the browser at 1032×576 with dark color scheme. The rendered evidence verified:

- A very dark blue-black main canvas across the hero.
- Near-white Arabic headline and readable muted supporting text.
- Gold primary CTA treatment with dark text, contrasted against a darker outlined secondary action.
- Dark translucent/outlined theme and language controls in the public header.
- A light editorial product illustration that remains visually prominent against the dark canvas.
- RTL Arabic composition with the text/CTA block on the right and the illustration on the left at the tested desktop viewport.

The screenshot and accessibility snapshot verify appearance and structure, but do not establish exact computed color values, hover/focus behavior, mobile behavior, or contrast ratios for every state. The repository implementation currently contains a richer warm-light/semantic-token system and dark overrides, including `--background: lab(4.43965% -1.75043 -5.15133)`, near-white `--foreground`, dark card/popover values, gold-toned `--primary`, translucent dark borders, and a dark hero override. These source values are evidence of the current implementation, not proof that every deployed pixel equals the live reference; computed-color extraction and broader browser comparison remain required.

No dashboard, library, authentication screen, or shared component may establish a page-specific dark palette. Any legitimate functional exception must be documented, use the homepage's design language, and remain within the centralized semantic token contract.

## B. Existing Implementation

### Verified infrastructure

- `app/layout.tsx` wraps the application with `ThemeProvider` and applies `suppressHydrationWarning` to the root `html` element.
- `components/theme-provider.tsx` uses `next-themes` with:
  - `attribute="class"`
  - `defaultTheme="system"`
  - `enableSystem`
  - `disableTransitionOnChange`
- `app/globals.css` defines the Tailwind `dark` variant from the `.dark` class.
- `app/globals.css` defines light and dark values for the shadcn-style semantic variables, including background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart colors, and sidebar colors.
- `components/theme-toggle.tsx` reads `resolvedTheme`, uses a mount guard through `useSyncExternalStore`, and switches explicitly between `light` and `dark`.
- `components/ui/animated-theme-toggler.tsx` provides an animated theme switch using `next-themes` and View Transition support where available.
- `app/globals.css` contains a reduced transition rule around theme changes.
- Theme persistence is delegated to `next-themes`. The source confirms the provider and explicit selection behavior; browser persistence and first-load behavior still require runtime verification.

### Existing integration points to preserve

The implementation should preserve the current `next-themes` architecture rather than introduce a second theme system. The existing `.dark` class strategy, provider settings, mount guards, semantic CSS variables, and existing toggle components are the foundation for this specification.

### Current audit evidence

The audit found good semantic-token coverage in shared primitives such as `components/ui/button.tsx`, `components/ui/dialog.tsx`, the dashboard header, and the admin sidebar. It also found partial coverage in public pages, the library, mobile navigation, authentication surfaces, and specialized dashboard screens.

Examples of current exceptions include:

- `bg-white/70`, `bg-white/60`, and raw light gradients in public pages.
- Raw hexadecimal backgrounds in `app/page.tsx`, `app/products/page.tsx`, `app/resources/page.tsx`, and `app/library/page.tsx`.
- Brand and gold utility classes without an explicit dark treatment in parts of `components/mobile-navigation.tsx` and `app/_components/public-header.tsx`.
- Theme behavior that is visible in desktop public navigation but is not clearly exposed in the public mobile navigation.

These findings are source-level observations. They are not a substitute for a browser sweep across themes, locales, and viewports.

## C. Unified Color System

The application must use semantic roles rather than page-specific palettes. The live homepage is the authority for the role relationships; the values below separate exact runtime evidence from source-derived values and recommendations.

| Semantic role | Current token and value | Homepage reference value, where verifiable | Recommended unified value | Remaining uncertainty |
|---|---|---|---|---|
| App background | `--background`: `lab(4.43965% -1.75043 -5.15133)` | Live `body`: `lab(4.43965 -1.75043 -5.15133)` | Keep `--background` exactly as current dark value | Homepage computed value is confirmed; contrast ratio and light-mode pairing still need measurement. |
| Primary text | `--foreground`: `lab(95.4012% -0.0117719 3.05686)` | Live `body`: same value; live `h1`: `lab(96.5705 -2.34836 -2.70324)` | Keep `--foreground`; use it for ordinary headings/body instead of raw brand text | The h1 differs from body foreground; exact selector-level reason should be documented if retained. |
| Secondary text | `--muted-foreground`: `lab(60.5861% -3.16283 -6.54073)` | Live first `p`: `lab(60.5861 -3.16283 -6.54073)` | Keep `--muted-foreground` for supporting copy and metadata | Only the first matching paragraph was sampled; all muted states and Arabic contrast need testing. |
| Card surface | `--card`: `lab(8.39645% -3.98012 -7.53505)` | Not isolated reliably on the homepage viewport | Keep `--card`; do not invent page-specific dark card colors | Homepage card sampling and nested surfaces require targeted selectors and scroll-state evidence. |
| Elevated surface | `--popover`: same as `--card` | Not verifiable from an open popover/dialog state | Keep `--popover` equal to `--card` until a homepage overlay is measured | Hover/open/focus states were not measured in this pass. |
| Border/divider | `--border`: `lab(100% 0 0 / 0.12)` | Live body/header/button computed border: same `lab(100 0 0 / 0.12)`; button input border is `/0.16` | Keep `--border`; keep `--input` at `/0.16` for fields/controls | Exact border role varies by control; focus and hover borders need separate measurements. |
| Form/control surface | `--input`: `lab(100% 0 0 / 0.16)` | Live button background: `oklab(0.999998 -0.00000980496 0.0000234246 / 0.048)` | Use `--input` for fields; use `--secondary`/component tokens for translucent controls | Button is not necessarily a form input; this is the closest verified control evidence, not an exact input value. |
| Primary action / gold | `--primary`: `lab(65.1506% 13.7743 46.2724)`; `--primary-foreground`: `lab(3.10187% -2.88614 -5.23812)` | Live page visibly confirms gold primary CTA with dark text, but exact CTA selector/value was not isolated | Keep current `--primary`/`--primary-foreground` as the unified gold CTA pair | Exact rendered CTA color and contrast ratio require sampling the specific CTA element. |
| Secondary action | `--secondary`: `lab(16.6665% -10.8145 -14.1479)`; foreground equals `--foreground` | Live page visibly confirms a darker outlined secondary action | Keep current `--secondary` pair and `--border` outline | Exact secondary button computed background was not isolated. |
| Accent/selected | `--accent`: `lab(44.2024% 12.091 32.4918)`; foreground `lab(96.5967% 0.633419 7.66813)` | Gold/warm accent is visible, but selected/hover state was not captured | Keep current `--accent` pair; use it consistently for selected/hover surfaces | Interactive states were not measured in this pass. |
| Focus indicator | `--ring`: `lab(56.1949% -14.0995 -17.0568)` | Not verifiable without keyboard focus capture | Keep `--ring`; require visible focus and contrast testing | Needs browser keyboard-state evidence and contrast measurement. |
| Sidebar/navigation | `--sidebar`: same dark background; sidebar border `/0.12` | Live public header is transparent over the dark canvas; no sidebar was sampled | Use `--background` for public chrome and existing `--sidebar-*` family for dashboards | Public header and dashboard sidebar are different functional surfaces; exact public mobile menu state remains unverified. |
| Footer/deep brand surface | `--brand-950` source token; page implementation uses `bg-brand-950` | Live footer was not isolated in this viewport pass | Keep `--brand-950` only for intentional deep-brand/footer surfaces; do not use it as a substitute for `--background` | Exact deployed footer value and relationship to homepage canvas need a full-page sample. |
| Links | Existing foreground/brand styles plus focus ring | Live ordinary link sampled as `lab(95.4012 -0.0117719 3.05686)` | Use semantic foreground/brand link roles with `--ring`; no new link color yet | Hover/visited/link-on-gold states remain unmeasured. |
| Gradients/decorative imagery | Page-level gradients and `fusaha-hero.png` | Live hero visibly uses dark canvas plus a light editorial illustration; exact gradient layers not reliably isolated | Preserve homepage gradient/image treatment as decorative exceptions, documented and theme-aware | Exact gradient stops, image blend mode, and mobile treatment need DOM/CSS inspection and screenshots. |

### Proposed value rules

The recommended unified dark palette is therefore the existing measured semantic palette in `app/globals.css`, not a newly invented set of hex values. The live homepage confirms the central dark canvas, near-white text, muted secondary text, translucent white borders, translucent controls, and gold CTA relationship. Future changes must preserve these source values unless a new browser measurement and explicit approval justify a change.

A semantic role may have different light and dark values. Consistency means that the same role has the same meaning and visual hierarchy, not that every surface has the same literal color. Exact homepage values may only be recorded when extracted from a targeted rendered element or verified in repository CSS.

## D. Color Consistency Rules

1. **Use semantic roles first.** Page components and shared UI must use the existing semantic variables for ordinary surfaces, text, borders, controls, and states.
2. **Equivalent surfaces must match.** A standard card, dialog, input, table, or dropdown must have the same visual treatment wherever it appears.
3. **Shared components own shared behavior.** A shared button, dialog, dropdown, table, toast, or form control must not introduce an independent dark-mode palette for one consuming page.
4. **Functional colors are global.** Success, warning, error, informational, selected, disabled, and focus states must use the same semantic roles across public, dashboard, and admin areas.
5. **Avoid raw colors for semantic surfaces.** Raw hexadecimal values, fixed light backgrounds, and page-specific color utilities must not be used for ordinary semantic surfaces when an appropriate theme token exists.
6. **Brand exceptions must be deliberate.** Brand and gold colors may remain fixed only when the exception is intentional, documented, readable in both themes, and not being used as a substitute for a semantic surface token.
7. **Do not create a second palette per page.** No page may independently redefine the global dark-mode identity or silently introduce a different interpretation of background, card, border, or text.
8. **Gradients need a theme rule.** Every gradient must be classified as semantic or decorative. Semantic gradients must use theme-aware tokens; decorative gradients must be tested in both themes and documented as exceptions.
9. **Transparency must preserve hierarchy.** Transparent white or black overlays must be checked against both backgrounds. Opacity must not make text, borders, hover states, or focus indicators disappear.
10. **Illustrations and images need explicit variants.** If an illustration is too light or too dark for the alternate theme, provide a documented asset variant or a theme-safe treatment. The existing product image variants are evidence that this can be necessary.
11. **Do not use color alone.** Status and selection must also be communicated through text, icons, labels, borders, or shape.
12. **Centralize changes.** Changes to established semantic colors should be made in the central token layer first, then verified across consumers.

## E. Platform Coverage

The following coverage statements describe the expected standard and current audit state. Every area must follow the live homepage's approved visual language through the centralized tokens. “Partial” or “unverified” does not mean the area is broken; it means the source review does not prove complete visual coverage. Layout-specific requirements may differ, but page-specific dark identities are not permitted.

| Area | Expected behavior | Current findings and required verification |
|---|---|---|
| Public homepage and navigation | Shared background, text, CTA, link, focus, and navigation roles; theme switching available without layout breakage | `app/page.tsx` and `app/_components/public-header.tsx` have meaningful dark support but also fixed light surfaces, raw gradients, and brand utilities. Verify hero, CTA, dropdown/mobile behavior, contrast, and initial load. |
| Products and resources | Cards, feature sections, CTAs, and media use the same semantic roles as the homepage | `app/products/page.tsx` and `app/resources/page.tsx` contain dark overrides plus raw light gradients and white surfaces. Verify every section, image treatment, hover state, and responsive layout. |
| Pricing, Help Center, and About | Same public semantic system; no separate page palette | Help is represented by `app/help/page.tsx`; pricing/about coverage must be confirmed against the current route set before implementation. Verify all nested components and empty/error states. |
| Library and detail pages | Book cards, metadata, search/filter controls, detail panels, and actions use shared surface and state roles | `app/library/page.tsx`, `app/library/[slug]/page.tsx`, and library components are partially tokenized but include fixed gradients and a white text treatment. Verify card readability, controls, detail content, and mobile layout. |
| Authentication | Forms, errors, links, dividers, and headers remain readable and consistent with public/shared UI | Auth pages expose theme controls and dark classes, but form internals require full state coverage. Verify validation, loading, error, disabled, focus, and password controls. |
| Teacher dashboard | Sidebar, header, cards, tables, dialogs, forms, and lesson interfaces use the same semantic system | Dashboard header and sidebar token usage is a strong foundation. Verify all dashboard routes and component states, including data tables, empty states, generation progress, and mobile navigation. |
| Administration dashboard | Admin navigation and content controls use the same tokens, with role-specific structure but no independent palette | Admin sidebar/layout use sidebar tokens and a theme toggle. Verify all admin screens, destructive actions, filters, forms, statuses, and overlays. |
| Shared UI and lesson interfaces | Base components are theme-safe in every consumer | `components/ui/button.tsx` and `components/ui/dialog.tsx` use semantic tokens well. Verify dropdowns, selects, popovers, tables, toasts, tooltips, date controls, and lesson-specific components. |
| Desktop navigation | Theme and language controls remain discoverable and preserve RTL/LTR layout | Public desktop header exposes theme controls; verify spacing, focus, locale changes, and dark contrast. |
| Mobile navigation | Theme, language, links, and menu surfaces remain usable at small widths | Public mobile navigation currently has theme-aware background support but the source does not establish that theme/language controls are available there. Decide and verify the intended mobile UX. |

Uninspected components must not be marked fully supported until they pass the browser verification matrix in Section I.

## F. Theme Behavior

### Light mode

Light mode must retain the current Fusaha visual character: warm backgrounds, clear brand accents, readable dark text, restrained borders, and accessible primary actions. Dark-mode work must not flatten or unnecessarily redesign the light theme.

### Dark mode

Dark mode must use the same semantic roles with dark values selected for hierarchy and readability. The main canvas, cards, elevated surfaces, sidebars, fields, and overlays must be distinguishable without relying on random page-specific colors. Warm brand and gold accents may remain part of the identity when contrast-tested.

### System preference

The existing provider uses `defaultTheme="system"` and `enableSystem`. System preference should remain the default unless an approved product decision changes it. A system preference is not the same as a permanently stored explicit selection.

### Explicit selection and persistence

The existing toggles switch explicitly between `light` and `dark`; this behavior should be preserved. `next-themes` remains responsible for persisting the explicit selection and applying the `.dark` class. Whether the product should expose a third “system” option in the UI is unresolved and should not be added as part of routine token work.

### Initial load and hydration

The existing `ThemeProvider`, `suppressHydrationWarning`, and mount guards should be preserved. Any implementation must verify:

- No hydration mismatch warning occurs.
- The initial theme does not visibly flash to the wrong mode.
- The system preference is respected when no explicit selection exists.
- An explicit selection wins over the system preference.
- Navigation between routes does not reset the theme.

These are browser-based acceptance requirements; source inspection alone cannot prove them.

### Switching behavior

Theme changes should not cause unwanted layout movement, lingering transitions, or unreadable intermediate states. Preserve `disableTransitionOnChange` and the existing reduced transition treatment unless runtime testing shows a concrete defect. Respect reduced-motion preferences for any animated theme switch.

## G. Accessibility and Arabic Support

1. **Contrast:** Text, icons, borders, controls, placeholders, status labels, and focus indicators must remain readable in both themes. Contrast must be measured for primary, secondary, muted, gold, brand, destructive, success, warning, and informational combinations.
2. **Arabic typography:** Arabic text must remain legible at the selected font sizes and weights. Dark mode must not reduce readability through low-opacity text or thin weights.
3. **RTL/LTR:** Arabic must continue to use RTL; English and Chinese must use their supported direction. Theme logic must remain independent of direction, and controls/icons must be tested in both directions.
4. **Keyboard navigation:** Every interactive control must expose a visible `focus-visible` state. Focus must remain visible against both dark surfaces and brand-colored controls.
5. **States:** Hover, selected, active, disabled, loading, validation error, success, warning, and informational states must be distinguishable without color alone.
6. **Mobile usability:** Touch targets, menus, dialogs, and theme controls must remain usable at mobile widths in both themes.
7. **Reduced motion:** Theme transitions and animated toggles must not override a user's reduced-motion preference.
8. **Images and illustrations:** Decorative images must not reduce text contrast, and meaningful images require appropriate alternative text independent of theme.

## H. Implementation Rules

1. Start from the existing semantic variables in `app/globals.css`; do not introduce a replacement theme architecture.
2. Map each raw color or fixed surface to a semantic role before changing it. If no role fits, record the proposed role and obtain approval before adding a new token.
3. Prefer `bg-background`, `bg-card`, `bg-popover`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-input`, `ring-ring`, `bg-primary`, `bg-secondary`, `bg-muted`, `bg-accent`, and the existing sidebar/chart token families where their meaning matches.
4. Shared primitives must be corrected before individual pages. Page-specific work must consume the shared primitives rather than duplicate their styles.
5. Keep intentional brand colors separate from ordinary semantic surfaces. A brand exception must include a short source comment or documentation entry explaining its purpose and contrast verification.
6. Do not change copy, navigation destinations, authentication behavior, database behavior, or product meaning as part of dark-mode token work.
7. Keep light-mode classes working while adding or refining dark behavior. Never replace a light value without checking both themes.
8. When an image needs a dark variant, follow the existing asset convention rather than applying an arbitrary CSS filter.
9. Verify component states, not only the default resting state. Dialogs, dropdowns, tables, forms, toasts, loading indicators, empty states, and errors are part of the theme contract.
10. Keep RTL/LTR layout logic unchanged unless the visual audit identifies a genuine direction defect.
11. Document unresolved decisions and exceptions in the implementation pull request or the relevant specification; do not silently introduce one-off palettes.
12. Avoid a broad refactor unless the affected semantic role cannot be implemented safely through the existing token layer and shared components.

## I. Verification and Acceptance Criteria

### Source-code checks

- [ ] The live homepage reference has been inspected and its verified visual roles are recorded with evidence.
- [ ] All major pages use semantic theme roles instead of raw colors for ordinary surfaces.
- [ ] No new page-level dark palette or duplicate theme provider is introduced.
- [ ] The homepage, public navigation, products, resources, pricing, Help Center, About, library, authentication, teacher dashboard, administration dashboard, lesson studio, educational tools, shared UI, desktop, and mobile all consume the same approved semantic visual system.
- [ ] Equivalent components use equivalent colors and interaction states across all areas; any functional exception is documented and remains consistent with the homepage design language.
- [ ] Brand and gold accents follow the homepage's verified treatment, with no unexplained white or light surfaces in dark mode.
- [ ] Shared UI components use the central tokens and do not depend on page-specific colors.
- [ ] Every raw hexadecimal color and fixed light background has an intentional classification: semantic token candidate, documented brand exception, or decorative asset/gradient.
- [ ] Light-mode classes remain present and correct after dark-mode changes.
- [ ] `ThemeProvider`, `.dark` strategy, explicit toggle behavior, and hydration guards remain intact unless an approved change says otherwise.
- [ ] Focus-visible styles exist for all newly changed interactive controls.
- [ ] No application, authentication, database, or environment behavior changes are included unintentionally.

### Browser and visual checks

- [ ] `/`, `/products`, `/resources`, `/help`, `/library`, and library detail pages are checked in light and dark mode.
- [ ] Pricing and About routes, when present in the current route set, are checked in both themes.
- [ ] Authentication pages are checked for default, focused, loading, validation-error, disabled, and success states.
- [ ] Teacher dashboard routes are checked for sidebar, header, cards, tables, forms, dialogs, generation progress, empty, loading, and error states.
- [ ] Administration routes are checked for navigation, forms, status badges, destructive actions, tables, dialogs, empty, loading, and error states.
- [ ] Equivalent components—buttons, cards, inputs, dialogs, dropdowns, tables, toasts, and alerts—look consistent across areas.
- [ ] No unintended white or light surface appears in dark mode.
- [ ] Text, icons, borders, placeholders, controls, and focus rings remain readable.
- [ ] Hover, active, selected, disabled, loading, success, warning, error, and informational states are checked.
- [ ] Arabic RTL is checked at desktop and mobile widths.
- [ ] English and Chinese LTR interfaces are checked where supported.
- [ ] Public desktop and mobile navigation are checked, including the discoverability of theme and language controls.
- [ ] Theme selection persists across a route change and a reload.
- [ ] System preference is tested when no explicit selection exists.
- [ ] Initial loading is checked for hydration warnings and visible flash of the wrong theme.
- [ ] Light mode is rechecked after dark-mode work to confirm it was not damaged.
- [ ] Reduced-motion behavior is checked for animated theme switching.

Source checks establish implementation intent; browser checks are required to accept visual behavior, contrast, hydration, persistence, and responsive behavior.

## J. Implementation Sequence

The sequence below follows the current dependency structure and minimizes regressions:

1. **Inventory and token mapping.** Classify existing semantic variables, raw colors, fixed light surfaces, brand exceptions, gradients, and image variants. Resolve or document any missing semantic roles before broad edits.
2. **Central token layer.** Refine only the necessary light/dark values in `app/globals.css`. Preserve the current `.dark` class strategy and verify token-pair contrast.
3. **Shared UI primitives.** Audit and correct buttons, inputs, dialogs, popovers, dropdowns, tables, alerts, toasts, badges, and focus states. These components affect every area.
4. **Public shell.** Update the homepage, public header, mobile navigation, products, resources, pricing, Help Center, and About surfaces to consume the shared roles. Verify desktop/mobile and all supported locales.
5. **Authentication.** Correct auth headers, forms, validation, disabled/loading states, and recovery flows using the shared primitives.
6. **Teacher dashboard.** Audit the dashboard shell first, then cards, tables, forms, lesson creation, lesson studio, generation progress, empty/loading/error states, and mobile navigation.
7. **Administration.** Audit the admin shell and sidebar, then screens, filters, forms, destructive actions, status colors, tables, and overlays.
8. **Library and specialized interfaces.** Correct library browsing/detail states and remaining lesson or resource-specific components after the shared roles are stable.
9. **Cross-locale and responsive verification.** Run the full light/dark × locale × direction × viewport matrix, including first load, persistence, and hydration.
10. **Acceptance and documentation.** Record approved brand exceptions, unresolved decisions, browser evidence, and any follow-up items. Do not start implementation work from this document until the decisions and scope are approved.

This sequence is a recommendation. It does not authorize implementation and should not be interpreted as a request to redesign unrelated areas.

## Unresolved Decisions Requiring Approval

1. Whether the public mobile navigation must expose theme and language controls directly, or whether another existing mobile surface is the intended access point.
2. Whether success, warning, and informational roles should become new centralized tokens or be represented through the existing semantic set.
3. Which current brand and gold colors are intentional fixed identity colors versus candidates for semantic token migration.
4. Whether the product should expose an explicit “system” choice in the theme UI in addition to the existing light/dark toggle.
5. Which pricing and About routes are in scope if they are not present in the current route set.
6. The final contrast-tested values for warm backgrounds, navy/dark surfaces, gold accents, and chart series.

No implementation should begin for these decisions without approval where the choice changes product behavior or introduces new semantic roles.
