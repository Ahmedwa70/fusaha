import type { Metadata } from "next";
import { BookOpenIcon, LibraryBigIcon } from "lucide-react";
import { PublicHeader } from "@/app/_components/public-header";
import { LibraryBrowser } from "@/app/library/_components/library-browser";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { title: "المكتبة التعليمية | فُصحاء", description: "كتالوج كتب وموارد تعليمية مختارة لدعم تعليم اللغة العربية." };

export default function LibraryPage() {
  return <div dir="rtl" className="min-h-full overflow-hidden bg-background text-foreground"><PublicHeader homeHref={ROUTES.home} /><main><section className="border-y border-border bg-background px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-4xl text-center"><LibraryBigIcon className="mx-auto size-12 text-gold-600" aria-hidden="true" /><p className="mt-4 text-sm font-bold text-gold-700 dark:text-gold-300">مكتبة فُصحاء</p><h1 className="mt-3 font-heading text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">كتب وموارد تدعم رحلة تعلّم العربية</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">تصفح مجموعة مختارة من الكتب والمواد التعليمية، وتعرّف على طريقة الوصول إلى كل مورد.</p></div></section><section className="px-5 py-12 sm:px-8 lg:py-16"><div className="mx-auto max-w-6xl"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">الكتالوج العام</p><h2 className="mt-2 font-heading text-3xl font-bold text-foreground">استكشف الكتب</h2></div><BookOpenIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" /></div><LibraryBrowser /></div></section></main></div>;
}
