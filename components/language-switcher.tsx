"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { GlobeIcon, CheckIcon } from "lucide-react";
import { setLocale } from "@/actions/locale";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, onLocaleChange, menuSide = "bottom" }: { className?: string; onLocaleChange?: () => void; menuSide?: "top" | "bottom" }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      onLocaleChange?.();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            className={cn("gap-1.5", className)}
          />
        }
      >
        <GlobeIcon data-icon="inline-start" />
        {localeLabels[locale]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={menuSide}>
        {locales.map((loc) => (
          <DropdownMenuItem key={loc} onClick={() => handleSelect(loc)}>
            {localeLabels[loc]}
            {loc === locale && <CheckIcon className="ms-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
