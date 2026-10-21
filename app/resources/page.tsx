import Link from "next/link";
import { ArrowLeftIcon, BookOpenIcon, PenLineIcon, WandSparklesIcon } from "lucide-react";
import { PublicHeader } from "@/app/_components/public-header";
import { ResourceCard } from "@/app/resources/_components/resource-card";
import { resourceCatalog } from "@/content/resources";
import { ROUTES } from "@/constants/routes";

export const metadata = {
  title: "الموارد والأدوات | فُصحاء",
  description: "أدوات فُصحاء المتاحة لمعلمي اللغة العربية، في مكان واحد.",
};

const tools = resourceCatalog.filter((resource) => resource.kind === "tool");
const educationalResources = resourceCatalog.filter((resource) => resource.kind === "educational");

export default function ResourcesPage() {
  return (
    <div dir="rtl" className="min-h-full overflow-hidden bg-background text-foreground">
      <PublicHeader homeHref={ROUTES.home} />
      <main>
        <section className="border-y border-gold-100 bg-[radial-gradient(circle_at_85%_18%,rgba(184,145,77,0.16),transparent_26%),linear-gradient(120deg,#f6f1e4,#fbfaf5_55%,#f4efe1)] px-5 py-16 dark:border-border dark:bg-[radial-gradient(circle_at_85%_18%,rgba(184,145,77,0.12),transparent_26%),linear-gradient(120deg,#111b28,#182231_55%,#101923)] sm:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold text-gold-700 dark:text-gold-300">موارد فُصحاء</p>
            <h1 className="mt-3 font-heading text-4xl font-extrabold leading-tight text-brand-950 dark:text-brand-50 sm:text-5xl">أدوات وموارد تساعدك على تعليم العربية</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-brand-900/75 dark:text-slate-300">اكتشف الأدوات المتاحة من فُصحاء، وتابع هذه المساحة للموارد التعليمية التي ستتوفر مع نمو المنصة.</p>
            <Link href={ROUTES.dashboardCreate} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 dark:bg-gold-500 dark:text-brand-950 dark:hover:bg-gold-400">ابدأ بإنشاء درس <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 lg:py-20" aria-labelledby="tools-heading">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4 border-b border-gold-200 pb-5 dark:border-border">
              <div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">متاح للاستخدام</p><h2 id="tools-heading" className="mt-2 font-heading text-3xl font-bold text-brand-950 dark:text-foreground">أدوات فُصحاء</h2></div>
              <WandSparklesIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" />
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2">{tools.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
          </div>
        </section>

        <section className="border-y border-gold-100 bg-[#f7f4eb] px-5 py-14 dark:border-border dark:bg-background sm:px-8 lg:py-20" aria-labelledby="educational-heading">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4 border-b border-gold-200 pb-5 dark:border-border">
              <div><p className="text-sm font-bold text-gold-700 dark:text-gold-300">قريبًا مع توفر المحتوى</p><h2 id="educational-heading" className="mt-2 font-heading text-3xl font-bold text-brand-950 dark:text-foreground">الموارد التعليمية</h2></div>
              <BookOpenIcon className="hidden size-9 text-gold-600 sm:block" aria-hidden="true" />
            </div>
            {educationalResources.length > 0 ? <div className="mt-8 grid gap-6 md:grid-cols-2">{educationalResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-gold-300 bg-white/60 px-6 py-10 text-center dark:border-border dark:bg-card/40"><BookOpenIcon className="mx-auto size-10 text-gold-600" aria-hidden="true" /><h3 className="mt-4 font-heading text-xl font-bold text-brand-950 dark:text-foreground">لا توجد موارد تعليمية منشورة بعد</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-brand-800 dark:text-brand-100/70">سنضيف هنا أوراق العمل والقصص والأدلة المتاحة فعليًا عند جاهزيتها للنشر. لا توجد ملفات أو تنزيلات وهمية في الوقت الحالي.</p></div>}
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 lg:py-20"><div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl bg-brand-900 px-6 py-12 text-center text-brand-50 shadow-xl sm:px-10"><PenLineIcon className="size-9 text-gold-300" aria-hidden="true" /><h2 className="mt-4 font-heading text-3xl font-bold">ابدأ بأدوات فُصحاء المتاحة اليوم</h2><p className="mt-3 max-w-xl leading-7 text-brand-100/80">أنشئ درسًا تفاعليًا أو افتح استوديو الكتابة العربية من الوجهات الفعلية في المنصة.</p><Link href={ROUTES.lessonStudio} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-brand-900 transition-colors hover:bg-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2">افتح استوديو الكتابة <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" /></Link></div></section>
      </main>
    </div>
  );
}
