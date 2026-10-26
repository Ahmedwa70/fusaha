"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon, BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

type LibraryRow = { id: string; slug: string; originalTitle: string; publicationStatus: string; reviewStatus: string; updatedAt: Date };

export function LibraryManagement({ canCreate, books }: { canCreate: boolean; books: LibraryRow[] }) {
  const t = useTranslations("admin.library");
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">{t("sectionTitle")}</h1><p className="text-muted-foreground">{t("sectionDescription")}</p></div>{canCreate && <Button render={<Link href={ROUTES.adminLibraryNew} />}><PlusIcon data-icon="inline-start" />{t("newBook")}</Button>}</div><Card><CardContent className="space-y-4 pt-6"><div className="flex flex-wrap gap-3"><div className="relative min-w-64 flex-1"><SearchIcon className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("searchPlaceholder")} disabled /></div><select className="h-9 rounded-lg border bg-background px-3 text-sm" disabled><option>{t("allStatuses")}</option></select></div>{books.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"><BookOpenIcon className="mb-3 size-10 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{t("emptyTitle")}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>{canCreate && <Button className="mt-4" variant="outline" render={<Link href={ROUTES.adminLibraryNew} />}>{t("createFirst")}</Button>}</div> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/40 text-left"><tr><th className="p-3">{t("bookTitle")}</th><th className="p-3">{t("status")}</th><th className="p-3">{t("reviewStatus")}</th><th className="p-3">{t("updated")}</th></tr></thead><tbody>{books.map((book) => <tr key={book.id} className="border-t"><td className="p-3"><Link className="font-medium hover:underline" href={`${ROUTES.adminLibrary}/${book.id}`}>{book.originalTitle}</Link><div className="text-xs text-muted-foreground">{book.slug}</div></td><td className="p-3">{book.publicationStatus}</td><td className="p-3">{book.reviewStatus}</td><td className="p-3 text-muted-foreground">{book.updatedAt.toLocaleDateString()}</td></tr>)}</tbody></table></div>}</CardContent></Card></div>;
}
