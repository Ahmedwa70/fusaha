"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

type PublicHeaderProps = { homeHref?: string };

export function PublicHeader({ homeHref = "#top" }: PublicHeaderProps) {
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
    <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:py-5">
      <Link href={homeHref} aria-label="فصحاء"><Image src="/book-transparent.png" alt="فصحاء" width={112} height={60} className="h-12 w-auto object-contain" priority /></Link>
      <nav className="hidden items-center gap-7 text-sm font-semibold text-brand-900 dark:text-foreground lg:flex" aria-label="التنقل الرئيسي">
        <Link href={homeHref} className={linkClass(homeHref)}>الرئيسية</Link>
        <Link href={ROUTES.products} className={linkClass(ROUTES.products)}>المنتجات</Link>
        <Link href={ROUTES.library} className={linkClass(ROUTES.library)}>المكتبة</Link>
        <Link href={ROUTES.resources} className={linkClass(ROUTES.resources)}>الموارد</Link>
        <Link href={sectionHref("pricing")} className={linkClass(sectionHref("pricing"))}>الأسعار</Link>
        <Link href={ROUTES.help} className={linkClass(ROUTES.help)}>مركز المساعدة</Link>
        <Link href={sectionHref("footer")} className={linkClass(sectionHref("footer"))}>عن فصحاء</Link>
      </nav>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex"><ThemeToggle /><LanguageSwitcher /></div>
        <Link href={ROUTES.login} className="hidden rounded-lg border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground sm:block">تسجيل الدخول</Link>
        <Button size="sm" nativeButton={false} render={<Link href={ROUTES.dashboardCreate} />}>ابدأ الآن</Button>
        <MobileNavigation homeHref={homeHref} />
      </div>
    </header>
  );
}
