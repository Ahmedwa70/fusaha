import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Sans_SC } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { localeDirections, type Locale } from "@/i18n/config";
import "./globals.css";

const fontArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const fontCjk = Noto_Sans_SC({
  variable: "--font-cjk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const direction = localeDirections[locale];

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${fontArabic.variable} ${fontCjk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader
          color="var(--gold-500)"
          height={4}
          shadow={false}
          showSpinner={false}
        />
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <DirectionProvider direction={direction}>
              <TooltipProvider>{children}</TooltipProvider>
            </DirectionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
