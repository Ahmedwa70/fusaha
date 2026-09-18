import { defaultLocale, type Locale } from "@/i18n/config";

// Admin-entered display text that has to be shown in the reader's own
// language is stored as jsonb keyed by locale (see i18n/config.ts) rather
// than as a plain text column — the same shape schema_definitions.level
// uses. Partial because a locale can be missing on rows written before a
// locale was added to the app.
export type LocalizedText = Partial<Record<Locale, string>>;

// Picks the current locale's text, falling back to the default locale (and
// then to any locale that does have text) so a half-translated row still
// renders something rather than an empty card.
export function resolveLocalizedText(value: LocalizedText | null | undefined, locale: Locale): string {
  if (!value) return "";
  return value[locale] ?? value[defaultLocale] ?? Object.values(value).find((text) => !!text) ?? "";
}
