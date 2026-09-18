import { z } from "zod";
import { locales, type Locale } from "@/i18n/config";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Every teacher-facing display field is entered once per locale (see
// i18n/config.ts) and stored as jsonb keyed by locale — see
// database/schema/credit-packages.ts and lib/localized-text.ts.
type LocalizedInput = Record<Locale, string>;

function localizedShape() {
  return z.object(
    Object.fromEntries(locales.map((locale) => [locale, z.string()])) as Record<Locale, z.ZodString>
  );
}

function trimLocalized(value: LocalizedInput): LocalizedInput {
  return Object.fromEntries(locales.map((locale) => [locale, (value[locale] ?? "").trim()])) as LocalizedInput;
}

function hasAnyLocale(value: LocalizedInput): boolean {
  return locales.some((locale) => !!value[locale]);
}

// The package name is the card's headline — it must exist in every locale.
function requiredLocalizedText(message: string) {
  return localizedShape()
    .transform(trimLocalized)
    .superRefine((value, ctx) => {
      for (const locale of locales) {
        if (!value[locale]) ctx.addIssue({ code: "custom", path: [locale], message });
      }
    });
}

// Badge/subtitle/footer are optional marketing lines — the package can go
// without them entirely (the card falls back to its default look), but a
// line that exists in one language has to exist in all of them, otherwise
// the card would render Arabic copy under an English/Chinese UI.
function optionalLocalizedText(message: string) {
  return localizedShape()
    .optional()
    .transform((value) => trimLocalized((value ?? {}) as LocalizedInput))
    .superRefine((value, ctx) => {
      if (!hasAnyLocale(value)) return;
      for (const locale of locales) {
        if (!value[locale]) ctx.addIssue({ code: "custom", path: [locale], message });
      }
    })
    .transform((value) => (hasAnyLocale(value) ? value : undefined));
}

// The features bullet list is entered as add/remove rows (see
// features-field.tsx), one row per bullet with that bullet's text in every
// locale. A row left completely blank is dropped; a partly-filled one is an
// error, same rule as the optional lines above.
function featuresList(message: string) {
  return z
    .array(localizedShape())
    .optional()
    .transform((value) => (value ?? []).map(trimLocalized))
    .superRefine((rows, ctx) => {
      rows.forEach((row, index) => {
        if (!hasAnyLocale(row)) return;
        for (const locale of locales) {
          if (!row[locale]) ctx.addIssue({ code: "custom", path: [index, locale], message });
        }
      });
    })
    .transform((rows) => rows.filter(hasAnyLocale));
}

function optionalHexColor(t: (key: string) => string) {
  return z
    .string()
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || HEX_COLOR_PATTERN.test(value), t("invalidColor"));
}

// Messages come from the "validation.creditPackages" namespace so the schema
// reads the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/teachers.ts for the same convention.
// `price` is entered and validated in whole dollars (e.g. 9.99) — the
// server action converts it to minor units (cents) before it touches the
// `credit_packages.price` column. See actions/credit-packages.ts.
function optionalPaddlePriceId(t: (key: string) => string) {
  return z
    .string()
    .transform((value) => value.trim())
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || value.startsWith("pri_"), t("invalidPaddlePriceId"));
}

function sharedFields(t: (key: string) => string) {
  return {
    name: requiredLocalizedText(t("requiredName")),
    creditsAmount: z.coerce.number().int().positive(t("invalidCreditsAmount")),
    price: z.coerce.number().min(0, t("negativePrice")),
    paddlePriceId: optionalPaddlePriceId(t),
    badgeLabel: optionalLocalizedText(t("requiredAllLocales")),
    subtitle: optionalLocalizedText(t("requiredAllLocales")),
    footerText: optionalLocalizedText(t("requiredAllLocales")),
    features: featuresList(t("requiredAllLocales")),
    colorDark: optionalHexColor(t),
  };
}

export function createCreditPackageSchema(t: (key: string) => string) {
  return z.object(sharedFields(t));
}

export function updateCreditPackageSchema(t: (key: string) => string) {
  return z.object({ ...sharedFields(t), active: z.boolean() });
}

export type CreateCreditPackageValues = z.infer<ReturnType<typeof createCreditPackageSchema>>;
export type UpdateCreditPackageValues = z.infer<ReturnType<typeof updateCreditPackageSchema>>;
