"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

type PublicHeaderProps = { homeHref?: string };

export function PublicHeader({ homeHref = "#top" }: PublicHeaderProps) {
  const t = useTranslations("public");
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const isHome = pathname === ROUTES.home || pathname === "/";
  const sectionHref = (section: string) => homeHref === "#top" ? `#${section}` : `${ROUTES.home}#${section}`;

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const isActive = (href: string) => {
    if (href === homeHref && homeHref !== ROUTES.home && homeHref !== "#top") return false;
    if (href === homeHref || href === ROUTES.home || href === "#top") return isHome && (hash === "" || hash === "#top");
    if (href.startsWith("#")) return isHome && hash === href;
    if (href.startsWith(`${ROUTES.home}#`)) return isHome && hash === href.slice(ROUTES.home.length);
    return pathname === href;
  };
  const linkClass = (href: string) =>
    isActive(href) ? "text-gold-700 dark:text-gold-300" : undefined;

  return (
    <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:py-3">
      <Link className="lg:justify-self-start" href={homeHref} aria-label={t("brandAlt")}><Image src="/book-transparent.png" alt={t("brandAlt")} width={112} height={60} className="h-12 w-auto object-contain" priority /></Link>
      <nav className="hidden items-center gap-7 text-[15px] font-semibold text-brand-900 dark:text-foreground lg:flex ltr:-translate-x-[140px] rtl:translate-x-[136px] rtl:text-base" aria-label={t("mainNavigation")}>
        <Link href={homeHref} className={linkClass(homeHref)}>{t("home")}</Link>
        <Link href={ROUTES.products} className={linkClass(ROUTES.products)}>{t("products")}</Link>
        <Link href={ROUTES.library} className={linkClass(ROUTES.library)}>{t("library")}</Link>
        <Link href={ROUTES.resources} className={linkClass(ROUTES.resources)}>{t("resources")}</Link>
        <Link href={ROUTES.pricing} className={linkClass(ROUTES.pricing)}>{t("pricing")}</Link>
        <Link href={ROUTES.help} className={linkClass(ROUTES.help)}>{t("help")}</Link>
        <Link href={ROUTES.about} className={linkClass(ROUTES.about)}>{t("about")}</Link>
      </nav>
      <div className="flex items-center gap-2 lg:justify-self-end">
        <div className="hidden items-center gap-2 sm:flex"><ThemeToggle /><LanguageSwitcher /></div>
        <Link href={ROUTES.login} data-ar-control className="hidden whitespace-nowrap rounded-lg border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground sm:block">{t("login")}</Link>
        <Button className="bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90" size="sm" nativeButton={false} render={<Link href={ROUTES.dashboardCreate} />}>{t("startNow")}</Button>
        <MobileNavigation homeHref={homeHref} />
      </div>
    </header>
  );
}
