"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon, BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

export function LibraryManagement({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("admin.library");
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">{t("sectionTitle")}</h1><p className="text-muted-foreground">{t("sectionDescription")}</p></div>{canCreate && <Button render={<Link href={ROUTES.adminLibraryNew} />}><PlusIcon data-icon="inline-start" />{t("newBook")}</Button>}</div><Card><CardContent className="space-y-4 pt-6"><div className="flex flex-wrap gap-3"><div className="relative min-w-64 flex-1"><SearchIcon className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("searchPlaceholder")} disabled /></div><select className="h-9 rounded-lg border bg-background px-3 text-sm" disabled><option>{t("allStatuses")}</option></select></div><div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"><BookOpenIcon className="mb-3 size-10 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{t("emptyTitle")}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>{canCreate && <Button className="mt-4" variant="outline" render={<Link href={ROUTES.adminLibraryNew} />}>{t("createFirst")}</Button>}</div></CardContent></Card></div>;
}
