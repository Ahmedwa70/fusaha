"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVerticalIcon, EyeIcon, PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";
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
import { createTextColumn } from "@/components/shared/data-table/base-columns";
import type { RoleListItem } from "@/lib/admin/queries/role";
import { RoleFormDialog } from "./role-form-dialog";
import { RoleViewDialog } from "./role-view-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useRoleTable } from "../_hooks/use-role-table";

function RoleActions({
  onShow,
  onEdit,
  onDelete,
}: {
  onShow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("common.actions");

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
        <DropdownMenuItem onClick={onShow}>
          <EyeIcon data-icon="inline-start" />
          {t("view")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon data-icon="inline-start" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RolesTable({ roles, allPermissions }: { roles: RoleListItem[]; allPermissions: string[] }) {
  const t = useTranslations("admin.roles");
  const [createOpen, setCreateOpen] = useState(false);

  const {
    rowToDelete,
    setRowToDelete,
    closeDeleteDialog,
    handleConfirmDelete,
    deleteError,
    isDeleting,
    rowToEdit,
    setRowToEdit,
    closeEditDialog,
    rowToShow,
    setRowToShow,
    closeShowDialog,
  } = useRoleTable();

  const columns = useMemo<ColumnDef<RoleListItem, unknown>[]>(
    () => [
      createTextColumn<RoleListItem>({ field: "title", header: t("columnTitle"), className: "font-medium" }),
      createTextColumn<RoleListItem>({ field: "name", header: t("columnName") }),
      {
        id: "permissionCount",
        header: t("columnPermissions"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {t("permissionCount", { count: row.original.permissionKeys.length })}
          </span>
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
            <RoleActions
              onShow={() => setRowToShow(row.original)}
              onEdit={() => setRowToEdit(row.original)}
              onDelete={() => setRowToDelete(row.original)}
            />
          </div>
        ),
      },
    ],
    [t, setRowToShow, setRowToEdit, setRowToDelete]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={roles}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        toolbarActions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <PlusIcon data-icon="inline-start" />
            {t("addRole")}
          </Button>
        }
      />

      <RoleFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} allPermissions={allPermissions} />

      {rowToEdit && (
        <RoleFormDialog
          mode="edit"
          role={rowToEdit}
          allPermissions={allPermissions}
          open={!!rowToEdit}
          onOpenChange={(open) => !open && closeEditDialog()}
        />
      )}

      <RoleViewDialog
        role={rowToShow}
        onOpenChange={(open) => !open && closeShowDialog()}
        onEdit={(role) => {
          closeShowDialog();
          setRowToEdit(role);
        }}
      />

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={rowToDelete ? t("deleteDialogDescription", { title: rowToDelete.title }) : ""}
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        confirmingLabel={t("deleting")}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
    </>
  );
}
