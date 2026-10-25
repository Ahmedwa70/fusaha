"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
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
        <button type="button" aria-label={t("closeMenu")} onClick={closeMobileMenu} className="fixed inset-0 z-40 cursor-default bg-black/45 lg:hidden" />
      )}
      <div className="fixed top-20 z-[60] rtl:end-2 ltr:start-2 box-border flex w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-2xl border border-brand-200/70 bg-background/95 p-3 text-start text-popover-foreground shadow-[0_14px_36px_-18px_rgba(6,35,45,0.65)] backdrop-blur-sm max-h-[calc(100dvh-5rem)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
        <div className="flex items-center justify-between gap-3 border-b border-gold-100 px-2 pb-2">
          <span className="font-heading font-bold text-brand-950">{t("navigationTitle")}</span>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher
              menuSide="top"
              onLocaleChange={() => {
                setIsOpen(false);
                document.querySelector("details")?.removeAttribute("open");
              }}
              className="h-8 gap-1 px-2 text-xs text-brand-900 hover:bg-gold-50"
            />
            <button type="button" aria-label={t("closeMenu")} onClick={closeMobileMenu} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
              <XIcon aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-1 pt-2" aria-label={t("mobileNavigation")}>
          {navigationLinks.map(([label, href]) => {
            const isActive = href === pathname || (href !== "#top" && href.startsWith(`${pathname}#`));
            return (
              <a key={href + label} href={href} onClick={closeMobileMenu} aria-current={isActive ? "page" : undefined} className={`rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${isActive ? "border-gold-200 bg-gold-50/80" : ""}`}>
                {t(label)}
              </a>
            );
          })}
          <Link href={ROUTES.login} onClick={closeMobileMenu} className="rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-gold-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
            {t("login")}
          </Link>
        </nav>
      </div>
    </details>
  );
}
