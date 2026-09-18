"use client";

import { useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { EllipsisVerticalIcon, GlobeIcon, CheckIcon, LogInIcon, SunIcon, MoonIcon } from "lucide-react";
import { setLocale } from "@/actions/locale";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { ROUTES } from "@/constants/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

export function MobileHeaderMenu({ className }: { className?: string }) {
  const tApp = useTranslations("app");
  const tHero = useTranslations("landing.hero");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { resolvedTheme, setTheme } = useTheme();

  // Same mount-detection approach as ThemeToggle — resolvedTheme is unknown
  // on the server, so avoid rendering the theme item until it's known.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  function handleSelectLocale(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" className={cn(className)} />}>
        <EllipsisVerticalIcon />
        <span className="sr-only">{tApp("menu")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={ROUTES.login} />}>
          <LogInIcon data-icon="inline-start" />
          {tHero("ctaSecondary")}
        </DropdownMenuItem>

        {mounted && (
          <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? (
              <SunIcon data-icon="inline-start" />
            ) : (
              <MoonIcon data-icon="inline-start" />
            )}
            {resolvedTheme === "dark" ? tApp("lightMode") : tApp("darkMode")}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tApp("language")}</DropdownMenuLabel>
          {locales.map((loc) => (
            <DropdownMenuItem key={loc} disabled={isPending} onClick={() => handleSelectLocale(loc)}>
              <GlobeIcon data-icon="inline-start" />
              {localeLabels[loc]}
              {loc === locale && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
