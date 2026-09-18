"use client";

import { useMemo } from "react";
import { useRouter } from "nextjs-toploader/app";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVerticalIcon, EyeIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table/data-table";
import { createDateColumn } from "@/components/shared/data-table/base-columns";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import type { AdminLessonListItem } from "@/lib/admin/queries/lesson";
import { ROUTES } from "@/constants/routes";
import { LessonStatusBadge } from "./lesson-status-badge";
import { useLessonRestore } from "../_hooks/use-lesson-restore";
import { useLessonHardDelete } from "../_hooks/use-lesson-hard-delete";

function LessonRowActions({
  onView,
  onRestore,
  showRestore,
  onDelete,
}: {
  onView: () => void;
  onRestore: () => void;
  showRestore: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations("common.actions");
  const tLessons = useTranslations("admin.lessons");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <span className="sr-only">{t("menu")}</span>
            <MoreVerticalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <EyeIcon data-icon="inline-start" />
          {t("view")}
        </DropdownMenuItem>
        {showRestore && (
          <DropdownMenuItem onClick={onRestore}>
            <RotateCcwIcon data-icon="inline-start" />
            {tLessons("restore")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          {tLessons("deletePermanently")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LessonsTable({ lessons }: { lessons: AdminLessonListItem[] }) {
  const t = useTranslations("admin.lessons");
  const router = useRouter();

  const { rowToRestore, setRowToRestore, closeRestoreDialog, handleConfirmRestore, restoreError, isRestoring } =
    useLessonRestore();
  const { rowToDelete, setRowToDelete, closeDeleteDialog, handleConfirmDelete, deleteError, isDeleting } =
    useLessonHardDelete();

  const columns = useMemo<ColumnDef<AdminLessonListItem, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columnName"),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "owner",
        accessorFn: (row) => `${row.ownerName} ${row.ownerEmail}`,
        header: t("columnOwner"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.ownerName}</span>
            <span className="text-sm text-muted-foreground">{row.original.ownerEmail}</span>
          </div>
        ),
      },
      {
        accessorKey: "level",
        header: t("columnLevel"),
        cell: ({ row }) =>
          row.original.level === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span>{row.original.level}</span>
          ),
      },
      {
        accessorKey: "folderName",
        header: t("columnFolder"),
        cell: ({ row }) => row.original.folderName ?? <span className="text-muted-foreground">—</span>,
      },
      {
        id: "status",
        accessorFn: (row) => (row.deletedAt ? "deleted" : row.state),
        header: t("columnStatus"),
        cell: ({ row }) => (
          <LessonStatusBadge state={row.original.state} deletedAt={row.original.deletedAt} />
        ),
      },
      createDateColumn<AdminLessonListItem>({ field: "createdAt", header: t("columnCreatedAt") }),
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
            <LessonRowActions
              onView={() => router.push(`${ROUTES.adminLessons}/${row.original.id}`)}
              onRestore={() => setRowToRestore(row.original)}
              showRestore={!!row.original.deletedAt}
              onDelete={() => setRowToDelete(row.original)}
            />
          </div>
        ),
      },
    ],
    [t, router, setRowToRestore, setRowToDelete]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={lessons}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      <DeleteConfirmationDialog
        open={!!rowToRestore}
        onOpenChange={(open) => !open && closeRestoreDialog()}
        title={t("restoreDialogTitle")}
        description={rowToRestore ? t("restoreDialogDescription", { name: rowToRestore.name }) : ""}
        cancelLabel={t("cancel")}
        confirmLabel={t("restore")}
        confirmingLabel={t("restoring")}
        isLoading={isRestoring}
        onConfirm={handleConfirmRestore}
      />
      {restoreError && <p className="text-sm text-destructive">{restoreError}</p>}

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={rowToDelete ? t("deleteDialogDescription", { name: rowToDelete.name }) : ""}
        cancelLabel={t("cancel")}
        confirmLabel={t("deletePermanently")}
        confirmingLabel={t("deleting")}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
    </>
  );
}
