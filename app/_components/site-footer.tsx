import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

const footerLinkClass =
  "transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-foreground px-5 py-10 text-background dark:bg-background dark:text-foreground sm:px-8 lg:py-11">
      <div className="mx-auto grid max-w-[1400px] gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-16">
        <div>
          <Image src="/book-transparent.png" alt="فُصحاء" width={112} height={60} className="h-12 w-auto object-contain" />
          <p className="mt-3 text-sm text-background/70 dark:text-muted-foreground">منصة عربية لصناعة تجارب تعليمية أفضل.</p>
        </div>
        <div>
          <h3 className="font-bold text-gold-300">المنتجات</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm text-background/70 dark:text-muted-foreground">
            <Link className={footerLinkClass} href={`${ROUTES.home}#tools`}>الأدوات</Link>
            <Link className={footerLinkClass} href={`${ROUTES.home}#writing`}>محرك الكتابة</Link>
            <Link className={footerLinkClass} href={`${ROUTES.home}#library`}>المكتبة</Link>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gold-300">الموارد</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm text-background/70 dark:text-muted-foreground">
            <Link className={footerLinkClass} href={`${ROUTES.home}#library`}>المكتبة التعليمية</Link>
            <Link className={footerLinkClass} href={`${ROUTES.home}#steps`}>كيف تعمل المنصة</Link>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gold-300">عن فُصحاء</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm text-background/70 dark:text-muted-foreground">
            <Link className={footerLinkClass} href={ROUTES.help}>مركز المساعدة</Link>
            <Link className={footerLinkClass} href={ROUTES.login}>تسجيل الدخول</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-[1400px] border-t border-background/15 pt-5 text-center text-xs text-background/60 dark:border-border dark:text-muted-foreground">
        <span dir="rtl">حقوق النشر © {new Date().getFullYear()} فُصحاء. جميع الحقوق محفوظة.</span>
      </p>
    </footer>
  );
}
