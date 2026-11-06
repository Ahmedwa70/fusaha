// Framework stand-ins for retire-independence tests. One module, many
// disjoint export sets — each "@/..." or framework specifier is redirected
// here individually by retire-independence.test-hooks.mjs. None of these are
// exercised for real behavior; they only let the actions modules load and run
// under plain Node with the injected database.

// --- next/cache ---
export function revalidatePath() {}

// --- next-intl/server ---
export async function getTranslations() {
  return (key) => key;
}
export async function getLocale() {
  return "en";
}

// --- @trigger.dev/sdk ---
export const tasks = {};

// --- @/constants/permissions ---
export const Permissions = {
  schemaCreate: "schema:create",
  schemaDelete: "schema:delete",
  templatesCreate: "templates:create",
  templatesUpdate: "templates:update",
  templatesDelete: "templates:delete",
};

// --- @/constants/routes ---
export const ROUTES = {
  adminSchema: "/admin/schema",
  adminTemplates: "/admin/templates",
};

// --- @/constants/lesson-source-limits ---
export const MAX_TEXT_WORDS = 100000;
export const MAX_IMAGES = 10;

// --- @/lib/admin/settings (injectable hook for the T6 gate probe) ---
let generationCostHook = async () => 0;
export async function getGenerationCost() {
  return generationCostHook();
}
export function setGenerationCostHook(fn) {
  generationCostHook = fn;
}

// --- @/validation/schema-definitions + @/validation/templates ---
// The retire actions never call these; dummies that fail validation are the
// safe default if an unrelated action is invoked by accident.
export function createSchemaDefinitionSchema() {
  return { safeParse: () => ({ success: false }) };
}
export function createTemplateSchema() {
  return { safeParse: () => ({ success: false }) };
}
export function updateTemplateSchema() {
  return { safeParse: () => ({ success: false }) };
}

// --- @/lib/ai/extract-file-text (never reached in the T6 gate probe) ---
export async function extractTextFromFile() {
  return { ok: false, error: "fileRequired" };
}
