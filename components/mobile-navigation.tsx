"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { ROUTES } from "@/constants/routes";

const links = [
  ["الرئيسية", "#top"],
  ["المنتجات", "#tools"],
  ["الموارد", "#library"],
  ["الأسعار", "#pricing"],
  ["مركز المساعدة", "#footer"],
  ["عن فصحاء", "#footer"],
] as const;

export function MobileNavigation() {
  return (
    <details className="relative lg:hidden">
      <summary aria-label="فتح القائمة" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-brand-900 transition-colors hover:bg-gold-50 [&::-webkit-details-marker]:hidden">
        <MenuIcon aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-gold-200 bg-[#fbfaf5] p-3 text-right shadow-xl">
        <div className="flex items-center justify-between border-b border-gold-100 px-2 pb-2">
          <span className="font-heading font-bold text-brand-950">التنقل</span>
          <XIcon aria-hidden="true" className="text-brand-700" />
        </div>
        <nav className="flex flex-col gap-1 pt-2" aria-label="التنقل على الهاتف">
          {links.map(([label, href]) => (
            <a key={href + label} href={href} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
              {label}
            </a>
          ))}
          <Link href={ROUTES.login} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-50">
            تسجيل الدخول
          </Link>
        </nav>
      </div>
    </details>
  );
}
