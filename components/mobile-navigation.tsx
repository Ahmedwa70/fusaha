"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { ROUTES } from "@/constants/routes";

const links = [
  ["الرئيسية", "#top"],
  ["المنتجات", ROUTES.products],
  ["الموارد", ROUTES.resources],
  ["الأسعار", "#pricing"],
  ["مركز المساعدة", "#footer"],
  ["عن فصحاء", "#footer"],
] as const;

function closeMobileMenu(event: React.MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function MobileNavigation({ homeHref = "#top" }: { homeHref?: string }) {
  const sectionHref = (section: string) => homeHref === "#top" ? `#${section}` : `${ROUTES.home}#${section}`;
  const navigationLinks = links.map(([label, href]) => href.startsWith("#") ? [label, sectionHref(href.slice(1))] as const : [label, href] as const);

  return (
    <details className="relative lg:hidden">
      <summary aria-label="فتح القائمة" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-brand-900 transition-colors hover:bg-gold-50 dark:text-brand-50 dark:hover:bg-brand-800 [&::-webkit-details-marker]:hidden">
        <MenuIcon aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-gold-200 bg-[#fbfaf5] p-3 text-right shadow-xl dark:border-brand-700 dark:bg-background">
        <div className="flex items-center justify-between border-b border-gold-100 px-2 pb-2">
          <span className="font-heading font-bold text-brand-950">التنقل</span>
          <button type="button" aria-label="إغلاق القائمة" onClick={closeMobileMenu} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-brand-700 transition-colors hover:bg-gold-50">
            <XIcon aria-hidden="true" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 pt-2" aria-label="التنقل على الهاتف">
          {navigationLinks.map(([label, href]) => (
            <a key={href + label} href={href} onClick={closeMobileMenu} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
              {label}
            </a>
          ))}
          <Link href={ROUTES.login} onClick={closeMobileMenu} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
            تسجيل الدخول
          </Link>
        </nav>
      </div>
    </details>
  );
}
