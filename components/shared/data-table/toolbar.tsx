"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { SearchIcon, Columns3Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTableToolbar<TData>({
  table,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  showSearch = true,
  toolbarActions,
  showColumnVisibility = true,
}: {
  table: Table<TData>;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  toolbarActions?: React.ReactNode;
  showColumnVisibility?: boolean;
}) {
  const t = useTranslations("common.dataTable");
  const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      {showSearch && (
        <div className="relative min-w-56 flex-1 md:flex-none">
          <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="ps-9"
          />
        </div>
      )}

      {toolbarActions && <div className="flex items-center gap-2">{toolbarActions}</div>}

      {showColumnVisibility && hideableColumns.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="ms-auto gap-1.5 text-xs">
                <Columns3Icon className="size-3.5" />
                {t("columns")}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            {hideableColumns.map((column) => {
              const header = column.columnDef.header;
              const label = typeof header === "string" ? header : column.id;
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
