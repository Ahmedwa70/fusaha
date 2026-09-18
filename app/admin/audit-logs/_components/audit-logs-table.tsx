"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table/data-table";
import { dateFormatter, timeFormatter } from "@/lib/dashboard/format";
import { PERMISSION_TRANSLATION_KEYS } from "@/constants/permissions";
import type { AuditLogListItem } from "@/lib/admin/queries/audit-log";
import { AuditLogViewDialog } from "./audit-log-view-dialog";

export function AuditLogsTable({ auditLogs }: { auditLogs: AuditLogListItem[] }) {
  const t = useTranslations("admin.auditLogs");
  const tPermissions = useTranslations("admin.permissions");
  const tActions = useTranslations("common.actions");
  const [rowToShow, setRowToShow] = useState<AuditLogListItem | null>(null);

  const columns = useMemo<ColumnDef<AuditLogListItem, unknown>[]>(
    () => [
      {
        accessorKey: "action",
        header: t("columnAction"),
        cell: ({ row }) => {
          const translationKey = PERMISSION_TRANSLATION_KEYS[row.original.action];
          return (
            <span className="font-medium">
              {translationKey ? tPermissions(translationKey) : row.original.action}
            </span>
          );
        },
      },
      {
        accessorKey: "resourceType",
        header: t("columnResource"),
      },
      {
        id: "actor",
        accessorFn: (row) => `${row.actorName ?? ""} ${row.actorEmail ?? ""}`,
        header: t("columnActor"),
        cell: ({ row }) =>
          row.original.userId === null ? (
            <span className="text-muted-foreground">{t("systemActor")}</span>
          ) : (
            <div className="flex flex-col">
              <span>{row.original.actorName}</span>
              <span className="text-sm text-muted-foreground">{row.original.actorEmail}</span>
            </div>
          ),
      },
      {
        id: "createdDate",
        accessorFn: (row) => row.createdAt,
        header: t("columnCreatedAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{dateFormatter.format(row.original.createdAt)}</span>
        ),
      },
      {
        id: "createdTime",
        accessorFn: (row) => row.createdAt,
        header: t("columnTime"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{timeFormatter.format(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        size: 60,
        minSize: 60,
        maxSize: 60,
        enableSorting: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon-sm" onClick={() => setRowToShow(row.original)}>
              <span className="sr-only">{tActions("view")}</span>
              <EyeIcon />
            </Button>
          </div>
        ),
      },
    ],
    [t, tPermissions, tActions]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={auditLogs}
        showSearch={false}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      <AuditLogViewDialog auditLog={rowToShow} onOpenChange={(open) => !open && setRowToShow(null)} />
    </>
  );
}
