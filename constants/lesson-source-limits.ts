// PRD §5.3 — hard limits, block generation if exceeded, never silently
// truncate. Shared between the client wizard (app/dashboard/create/_components
// /create-lesson-wizard.tsx, pre-flight UX) and the server action
// (actions/generation.ts, the actual enforcement — the client check alone is
// not trustworthy).
export const MAX_TEXT_WORDS = 1000; // ~2 pages of content
export const MAX_IMAGES = 2;
export const MAX_PDF_PAGES = 2;

// Fallback used by lib/admin/settings.ts#getGenerationCost when no admin has
// configured a cost yet (app/admin/settings). The live, admin-tunable value
// is stored in the app_settings table, not hardcoded — do not import this
// directly to charge or refund credits.
export const DEFAULT_GENERATION_COST = 10;
