"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpenIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLibraryBook, libraryBooks, libraryCategories, libraryLevels, type LibraryBook } from "@/content/library";

function BookCard({ book }: { book: LibraryBook }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold-200 bg-card shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg dark:border-border">
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-secondary">
        {book.cover ? <Image src={book.cover} alt={`غلاف ${book.title}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" /> : <BookOpenIcon className="size-14 text-gold-600" aria-hidden="true" />}
        <Badge className="absolute right-4 top-4 bg-card/95 text-brand-900 shadow-sm dark:text-card-foreground">{book.level}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-5 text-right">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-brand-950 dark:text-card-foreground">{book.title}</h2>
          <BookOpenIcon className="mt-1 size-5 shrink-0 text-gold-600" aria-hidden="true" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{book.author}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{book.category}</Badge><Badge variant="outline">{book.audience}</Badge></div>
        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">{book.description}</p>
        <Link href={`/library/${book.slug}`} className="mt-5 inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">عرض تفاصيل الكتاب</Link>
      </div>
    </article>
  );
}

export function LibraryBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [level, setLevel] = useState("الكل");
  const filteredBooks = useMemo(() => libraryBooks.filter((book) => {
    const haystack = `${book.title} ${book.author} ${book.category} ${book.level} ${book.audience} ${book.description}`;
    return haystack.includes(query.trim()) && (category === "الكل" || book.category === category) && (level === "الكل" || book.level === level);
  }), [category, level, query]);

  return <>
    <section className="rounded-2xl border border-gold-200 bg-card p-4 shadow-sm dark:border-border sm:p-5" aria-label="البحث والتصفية">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <label className="relative flex-1"><span className="sr-only">ابحث في الكتب</span><SearchIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالعنوان أو المؤلف" className="h-11 pr-10" /></label>
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><SlidersHorizontalIcon className="size-4" aria-hidden="true" /><span>تصفية</span></div>
        <label className="flex items-center gap-2"><span className="sr-only">التصنيف</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm"><option>الكل</option>{libraryCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="flex items-center gap-2"><span className="sr-only">المستوى</span><select value={level} onChange={(event) => setLevel(event.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm"><option>الكل</option>{libraryLevels.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
    </section>
    <p className="mt-6 text-sm text-muted-foreground">{filteredBooks.length} كتب منشورة</p>
    {filteredBooks.length > 0 ? <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{filteredBooks.map((book) => <BookCard key={book.slug} book={book} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-gold-300 px-6 py-14 text-center"><BookOpenIcon className="mx-auto size-10 text-gold-600" aria-hidden="true" /><p className="mt-4 font-bold">لم نعثر على كتب مطابقة</p><p className="mt-2 text-sm text-muted-foreground">جرّب تغيير كلمات البحث أو خيارات التصفية.</p></div>}
  </>;
}

export { getLibraryBook };
