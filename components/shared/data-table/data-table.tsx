"use client";

import * as React from "react";
import {
  type ColumnDef,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { DataTableToolbar } from "./toolbar";
import { DataTableContent } from "./content";
import { DataTableFooter } from "./footer";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  toolbarActions?: React.ReactNode;
  showColumnVisibility?: boolean;
  defaultPageSize?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  initialColumnVisibility?: VisibilityState;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  showSearch = true,
  toolbarActions,
  showColumnVisibility = true,
  defaultPageSize = 10,
  emptyMessage,
  emptyDescription,
  initialColumnVisibility = {},
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: defaultPageSize });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnVisibility, pagination },
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <DataTableToolbar
        table={table}
        searchTerm={globalFilter}
        onSearchChange={(value) => table.setGlobalFilter(value)}
        searchPlaceholder={searchPlaceholder}
        showSearch={showSearch}
        toolbarActions={toolbarActions}
        showColumnVisibility={showColumnVisibility}
      />

      <DataTableContent table={table} emptyMessage={emptyMessage} emptyDescription={emptyDescription} />

      <DataTableFooter table={table} />
    </Card>
  );
}
