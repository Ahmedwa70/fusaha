export const locales = ["ar", "en", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

export const localeDirections: Record<Locale, "ltr" | "rtl"> = {
  ar: "rtl",
  en: "ltr",
  zh: "ltr",
};

export const localeLabels: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  zh: "中文",
};
