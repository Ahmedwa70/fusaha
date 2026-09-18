import { defaultLocale, type Locale } from "@/i18n/config";

// schema_definitions.level is stored as jsonb, one display name per locale
// (see database/schema/schema-definitions.ts) — this picks the current
// locale's name, falling back to the default locale if that one is missing.
export function resolveLevelLabel(level: unknown, locale: Locale): string {
  const record = level as Partial<Record<Locale, string>>;
  return record[locale] ?? record[defaultLocale] ?? "";
}
