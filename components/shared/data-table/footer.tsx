"use client";

import type { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function getVisiblePages(pageIndex: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
  if (pageIndex <= 3) return [0, 1, 2, 3, 4, "ellipsis", pageCount - 1];
  if (pageIndex >= pageCount - 4) {
    return [0, "ellipsis", pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1];
  }
  return [0, "ellipsis", pageIndex - 1, pageIndex, pageIndex + 1, "ellipsis", pageCount - 1];
}

export function DataTableFooter<TData>({ table }: { table: Table<TData> }) {
  const t = useTranslations("common.dataTable");
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  if (totalRows === 0) return null;

  const visiblePages = getVisiblePages(pageIndex, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <p className="text-xs">
        {t("showing")} <span className="font-semibold text-foreground">{from}</span>
        {" – "}
        <span className="font-semibold text-foreground">{to}</span> {t("of")}{" "}
        <span className="font-semibold text-foreground">{totalRows}</span> {t("results")}
      </p>

      <div className="flex items-center gap-2">
        <Label htmlFor="rows-per-page" className="text-xs font-normal whitespace-nowrap">
          {t("rowsPerPage")}
        </Label>
        <Select value={`${pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
          <SelectTrigger id="rows-per-page" className="h-8 w-18 text-xs">
            <SelectValue>{(value: string) => value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Pagination className="mx-0 w-auto">
        <PaginationContent className="gap-0 overflow-hidden rounded-lg border border-border">
          <PaginationItem className="border-e border-border">
            <PaginationLink
              aria-label={t("previous")}
              size="default"
              className="gap-1 rounded-none px-3 text-xs disabled:pointer-events-none disabled:opacity-30"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeftIcon className="size-4 rtl:rotate-180" />
              <span className="hidden sm:block">{t("previous")}</span>
            </PaginationLink>
          </PaginationItem>

          {visiblePages.map((page, idx) => (
            <PaginationItem key={idx} className="border-e border-border last:border-e-0">
              {page === "ellipsis" ? (
                <PaginationEllipsis className="px-3 text-xs" />
              ) : (
                <PaginationLink
                  size="default"
                  className="rounded-none px-4 text-xs"
                  onClick={() => table.setPageIndex(page)}
                  isActive={pageIndex === page}
                >
                  {page + 1}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationLink
              aria-label={t("next")}
              size="default"
              className="gap-1 rounded-none px-3 text-xs disabled:pointer-events-none disabled:opacity-30"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <span className="hidden sm:block">{t("next")}</span>
              <ChevronRightIcon className="size-4 rtl:rotate-180" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
