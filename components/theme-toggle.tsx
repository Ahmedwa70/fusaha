"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

// Thin next-themes wiring for AnimatedThemeToggler: `resolvedTheme` (not
// `theme`) so a defaultTheme="system" value still reports light/dark, and
// `setTheme` always writes an explicit choice (never "system") on toggle.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Mount detection via useSyncExternalStore (server snapshot false, client
  // snapshot true) — avoids the setState-in-effect render cascade a
  // useState+useEffect mount flag would cause.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  // Renders nothing until mounted — resolvedTheme is unknown on the server
  // (defaultTheme="system"), and rendering the button before then would
  // hand it an undefined `theme`, which makes it fall back to its own
  // uncontrolled/localStorage state instead of staying in sync with
  // next-themes.
  if (!mounted) {
    return <span className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "opacity-0", className)} />;
  }

  return (
    <AnimatedThemeToggler
      theme={resolvedTheme as "light" | "dark"}
      onThemeChange={setTheme}
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), className)}
    />
  );
}
