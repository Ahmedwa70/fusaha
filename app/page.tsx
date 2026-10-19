import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowUpLeftIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  FeatherIcon,
  LanguagesIcon,
  LibraryBigIcon,
  MenuIcon,
  PenLineIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const tools = [
  { icon: WandSparklesIcon, title: "منشئ الدروس", body: "حوّل أي مصدر إلى درس تفاعلي منظم" },
  { icon: PenLineIcon, title: "استوديو الكتابة", body: "اكتب العربية بثقة ووضوح أكبر" },
  { icon: LanguagesIcon, title: "مدقق اللغة", body: "تحسينات دقيقة للسياق والأسلوب" },
  { icon: LibraryBigIcon, title: "مكتبتك", body: "كل دروسك ومواردك في مكان واحد" },
];

const steps = ["اختر مستواك", "أضف مصدرك", "خصص الدرس", "ابدأ التعلم"];

export default async function LandingPage() {
  const tApp = await getTranslations("app");
  const tFooter = await getTranslations("landing.footer");

  return (
    <div className="min-h-full overflow-hidden bg-background" dir="rtl">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:py-7">
        <Link href={ROUTES.home} className="flex items-center gap-3" aria-label={tApp("name")}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
            <FeatherIcon className="size-5" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight text-brand-950 dark:text-brand-50">فُصحى</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex" aria-label="التنقل الرئيسي">
          <a href="#tools" className="transition-colors hover:text-primary">الأدوات</a>
          <a href="#studio" className="transition-colors hover:text-primary">استوديو الكتابة</a>
          <a href="#library" className="transition-colors hover:text-primary">المكتبة</a>
          <a href="#how" className="transition-colors hover:text-primary">كيف تعمل</a>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex"><ThemeToggle /><LanguageSwitcher /></div>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={ROUTES.login} />}>تسجيل الدخول</Button>
          <Button size="sm" nativeButton={false} render={<Link href={ROUTES.signup} />}>ابدأ مجانًا</Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="فتح القائمة"><MenuIcon /></Button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 lg:pb-32 lg:pt-20">
          <div className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-gold-200/30 blur-3xl" />
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-800 dark:bg-gold-900/20 dark:text-gold-300">
                <SparklesIcon className="size-3.5" /> مساحة أذكى لتعلّم العربية
              </div>
              <h1 className="max-w-2xl font-heading text-4xl font-bold leading-[1.2] tracking-tight text-brand-950 dark:text-brand-50 sm:text-6xl lg:text-[4.35rem]">العربية ليست مادة،<br /><span className="text-gold-600 dark:text-gold-400">إنها مساحة.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-loose text-muted-foreground sm:text-xl">فُصحى تساعدك على بناء دروس عربية أعمق، وكتابة أوضح، وتجربة تعلم تنمو معك.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" nativeButton={false} render={<Link href={ROUTES.dashboardCreate} />}>ابدأ رحلتك الآن <ArrowLeftIcon data-icon="inline-end" /></Button>
                <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#tools" />}>اكتشف الأدوات <ChevronLeftIcon data-icon="inline-end" /></Button>
              </div>
              <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground"><span className="flex -space-x-2 space-x-reverse"><span className="size-8 rounded-full border-2 border-background bg-gold-300" /><span className="size-8 rounded-full border-2 border-background bg-brand-400" /><span className="size-8 rounded-full border-2 border-background bg-brand-700" /></span><span>ينضم إلينا معلمون ومتعلمون من كل مكان</span></div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-brand-100/60 blur-2xl dark:bg-brand-900/20" />
              <div className="relative overflow-hidden rounded-[2rem] border border-brand-200 bg-brand-900 p-4 shadow-2xl shadow-brand-900/20 dark:border-brand-700">
                <div className="rounded-[1.35rem] bg-brand-800/80 p-5 sm:p-7">
                  <div className="mb-12 flex items-center justify-between text-brand-200"><span className="text-xs">درس اليوم</span><span className="rounded-full bg-gold-400/15 px-3 py-1 text-xs text-gold-300">مستوى متوسط</span></div>
                  <p className="font-heading text-3xl leading-relaxed text-brand-50 sm:text-4xl">اللغة بيتٌ يسكنه<br /><span className="text-gold-300">الجميع.</span></p>
                  <div className="mt-10 grid grid-cols-3 gap-2"><div className="h-1.5 rounded-full bg-gold-400" /><div className="h-1.5 rounded-full bg-gold-400/30" /><div className="h-1.5 rounded-full bg-gold-400/30" /></div>
                  <div className="mt-6 flex items-center justify-between text-xs text-brand-200"><span>تقدمك في الدرس</span><span>٣٥٪</span></div>
                </div>
                <div className="flex items-center justify-between px-3 pt-4 text-xs text-brand-300"><span>فُصحى / الدروس التفاعلية</span><ArrowUpLeftIcon className="size-4" /></div>
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="border-y border-border/70 bg-brand-50/50 px-5 py-20 sm:px-8 lg:py-28 dark:bg-brand-950/20">
          <div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 text-sm font-semibold text-gold-700 dark:text-gold-400">كل ما تحتاجه في مكان واحد</p><h2 className="font-heading text-3xl font-bold text-brand-950 dark:text-brand-50 sm:text-4xl">أدوات تصنع فرقًا حقيقيًا</h2></div><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">من الفكرة الأولى إلى درس جاهز، صممنا فُصحى لترافقك في كل خطوة.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tools.map(({ icon: Icon, title, body }, index) => { const card = <div className={`rounded-2xl border p-6 transition-transform hover:-translate-y-1 ${index === 1 ? "border-gold-300 bg-gold-50 dark:bg-gold-900/10" : "border-border bg-card"}`}><div className="mb-10 flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-800 dark:text-gold-300"><Icon className="size-5" /></div><h3 className="font-heading text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p><ArrowLeftIcon className="mt-6 size-4 text-gold-600" /></div>; return index === 0 ? <Link key={title} href={ROUTES.dashboardCreate} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card}</Link> : <div key={title}>{card}</div>; })}</div>
          </div>
        </section>

        <section id="studio" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-24 lg:py-32"><div><p className="mb-3 text-sm font-semibold text-gold-700 dark:text-gold-400">استوديو الكتابة العربية</p><h2 className="font-heading text-3xl font-bold leading-tight text-brand-950 dark:text-brand-50 sm:text-5xl">اكتب بصوتك.<br />ودع فُصحى تصقل الأثر.</h2><p className="mt-6 max-w-lg leading-loose text-muted-foreground">مساحة كتابة هادئة تفهم العربية. راجع أسلوبك، اكتشف الأخطاء، وحوّل أفكارك إلى نصوص تستحق أن تُقرأ.</p><ul className="mt-8 flex flex-col gap-4 text-sm"><li className="flex items-center gap-3"><CheckIcon className="size-5 text-gold-600" /> اقتراحات تحافظ على صوتك</li><li className="flex items-center gap-3"><CheckIcon className="size-5 text-gold-600" /> ملاحظات لغوية في سياقها</li><li className="flex items-center gap-3"><CheckIcon className="size-5 text-gold-600" /> تجربة كتابة بلا تشتيت</li></ul></div><div className="rounded-[2rem] border border-border bg-card p-4 shadow-xl shadow-brand-900/5"><div className="rounded-2xl bg-brand-50 p-6 dark:bg-brand-950"><div className="mb-8 flex items-center justify-between border-b border-brand-200 pb-4 dark:border-brand-800"><span className="text-sm font-semibold">مسودة جديدة</span><span className="text-xs text-muted-foreground">حُفظت للتو</span></div><p className="font-heading text-xl leading-loose text-brand-900 dark:text-brand-100">حين نكتب، نحن لا ننقل الكلمات فقط؛<br /><span className="rounded bg-gold-200/70 px-1 text-brand-950 dark:bg-gold-700/40 dark:text-gold-100">نحن نمنح الفكرة بيتًا.</span></p><div className="mt-10 flex justify-between text-xs text-muted-foreground"><span>١٢٤ كلمة</span><span className="text-gold-700">اقتراح واحد متاح</span></div></div></div></section>

        <section id="library" className="bg-brand-900 px-5 py-20 text-brand-50 sm:px-8 lg:py-28"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="mb-3 text-sm font-semibold text-gold-300">المكتبة والموارد</p><h2 className="font-heading text-3xl font-bold leading-tight sm:text-5xl">معرفتك،<br />مرتبة كما تحب.</h2><p className="mt-6 max-w-md leading-loose text-brand-200">احفظ دروسك، اجمع مصادرك، وابنِ مكتبة خاصة تنمو مع مسيرتك التعليمية.</p><Button className="mt-8 bg-gold-400 text-brand-950 hover:bg-gold-300" size="lg" nativeButton={false} render={<Link href={ROUTES.signup} />}>أنشئ مكتبتك <ArrowLeftIcon data-icon="inline-end" /></Button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="col-span-2 rounded-2xl bg-brand-800 p-5 sm:col-span-1"><BookOpenIcon className="mb-10 size-6 text-gold-300" /><p className="font-heading text-2xl font-bold">١٢</p><p className="mt-1 text-sm text-brand-300">درسًا تفاعليًا</p></div><div className="rounded-2xl bg-gold-400 p-5 text-brand-950"><LibraryBigIcon className="mb-10 size-6" /><p className="font-heading text-2xl font-bold">٤٨</p><p className="mt-1 text-sm opacity-70">موردًا محفوظًا</p></div><div className="rounded-2xl border border-brand-700 p-5"><PenLineIcon className="mb-10 size-6 text-gold-300" /><p className="font-heading text-2xl font-bold">٢٤</p><p className="mt-1 text-sm text-brand-300">مسودة مكتملة</p></div></div></div></section>

        <section id="how" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="text-center"><p className="mb-3 text-sm font-semibold text-gold-700 dark:text-gold-400">بداية بسيطة</p><h2 className="font-heading text-3xl font-bold text-brand-950 dark:text-brand-50 sm:text-4xl">أربع خطوات وتبدأ</h2></div><div className="mt-14 grid gap-8 sm:grid-cols-4">{steps.map((step, index) => <div key={step} className="relative text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gold-300 bg-gold-50 font-heading text-lg font-bold text-gold-700 dark:bg-gold-900/20">{index + 1}</div><h3 className="mt-5 font-heading font-bold">{step}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{["اختر المسار الذي يناسب هدفك", "أضف نصًا أو ملفًا من مكتبتك", "دع الأدوات ترتب التجربة", "تعلم واكتب وشارك"] [index]}</p>{index < 3 && <div className="absolute right-[calc(50%+2.5rem)] top-7 hidden h-px w-[calc(100%-5rem)] bg-border sm:block" />}</div>)}</div></section>

        <section className="px-5 pb-20 sm:px-8 lg:pb-28"><div className="mx-auto max-w-5xl rounded-[2rem] bg-gold-100 px-6 py-16 text-center dark:bg-gold-900/20 sm:px-12"><h2 className="font-heading text-3xl font-bold text-brand-950 dark:text-brand-50 sm:text-4xl">جاهز لتكتب فصلًا جديدًا؟</h2><p className="mx-auto mt-4 max-w-md leading-relaxed text-muted-foreground">ابدأ مجانًا، واكتشف كيف يمكن للأدوات الصحيحة أن تغيّر علاقتك بالعربية.</p><Button size="lg" className="mt-8" nativeButton={false} render={<Link href={ROUTES.signup} />}>ابدأ مع فُصحى <ArrowLeftIcon data-icon="inline-end" /></Button></div></section>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FeatherIcon className="size-4" /></span><span className="font-heading text-lg font-bold">فُصحى</span></div><p className="mt-3 max-w-xs text-sm text-muted-foreground">مساحتك الأهدأ لتعلّم العربية وصناعة المعرفة.</p></div><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><a href="#tools" className="hover:text-primary">الأدوات</a><a href="#studio" className="hover:text-primary">الكتابة</a><a href="#library" className="hover:text-primary">المكتبة</a><Link href={ROUTES.login} className="hover:text-primary">تسجيل الدخول</Link></div><p className="text-xs text-muted-foreground">{tFooter("rights")}</p></div></footer>
    </div>
  );
}
