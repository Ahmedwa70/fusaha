import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

type PublicHeaderProps = { homeHref?: string };

export function PublicHeader({ homeHref = "#top" }: PublicHeaderProps) {
  const sectionHref = (section: string) => homeHref === "#top" ? `#${section}` : `${ROUTES.home}#${section}`;

  return (
    <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:py-5">
      <Link href={homeHref} aria-label="فصحاء"><Image src="/book-transparent.png" alt="فصحاء" width={112} height={60} className="h-12 w-auto object-contain" priority /></Link>
      <nav className="hidden items-center gap-7 text-sm font-semibold text-brand-900 dark:text-foreground lg:flex" aria-label="التنقل الرئيسي">
        <Link href={homeHref} className={homeHref === "#top" ? "text-gold-700" : undefined}>الرئيسية</Link>
        <Link href={ROUTES.products}>المنتجات</Link>
        <Link href={sectionHref("library")}>الموارد</Link>
        <Link href={sectionHref("pricing")}>الأسعار</Link>
        <Link href={sectionHref("footer")}>مركز المساعدة</Link>
        <Link href={sectionHref("footer")}>عن فصحاء</Link>
      </nav>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex"><ThemeToggle /><LanguageSwitcher /></div>
        <Link href={ROUTES.login} className="hidden rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold hover:bg-brand-50 sm:block">تسجيل الدخول</Link>
        <Button size="sm" nativeButton={false} render={<Link href={ROUTES.dashboardCreate} />}>ابدأ الآن</Button>
        <MobileNavigation homeHref={homeHref} />
      </div>
    </header>
  );
}
