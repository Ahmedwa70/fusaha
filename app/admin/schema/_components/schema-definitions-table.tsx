"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "nextjs-toploader/app";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table/data-table";
import { createStatusColumn, createDateColumn } from "@/components/shared/data-table/base-columns";
import { ROUTES } from "@/constants/routes";
import type { schemaDefinitions } from "@/database/schema";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import type { Locale } from "@/i18n/config";
import { SchemaDefinitionFormDialog } from "@/app/admin/schema/_components/schema-definition-form-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { deleteSchemaDefinition } from "@/actions/schema-definitions";

type SchemaDefinitionListItem = typeof schemaDefinitions.$inferSelect;

export function SchemaDefinitionsTable({
  schemaDefinitions,
  templates,
}: {
  schemaDefinitions: SchemaDefinitionListItem[];
  templates: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.schema");
  const tActions = useTranslations("common.actions");
  const tErrors = useTranslations("admin.schema.errors");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const [newVersionForRow, setNewVersionForRow] = useState<SchemaDefinitionListItem | null>(null);
  const [rowToDelete, setRowToDelete] = useState<SchemaDefinitionListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete || isDeleting) return;
    setIsDeleting(true);
    startDeleteTransition(async () => {
      try {
        const result = await deleteSchemaDefinition(rowToDelete.id);
        if ("error" in result) {
          setDeleteError(result.error);
          return;
        }
        closeDeleteDialog();
      } catch {
        setDeleteError(tErrors("unexpected"));
      } finally {
        setIsDeleting(false);
      }
    });
  };

  const columns = useMemo<ColumnDef<SchemaDefinitionListItem, unknown>[]>(
    () => [
      {
        accessorKey: "level",
        header: t("columnLevel"),
        cell: ({ row }) => <span className="font-medium">{resolveLevelLabel(row.original.level, locale)}</span>,
      },
      { accessorKey: "version", header: t("columnVersion") },
      createStatusColumn<SchemaDefinitionListItem>({ field: "active", header: t("columnActive") }),
      createDateColumn<SchemaDefinitionListItem>({ field: "createdAt", header: t("columnCreatedAt") }),
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
            <Button variant="ghost" size="icon-sm" onClick={() => setNewVersionForRow(row.original)}>
              <span className="sr-only">{t("actionNewVersionForLevel")}</span>
              <PlusIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push(`${ROUTES.adminSchema}/${row.original.id}`)}
            >
              <span className="sr-only">{tActions("view")}</span>
              <EyeIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setRowToDelete(row.original)}>
              <span className="sr-only">{tActions("delete")}</span>
              <Trash2Icon className="text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [t, tActions, router, locale]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={schemaDefinitions}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      {newVersionForRow && (
        <SchemaDefinitionFormDialog
          open={!!newVersionForRow}
          onOpenChange={(open) => !open && setNewVersionForRow(null)}
          initialLevel={newVersionForRow.level as Partial<Record<Locale, string>>}
          initialLevelKey={newVersionForRow.levelKey}
          initialContent={newVersionForRow.content}
          templates={templates}
        />
      )}

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={
          deleteError ??
          (rowToDelete
            ? t("deleteDialogDescription", {
                level: resolveLevelLabel(rowToDelete.level, locale),
                version: rowToDelete.version,
              })
            : "")
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
