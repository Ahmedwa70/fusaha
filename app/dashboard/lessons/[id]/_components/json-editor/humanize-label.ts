// Cosmetic-only: the key set here is unbounded and template-defined (each
// template shapes its own content JSON, see lib/ai/lesson-content-schema.ts),
// so there is nothing to translate against — this just makes raw object
// keys like `pageTitle` / `vocab_list` readable as field labels.
export function humanizeLabel(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!spaced) return key;

  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
