import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ArrowUpLeftIcon, BookOpenIcon, MenuIcon, PenLineIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const resourceCovers = [
  ["الكتابة العربية", "أساسيات التعبير العربي"],
  ["أسماء الأفعال", "مجموعة تعليمية"],
  ["التعبير الواضح", "مهارات الكتابة"],
  ["فهم النصوص", "قراءات عربية"],
  ["النحو الميسر", "دليل المتعلم"],
  ["المرجع الشامل", "مفاهيم العربية"],
];

const tools = [
  { title: "المكتبة التعليمية", body: "موارد تعليمية مختارة تساعدك على إثراء تجربة التعلم.", action: "تصفح المكتبة", image: "/images/features-illustration.jpeg", icon: BookOpenIcon },
  { title: "استوديو الكتابة العربية", body: "اكتب بثقة ووضوح، وطوّر أسلوبك العربي في مساحة هادئة.", action: "استكشف محرر الكتابة", image: "/images/hero-illustration.jpeg", icon: PenLineIcon },
  { title: "مولّد الدروس التفاعلية", body: "حوّل مصادرك إلى دروس تفاعلية منظمة في دقائق.", action: "اكتشف الأداة", image: "/images/features-illustration.jpeg", icon: WandSparklesIcon },
];

export default async function LandingPage() {
  const tFooter = await getTranslations("landing.footer");

  return (
    <div dir="rtl" className="min-h-full overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:py-5">
        <Link href={ROUTES.home} aria-label="فصحاء" className="flex items-center gap-2">
          <Image src="/logo.png" alt="فصحاء" width={52} height={52} className="size-12 object-contain" priority />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-brand-950 dark:text-brand-50 lg:flex" aria-label="التنقل الرئيسي">
          <a href="#tools" className="text-gold-700">الرئيسية</a>
          <a href="#tools" className="hover:text-gold-700">الأدوات التعليمية</a>
          <a href="#library" className="hover:text-gold-700">المكتبة</a>
          <a href="#projects" className="hover:text-gold-700">المشروعات</a>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex"><ThemeToggle /><LanguageSwitcher /></div>
          <Link href={ROUTES.login} className="hidden text-sm font-semibold text-brand-900 hover:text-gold-700 sm:block dark:text-brand-50">تسجيل الدخول</Link>
          <Button size="sm" nativeButton={false} render={<Link href="#tools" />}>استكشف الأدوات</Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="فتح القائمة"><MenuIcon /></Button>
        </div>
      </header>

      <main>
        <section className="relative bg-gold-50 px-5 pb-16 pt-10 dark:bg-brand-950 sm:px-8 lg:pb-20 lg:pt-16">
          <div className="pointer-events-none absolute -bottom-20 -left-12 size-64 rounded-full border-[28px] border-brand-200/30 dark:border-brand-700/20" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div className="order-2 text-center lg:order-1 lg:text-right">
              <p className="mb-4 text-sm font-bold text-gold-700 dark:text-gold-300">أدوات فُصحاء التعليمية</p>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.25] text-brand-950 dark:text-brand-50 sm:text-5xl lg:text-6xl">أدوات تحوّل المعرفة<br />إلى تجربة تعليمية</h1>
              <p className="mx-auto mt-5 max-w-lg text-base leading--loose text-brand-800/80 dark:text-brand-100/75 lg:mx-0">من إعداد الدروس التفاعلية إلى رسم الحروف والكتابة العربية، اكتشف أدوات تساعدك على صناعة محتوى تعليمي أكثر فاعلية.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start"><Button size="lg" nativeButton={false} render={<Link href="#tools" />}>استكشف الأدوات <ArrowLeftIcon data-icon="inline-end" /></Button><Button size="lg" variant="outline" nativeButton={false} render={<Link href="#library" />}>تصفح المكتبة المجانية</Button></div>
            </div>
            <div className="order-1 mx-auto w-full max-w-xl lg:order-2"><Image src="/images/hero-illustration.jpeg" alt="واجهة أدوات فصحاء التعليمية على أجهزة متعددة" width={900} height={620} className="w-full rounded-3xl object-cover mix-blend-multiply dark:mix-blend-normal" priority /></div>
          </div>
        </section>

        <section id="tools" className="bg-background px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl"><div className="mb-10 text-center"><h2 className="font-heading text-3xl font-extrabold text-brand-950 dark:text-brand-50 sm:text-4xl">أدوات تعليمية صُممت لتنجز أكثر</h2><p className="mt-3 text-muted-foreground">اختر الأداة المناسبة لمهمتك التعليمية، وانتقل مباشرة إلى العمل النافع بها.</p></div>
            <div className="grid gap-5 lg:grid-cols-3">{tools.map(({ title, body, action, image, icon: Icon }, index) => <article key={title} className={`overflow-hidden rounded-2xl border p-3 shadow-sm ${index === 1 ? "border-gold-300 bg-gold-50/50 dark:bg-gold-900/10" : "border-brand-200 bg-card dark:border-brand-700"}`}><div className="relative h-40 overflow-hidden rounded-xl bg-brand-50 dark:bg-brand-900"><Image src={image} alt="" fill className="object-cover" /></div><div className="p-4 text-right"><div className="flex items-center justify-between"><h3 className="font-heading text-xl font-bold text-brand-950 dark:text-brand-50">{title}</h3><Icon className="size-5 text-gold-700" /></div><p className="mt-3 min-h-12 text-sm leading-relaxed text-muted-foreground">{body}</p><Link href={index === 2 ? ROUTES.dashboardCreate : "#projects"} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-400 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-brand-50 dark:text-brand-50 dark:hover:bg-brand-800">{action}<ArrowLeftIcon data-icon="inline-end" /></Link></div></article>)}</div>
          </div>
        </section>

        <section id="projects" className="bg-gold-50 px-5 py-16 dark:bg-brand-900 sm:px-8 lg:py-24"><div className="mx-auto max-w-5xl"><div className="mb-12 text-center"><h2 className="font-heading text-3xl font-extrabold text-brand-950 dark:text-brand-50 sm:text-4xl">منصة واحدة، وأدوات متعددة</h2><p className="mt-3 text-muted-foreground">كل ما تحتاجه لبناء تجربة تعليمية متكاملة، في مسار واضح.</p></div><div className="grid items-center gap-8 md:grid-cols-3"><div className="text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold-400 bg-background text-gold-700"><PenLineIcon /></div><h3 className="mt-4 font-bold">إنشاء المحتوى التعليمي</h3><p className="mt-2 text-sm text-muted-foreground">أنشئ المحتوى، ثم عدّل التفاصيل بما يناسب المتعلم.</p></div><div className="hidden h-px bg-gold-400/60 md:block" /><div className="text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold-400 bg-background text-gold-700"><SparklesIcon /></div><h3 className="mt-4 font-bold">إنتاج الوسائل البصرية</h3><p className="mt-2 text-sm text-muted-foreground">اجعل الفكرة أوضح بصريًا وأكثر قابلية للتذكر.</p></div><div className="hidden h-px bg-gold-400/60 md:block" /><div className="text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold-400 bg-background text-gold-700"><BookOpenIcon /></div><h3 className="mt-4 font-bold">الوصول إلى الموارد التعليمية</h3><p className="mt-2 text-sm text-muted-foreground">اكتشف موارد تساعدك على مواصلة التعلم.</p></div></div></div></section>

        <section id="library" className="bg-background px-5 py-16 sm:px-8 lg:py-24"><div className="mx-auto max-w-7xl"><div className="mb-10 text-center"><h2 className="font-heading text-3xl font-extrabold text-brand-950 dark:text-brand-50 sm:text-4xl">موارد تعليمية متاحة للجميع</h2><p className="mt-3 text-muted-foreground">مجموعة متجددة من الكتب والمواد التعليمية المفيدة.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{resourceCovers.map(([title, subtitle], index) => <article key={title} className="rounded-xl border border-gold-300 bg-gold-50 p-3 text-center dark:bg-brand-900"><div className={`flex h-36 items-end justify-center rounded-lg bg-gradient-to-br ${index % 2 ? "from-gold-700 to-brand-800" : "from-brand-700 to-brand-950"} p-3 text-brand-50 shadow-inner`}><BookOpenIcon className="size-10 opacity-70" /></div><h3 className="mt-3 text-sm font-bold text-brand-950 dark:text-brand-50">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p><Link href="#" className="mt-3 inline-block text-xs font-bold text-gold-700">عرض المورد</Link></article>)}</div></div></section>

        <section className="bg-brand-50 px-5 py-16 dark:bg-brand-950 sm:px-8 lg:py-24"><div className="mx-auto max-w-5xl"><div className="mb-8 text-center"><h2 className="font-heading text-3xl font-extrabold text-brand-950 dark:text-brand-50 sm:text-4xl">مشروعات وأدوات جديدة في طريقها إليك</h2><p className="mt-3 text-muted-foreground">نطوّر أدوات تساعدك على جعل المعرفة أقرب وأوضح.</p></div><div className="grid gap-5 md:grid-cols-2"><div className="overflow-hidden rounded-2xl border border-brand-200 bg-card p-3"><div className="flex h-36 items-center justify-center rounded-xl bg-brand-900 text-brand-50"><span className="font-heading text-7xl text-gold-300">ع</span><ArrowUpLeftIcon className="mx-4 size-8 text-gold-400" /><span className="font-heading text-7xl text-gold-300">م</span></div><h3 className="mt-4 font-bold">محرك الكتابة العربية البصرية</h3><p className="mt-2 text-sm text-muted-foreground">أدوات تجعل الحرف العربي حاضرًا في التصميم والتعليم.</p></div><div className="overflow-hidden rounded-2xl border border-gold-300 bg-gold-50 p-3 dark:bg-gold-900/10"><div className="flex h-36 items-center justify-center gap-4 rounded-xl border border-gold-300 bg-background"><div className="h-14 w-28 rounded-md border-2 border-brand-300" /><SparklesIcon className="text-gold-600" /><div className="h-14 w-28 rounded-md border-2 border-brand-300" /></div><h3 className="mt-4 font-bold">أدوات تعليمية أكثر ذكاءً</h3><p className="mt-2 text-sm text-muted-foreground">نواصل بناء تجارب تخدم المعلم والمتعلم.</p></div></div></div></section>

        <section className="relative overflow-hidden bg-brand-900 px-5 py-14 text-center text-brand-50 sm:px-8"><div className="pointer-events-none absolute inset-0 opacity-10 [background-image:linear-gradient(45deg,transparent_45%,#d6aa54_46%,#d6aa54_54%,transparent_55%),linear-gradient(-45deg,transparent_45%,#d6aa54_46%,#d6aa54_54%,transparent_55%)] [background-size:48px_48px]" /><div className="relative"><h2 className="font-heading text-3xl font-extrabold sm:text-4xl">ابدأ باكتشاف أدوات فُصحاء</h2><div className="mt-6 flex flex-wrap justify-center gap-3"><Button className="bg-gold-400 text-brand-950 hover:bg-gold-300" size="lg" nativeButton={false} render={<Link href={ROUTES.dashboardCreate} />}>استكشف الأدوات</Button><Button variant="outline" className="border-brand-300 text-brand-50 hover:bg-brand-800" size="lg" nativeButton={false} render={<Link href="#library" />}>تصفح المكتبة المجانية</Button></div></div></section>
      </main>

      <footer className="bg-brand-950 px-5 py-10 text-brand-100 sm:px-8"><div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-[1.3fr_1fr_1fr_1fr]"><div><Image src="/logo.png" alt="فصحاء" width={72} height={72} className="mb-3 object-contain" /><p className="max-w-xs text-sm leading-relaxed text-brand-300">أدوات تساعدك على بناء المعرفة وتعليم العربية بثقة.</p></div><div><h3 className="font-bold text-gold-300">الرئيسية</h3><div className="mt-3 flex flex-col gap-2 text-sm text-brand-300"><a href="#tools">الأدوات التعليمية</a><a href="#projects">المشروعات</a></div></div><div><h3 className="font-bold text-gold-300">الأدوات التعليمية</h3><div className="mt-3 flex flex-col gap-2 text-sm text-brand-300"><Link href={ROUTES.dashboardCreate}>مولّد الدروس</Link><a href="#projects">استوديو الكتابة</a></div></div><div><h3 className="font-bold text-gold-300">المكتبة</h3><div className="mt-3 flex flex-col gap-2 text-sm text-brand-300"><a href="#library">الموارد</a><Link href={ROUTES.login}>تسجيل الدخول</Link></div></div></div><p className="mx-auto mt-8 max-w-7xl border-t border-brand-800 pt-5 text-center text-xs text-brand-400">{tFooter("rights")}</p></footer>
    </div>
  );
}
