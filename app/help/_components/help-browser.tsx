"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpenIcon, ChevronDownIcon, HeadphonesIcon, MessagesSquareIcon, SearchIcon, WrenchIcon } from "lucide-react";
import { helpArticles, helpCategories, type HelpCategory } from "@/content/help";

const categoryIcons = { book: BookOpenIcon, messages: MessagesSquareIcon, wrench: WrenchIcon, headphones: HeadphonesIcon } as const;

export function HelpBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "all">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const filteredArticles = useMemo(() => helpArticles.filter((article) => {
    const matchesCategory = category === "all" || article.category === category;
    const searchable = `${article.question} ${article.answer}`.toLocaleLowerCase("ar");
    return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [category, normalizedQuery]);

  return (
    <>
      <section className="rounded-[2rem] border border-border bg-card/75 px-5 py-12 text-center shadow-sm sm:px-10 lg:py-16">
        <SearchIcon className="mx-auto size-10 text-gold-500" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">كيف يمكننا مساعدتك؟</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">ابحث عن سؤال أو مشكلة أو طريقة استخدام.</p>
        <label className="mx-auto mt-8 flex max-w-4xl items-center gap-3 rounded-2xl border border-border bg-muted/70 px-5 py-4 text-right transition-colors focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-500/20">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">ابحث في مركز المساعدة</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="اكتب سؤالك هنا..." className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" aria-label="ابحث في مركز المساعدة" />
        </label>
      </section>

      <nav className="grid gap-4 sm:grid-cols-2" aria-label="أقسام مركز المساعدة">
        {helpCategories.map((item) => {
          const Icon = categoryIcons[item.icon as keyof typeof categoryIcons];
          const isActive = item.id !== "contact" && category === item.id;
          return item.id === "contact" ? (
            <a key={item.id} href="#contact" className="group rounded-2xl border border-border bg-card p-6 text-right transition-colors hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
              <Icon className="size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </a>
          ) : (
            <button key={item.id} type="button" onClick={() => setCategory(isActive ? "all" : item.id)} aria-pressed={isActive} className="group rounded-2xl border border-border bg-card p-6 text-right transition-colors hover:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 aria-pressed:border-gold-500 aria-pressed:bg-gold-500/5">
              <Icon className="size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-5 text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </nav>

      <section className="rounded-2xl border border-border bg-card px-5 sm:px-7" aria-labelledby="faq-heading">
        <div className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-gold-500">معلومات موثقة من تجربة المنصة</p><h2 id="faq-heading" className="mt-2 text-2xl font-bold">أسئلة يطرحها المستخدمون كثيرًا</h2></div><span className="text-sm text-muted-foreground">{filteredArticles.length} نتائج</span></div>
        {filteredArticles.length > 0 ? <div>{filteredArticles.map((article) => <details key={article.id} className="group border-b border-border last:border-b-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-base font-semibold marker:hidden [&::-webkit-details-marker]:hidden"><span>{article.question}</span><ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="max-w-3xl pb-6 text-sm leading-8 text-muted-foreground"><p>{article.answer}</p>{article.href && <Link href={article.href} className="mt-3 inline-flex text-sm font-bold text-gold-600 underline-offset-4 hover:underline">استكشف الوجهة المرتبطة</Link>}</div></details>)}</div> : <div className="py-14 text-center"><SearchIcon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><p className="mt-4 font-bold">لم نعثر على نتائج مطابقة</p><p className="mt-2 text-sm text-muted-foreground">جرّب كلمات مختلفة أو اختر قسمًا آخر.</p></div>}
      </section>

      <section id="contact" className="scroll-mt-8 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center"><HeadphonesIcon className="mx-auto size-8 text-gold-500" aria-hidden="true" /><h2 className="mt-4 text-xl font-bold">تواصل معنا</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">لا توجد وسيلة تواصل رسمية منشورة في المشروع حاليًا. سيُستكمل هذا القسم عند اعتماد قناة التواصل.</p></section>
    </>
  );
}
