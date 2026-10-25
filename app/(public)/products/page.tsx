import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon, PenLineIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const products = [
  {
    title: "مولّد الدروس التفاعلية",
    description: "حوّل مصدر الدرس إلى درس تفاعلي متكامل، ثم راجعه واعتمده من مساحة العمل.",
    status: "متاح",
    image: "/images/hero-illustration.jpeg",
    icon: WandSparklesIcon,
    href: ROUTES.dashboardCreate,
    action: "ابدأ إنشاء درس",
    featured: true,
  },
  {
    title: "استوديو الكتابة العربية",
    description: "صفحة المنتج الحالية للتعرّف على طريقة تحويل المحتوى إلى تجربة تعليمية.",
    status: "صفحة تعريفية",
    image: "/images/features-illustration.jpeg",
    icon: PenLineIcon,
    href: ROUTES.lessonStudio,
    action: "استكشف الاستوديو",
    featured: false,
  },
];

export default function ProductsPage() {
  return (
    <div dir="rtl" className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <main>
        <section className="border-y border-border bg-background px-6 py-16 sm:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-gold-700 dark:text-gold-300">منتجات فُصحاء</p>
            <h1 className="mt-3 font-heading text-4xl font-extrabold leading-tight text-brand-950 dark:text-brand-50 sm:text-5xl">أدوات عربية تصنع فرقًا في التعليم</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">استكشف المنتجات المتاحة حاليًا، واعرف بوضوح ما يمكنك استخدامه الآن وما هو متاح للتجربة والتعرّف.</p>
          </div>
        </section>

        <section className="px-6 py-14 sm:px-10 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            {products.map(({ title, description, status, image, icon: Icon, href, action, featured }) => (
              <article key={title} className={`overflow-hidden rounded-3xl border p-3 shadow-sm ${featured ? "border-foreground bg-foreground text-background shadow-xl dark:border-border dark:bg-card dark:text-card-foreground" : "border-border bg-card"}`}>
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-brand-50 dark:bg-secondary">
                  <Image src={image} alt={`معاينة ${title}`} fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
                </div>
                <div className="p-5 text-right sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${featured ? "bg-gold-300 text-brand-950" : "bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300"}`}>{status}</span>
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${featured ? "bg-gold-300 text-brand-950" : "bg-gold-100 text-gold-700"}`}><Icon /></span>
                  </div>
                  <h2 className="mt-5 font-heading text-2xl font-bold">{title}</h2>
                  <p className={`mt-3 min-h-14 leading-8 ${featured ? "text-background/80 dark:text-muted-foreground" : "text-muted-foreground"}`}>{description}</p>
                  <Button className="mt-5" variant={featured ? "secondary" : "outline"} nativeButton={false} render={<Link href={href} />}>{action}<ArrowLeftIcon data-icon="inline-end" /></Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border px-6 py-14 sm:px-10 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-gold-100 text-gold-700"><BookOpenIcon /></span>
              <h2 className="mt-4 font-heading text-2xl font-bold text-brand-950 dark:text-foreground">منتجات قيد التطوير</h2>
              <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">منتجات نعمل على تطويرها بعناية، وستتوفر تفاصيل الإتاحة عند اكتمالها.</p>
            </div>
            <article className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-sm">
              <div className="relative overflow-hidden rounded-2xl bg-secondary">
                <Image src="/images/arabic-letter-engine-light.png" alt="معاينة محرك رسم الحروف العربية في الوضع الفاتح" width={2048} height={1152} className="h-auto w-full dark:hidden" />
                <Image src="/images/arabic-letter-engine-dark.png" alt="معاينة محرك رسم الحروف العربية في الوضع الليلي" width={2048} height={1152} className="hidden h-auto w-full dark:block" />
              </div>
              <div className="p-5 text-right sm:p-6">
                <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-800 dark:bg-gold-500/15 dark:text-gold-300">قيد التطوير</span>
                <h3 className="mt-5 font-heading text-2xl font-bold">محرك رسم الحروف العربية</h3>
                <p className="mt-3 leading-8 text-muted-foreground">أداة تعليمية للتدريب على رسم الحروف العربية وتتبع خطوات كتابتها.</p>
              </div>
            </article>
          </div>
        </section>
      </main>

    </div>
  );
}
