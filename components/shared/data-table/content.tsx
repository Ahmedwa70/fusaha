"use client";

import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DataTableContent<TData>({
  table,
  emptyMessage,
  emptyDescription,
}: {
  table: ReactTable<TData>;
  emptyMessage?: string;
  emptyDescription?: string;
}) {
  const t = useTranslations("common.dataTable");
  const rows = table.getRowModel().rows;
  const colSpan = table.getAllColumns().length;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>

      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center">
              <p className="font-medium text-foreground">{emptyMessage ?? t("noResultsFound")}</p>
              <p className="text-sm text-muted-foreground">{emptyDescription ?? t("tryAdjustingFilters")}</p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
