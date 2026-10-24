import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/app/_components/public-header";
import { getLibraryBook, libraryBooks } from "@/content/library";
import { ROUTES } from "@/constants/routes";

export function generateStaticParams() { return libraryBooks.map((book) => ({ slug: book.slug })); }
export async function generateMetadata({ params }: PageProps<"/library/[slug]">): Promise<Metadata> { const book = getLibraryBook((await params).slug); return book ? { title: `${book.title} | مكتبة فُصحاء`, description: book.description } : { title: "الكتاب غير موجود | فُصحاء" }; }

export default async function LibraryBookPage({ params }: PageProps<"/library/[slug]">) {
  const book = getLibraryBook((await params).slug);
  if (!book) notFound();
  return <div dir="rtl" className="min-h-full bg-background text-foreground"><PublicHeader homeHref={ROUTES.library} /><main className="px-5 py-12 sm:px-8 lg:py-20"><div className="mx-auto max-w-5xl"><Link href={ROUTES.library} className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:text-gold-600"><ArrowRightIcon data-icon="inline-start" aria-hidden="true" />العودة إلى المكتبة</Link><article className="mt-8 grid overflow-hidden rounded-3xl border border-gold-200 bg-card shadow-sm dark:border-border lg:grid-cols-[0.8fr_1.2fr]"><div className="flex min-h-72 items-center justify-center bg-brand-50 dark:bg-secondary"><BookOpenIcon className="size-20 text-gold-600" aria-hidden="true" /></div><div className="p-6 text-right sm:p-10"><p className="text-sm font-bold text-gold-700 dark:text-gold-300">{book.category}</p><h1 className="mt-3 font-heading text-3xl font-extrabold text-brand-950 dark:text-card-foreground sm:text-4xl">{book.title}</h1><p className="mt-3 text-muted-foreground">إعداد: {book.author}</p><div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">المستوى: {book.level}</span><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">الفئة: {book.audience}</span></div><p className="mt-7 leading-8 text-brand-900/80 dark:text-brand-100/75">{book.description}</p><div className="mt-8 rounded-2xl border border-gold-200 bg-gold-50/50 p-5 dark:border-border dark:bg-secondary/50"><p className="font-bold">طريقة الوصول</p><p className="mt-2 text-sm leading-7 text-muted-foreground">هذا السجل يعرض بيانات الكتاب فقط حاليًا. قد تخضع أي روابط أو مواد مستقبلية لشروط الناشر وحقوق الاستخدام.</p>{book.access.href && <a href={book.access.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-bold text-white">{book.access.label}<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" /></a>}</div></div></article></div></main></div>;
}
