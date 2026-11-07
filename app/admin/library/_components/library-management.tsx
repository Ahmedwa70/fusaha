"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CheckCircle2Icon, Clock3Icon, FilterIcon, HardDriveIcon, PlusIcon, SearchIcon, ShieldAlertIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";

type LibraryRow = { id: string; slug: string; originalTitle: string; publicationStatus: string; reviewStatus: string; updatedAt: Date };
type Stats = { totalBooks: number; byPublicationStatus: Record<string, number>; totalGrants: number; totalFiles: number; totalBytes: number };
const statuses = ["draft", "pending_review", "published", "unpublished", "archived"] as const;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function LibraryManagement({ canCreate, books, stats, page, pageSize, total, filters }: { canCreate: boolean; books: LibraryRow[]; stats: Stats; page: number; pageSize: number; total: number; filters: { query: string; status: string } }) {
  const t = useTranslations("admin.library");
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const statusLabel = (status: string) => t(`statusLabels.${status}` as never);
  const updateFilters = (next: { query?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const query = next.query ?? filters.query;
    const status = next.status ?? filters.status;
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
  };
  const statCards = [
    { label: t("stats.totalBooks"), value: stats.totalBooks, icon: BookOpenIcon },
    { label: t("stats.published"), value: stats.byPublicationStatus.published ?? 0, icon: CheckCircle2Icon },
    { label: t("stats.pending"), value: stats.byPublicationStatus.pending_review ?? 0, icon: Clock3Icon },
    { label: t("stats.grants"), value: stats.totalGrants, icon: UsersIcon },
    { label: t("stats.storage"), value: formatBytes(stats.totalBytes), icon: HardDriveIcon },
  ];
  return <div className="flex flex-col gap-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ShieldAlertIcon className="size-4" />{t("eyebrow")}</div><h1 className="text-3xl font-semibold tracking-tight">{t("sectionTitle")}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{t("sectionDescription")}</p></div>{canCreate && <Button size="lg" render={<Link href={ROUTES.adminLibraryNew} />}><PlusIcon data-icon="inline-start" />{t("newBook")}</Button>}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{statCards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-5" aria-hidden="true" /></div></CardContent></Card>)}</div>
    <Card><CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>{t("catalogTitle")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{t("catalogDescription")}</p></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><FilterIcon className="size-4" />{t("resultsCount", { count: total })}</div></CardHeader><CardContent className="p-0"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row"><div className="relative flex-1"><SearchIcon className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input className="ps-9" defaultValue={filters.query} placeholder={t("searchPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) updateFilters({ query: event.currentTarget.value, page: 1 }); }} aria-label={t("searchPlaceholder")} /></div><select className="h-9 rounded-lg border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilters({ status: event.target.value, page: 1 })} aria-label={t("statusFilter")}><option value="">{t("allStatuses")}</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>{books.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><BookOpenIcon className="mb-3 size-10 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{t("emptyTitle")}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>{canCreate && <Button className="mt-4" variant="outline" render={<Link href={ROUTES.adminLibraryNew} />}>{t("createFirst")}</Button>}</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-start"><tr><th className="p-4 font-medium">{t("bookTitle")}</th><th className="p-4 font-medium">{t("status")}</th><th className="p-4 font-medium">{t("reviewStatus")}</th><th className="p-4 font-medium">{t("updated")}</th></tr></thead><tbody>{books.map((book) => <tr key={book.id} className="border-t transition-colors hover:bg-muted/30"><td className="p-4"><Link className="font-medium hover:text-primary hover:underline" href={`${ROUTES.adminLibrary}/${book.id}`}>{book.originalTitle}</Link><div className="mt-1 text-xs text-muted-foreground">{book.slug}</div></td><td className="p-4"><Badge variant={book.publicationStatus === "published" ? "default" : "secondary"}>{statusLabel(book.publicationStatus)}</Badge></td><td className="p-4"><Badge variant={book.reviewStatus === "verified" ? "outline" : "secondary"}>{book.reviewStatus === "verified" ? t("verified") : t("needsReview")}</Badge></td><td className="p-4 text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(book.updatedAt))}</td></tr>)}</tbody></table></div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground"><span>{t("pageInfo", { page, totalPages })}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateFilters({ page: page - 1 })}>{<ArrowLeftIcon data-icon="inline-start" />}{t("previous")}</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => updateFilters({ page: page + 1 })}>{t("next")}<ArrowRightIcon data-icon="inline-end" /></Button></div></div></CardContent></Card>
  </div>;
}
