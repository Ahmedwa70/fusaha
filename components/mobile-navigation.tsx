"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const sectionHref = (section: string) => homeHref === "#top" ? `#${section}` : `${ROUTES.home}#${section}`;
  const navigationLinks = links.map(([label, href]) => href.startsWith("#") ? [label, sectionHref(href.slice(1))] as const : [label, href] as const);

  return (
    <details className="relative lg:hidden">
      <summary aria-label={t("openMenu")} className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
        <MenuIcon aria-hidden="true" />
      </summary>
      <div className="absolute start-0 top-12 z-50 w-64 rounded-2xl border border-border bg-popover p-3 text-start text-popover-foreground shadow-xl">
        <div className="flex items-center justify-between border-b border-gold-100 px-2 pb-2">
          <span className="font-heading font-bold text-brand-950">{t("navigationTitle")}</span>
          <button type="button" aria-label={t("closeMenu")} onClick={closeMobileMenu} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-gold-50">
            <XIcon aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 pt-2" aria-label={t("mobileNavigation")}>
          {navigationLinks.map(([label, href]) => (
            <a key={href + label} href={href} onClick={closeMobileMenu} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
              {t(label)}
            </a>
          ))}
          <Link href={ROUTES.login} onClick={closeMobileMenu} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
            {t("login")}
          </Link>
        </nav>
      </div>
    </details>
  );
}
