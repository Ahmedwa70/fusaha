"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table/data-table";
import { createStatusColumn, createDateColumn } from "@/components/shared/data-table/base-columns";
import type { templates } from "@/database/schema";
import { TemplateFormDialog } from "./template-form-dialog";
import { TemplateViewDialog } from "./template-view-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useTemplateTable } from "../_hooks/use-template-table";

type TemplateListItem = typeof templates.$inferSelect;

export function TemplatesTable({ templates }: { templates: TemplateListItem[] }) {
  const t = useTranslations("admin.templates");
  const tActions = useTranslations("common.actions");
  const [createOpen, setCreateOpen] = useState(false);

  const {
    rowToEdit,
    setRowToEdit,
    closeEditDialog,
    rowToShow,
    setRowToShow,
    closeShowDialog,
    rowToDelete,
    setRowToDelete,
    closeDeleteDialog,
    handleConfirmDelete,
    deleteError,
    isDeleting,
  } = useTemplateTable();

  const columns = useMemo<ColumnDef<TemplateListItem, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columnName"),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      createStatusColumn<TemplateListItem>({ field: "active", header: t("columnActive") }),
      createDateColumn<TemplateListItem>({ field: "createdAt", header: t("columnCreatedAt") }),
      {
        id: "actions",
        size: 120,
        minSize: 120,
        maxSize: 120,
        enableSorting: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setRowToShow(row.original)}>
              <span className="sr-only">{tActions("view")}</span>
              <EyeIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setRowToEdit(row.original)}>
              <span className="sr-only">{tActions("edit")}</span>
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setRowToDelete(row.original)}>
              <span className="sr-only">{tActions("delete")}</span>
              <Trash2Icon className="text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [t, tActions, setRowToShow, setRowToEdit, setRowToDelete]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={templates}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        toolbarActions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <PlusIcon data-icon="inline-start" />
            {t("newTemplate")}
          </Button>
        }
      />

      <TemplateFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

      {rowToEdit && (
        <TemplateFormDialog
          mode="edit"
          template={rowToEdit}
          open={!!rowToEdit}
          onOpenChange={(open) => !open && closeEditDialog()}
        />
      )}

      <TemplateViewDialog
        template={rowToShow}
        onOpenChange={(open) => !open && closeShowDialog()}
        onEdit={(template) => {
          closeShowDialog();
          setRowToEdit(template);
        }}
      />

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={
          deleteError ?? (rowToDelete ? t("deleteDialogDescription", { name: rowToDelete.name }) : "")
        }
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        confirmingLabel={t("deleting")}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
