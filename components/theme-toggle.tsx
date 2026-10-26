"use client";

import { useTheme } from "next-themes";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Thin next-themes wiring for AnimatedThemeToggler: `resolvedTheme` (not
// `theme`) so a defaultTheme="system" value still reports light/dark, and
// `setTheme` always writes an explicit choice (never "system") on toggle.
// The button is rendered by the server too: its icon is chosen by the `dark`
// class that next-themes sets before first paint, so the toggle never has to
// wait for hydration to appear.
export function ThemeToggle({ className, "aria-label": ariaLabel, title }: { className?: string; "aria-label"?: string; title?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <AnimatedThemeToggler
      theme={resolvedTheme as "light" | "dark"}
      onThemeChange={setTheme}
      aria-label={ariaLabel}
      title={title}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), className)}
    />
  );
}
