"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES } from "@/constants/routes";

const links = [
  ["home", "#top"],
  ["products", ROUTES.products],
  ["library", ROUTES.library],
  ["resources", ROUTES.resources],
  ["pricing", "#pricing"],
  ["help", ROUTES.help],
  ["about", "#footer"],
] as const;

function closeMobileMenu(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function MobileNavigation({ homeHref = "#top" }: { homeHref?: string }) {
  const t = useTranslations("public");
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);
  const sectionHref = (section: string) => homeHref === "#top" ? `#${section}` : `${ROUTES.home}#${section}`;
  const navigationLinks = links.map(([label, href]) => href.startsWith("#") ? [label, sectionHref(href.slice(1))] as const : [label, href] as const);

  return (
    <details className="relative lg:hidden" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary aria-label={t("openMenu")} aria-expanded={isOpen} className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
        <MenuIcon aria-hidden="true" />
      </summary>
      {isOpen && (
        <button type="button" aria-label={t("closeMenu")} onClick={closeMobileMenu} className="fixed inset-0 z-40 cursor-default bg-black/60 lg:hidden" />
      )}
      <div className="fixed top-20 z-[60] rtl:end-2 ltr:start-2 box-border flex w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-2xl border border-border bg-popover p-3 text-start text-popover-foreground shadow-lg max-h-[calc(100dvh-5rem)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
        <div className="flex items-center justify-between gap-3 border-b border-border px-2 pb-2">
          <span className="font-heading font-bold text-foreground">{t("navigationTitle")}</span>
          <div className="flex items-center gap-1.5">
            <ThemeToggle aria-label={t("themeToggle")} title={t("themeToggle")} className="h-8 w-8 border-border text-foreground hover:bg-accent hover:text-accent-foreground" />
            <LanguageSwitcher
              menuSide="top"
              onLocaleChange={() => {
                setIsOpen(false);
                document.querySelector("details")?.removeAttribute("open");
              }}
              className="h-8 gap-1 px-2 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
            />
            <button type="button" aria-label={t("closeMenu")} onClick={closeMobileMenu} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <XIcon aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-1 pt-2" aria-label={t("mobileNavigation")}>
          {navigationLinks.map(([label, href]) => {
            const isActive = href === pathname || (href !== "#top" && href.startsWith(`${pathname}#`));
            return (
              <a key={href + label} href={href} onClick={closeMobileMenu} aria-current={isActive ? "page" : undefined} className={`rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "border-primary/50 bg-primary/15 text-foreground" : ""}`}>
                {t(label)}
              </a>
            );
          })}
          <Link href={ROUTES.login} onClick={closeMobileMenu} className="rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("login")}
          </Link>
        </nav>
      </div>
    </details>
  );
}
