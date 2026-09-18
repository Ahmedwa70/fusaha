import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { locales, defaultLocale } from "./config";

// No locale in the URL — the active locale is resolved server-side (a
// "locale" cookie once a language switcher exists; the platform default
// until then). See constants/app removal note in i18n/config.ts.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = hasLocale(locales, cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
