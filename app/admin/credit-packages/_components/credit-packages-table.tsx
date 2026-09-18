"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DashboardFilterSelect } from "@/components/dashboard/filter-select";
import { DataTable } from "@/components/shared/data-table/data-table";
import {
  createTextColumn,
  createStatusColumn,
  createDateColumn,
  createCrudActionsColumn,
} from "@/components/shared/data-table/base-columns";
import { formatPrice } from "@/lib/dashboard/format";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Locale } from "@/i18n/config";
import type { CreditPackageListItem } from "@/lib/admin/queries/credit-package";
import { CreditPackageFormDialog } from "./credit-package-form-dialog";
import { CreditPackageViewDialog } from "./credit-package-view-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useCreditPackageTable } from "../_hooks/use-credit-package-table";

export function CreditPackagesTable({ creditPackages }: { creditPackages: CreditPackageListItem[] }) {
  const t = useTranslations("admin.creditPackages");
  const locale = useLocale() as Locale;
  const [statusFilter, setStatusFilter] = useState("all");
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
  } = useCreditPackageTable();

  const filteredCreditPackages = useMemo(() => {
    if (statusFilter === "all") return creditPackages;
    return creditPackages.filter((creditPackage) =>
      statusFilter === "active" ? creditPackage.active : !creditPackage.active
    );
  }, [creditPackages, statusFilter]);

  const columns = useMemo<ColumnDef<CreditPackageListItem, unknown>[]>(
    () => [
      // name/badge are localized jsonb (see lib/localized-text.ts) — the
      // admin table shows them in the admin's own UI language.
      {
        id: "name",
        accessorFn: (row: CreditPackageListItem) => resolveLocalizedText(row.name, locale),
        header: t("columnName"),
        cell: ({ row }) => <span className="font-medium">{resolveLocalizedText(row.original.name, locale)}</span>,
      },
      createTextColumn<CreditPackageListItem>({ field: "creditsAmount", header: t("columnCreditsAmount") }),
      {
        id: "price",
        accessorKey: "price",
        header: t("columnPrice"),
        cell: ({ row }) => formatPrice(row.original.price, row.original.currency),
      },
      {
        id: "badgeLabel",
        accessorFn: (row: CreditPackageListItem) => resolveLocalizedText(row.badgeLabel, locale),
        header: t("columnBadge"),
        cell: ({ row }) => resolveLocalizedText(row.original.badgeLabel, locale) || "—",
      },
      createStatusColumn<CreditPackageListItem>({ field: "active", header: t("columnStatus") }),
      createDateColumn<CreditPackageListItem>({ field: "createdAt", header: t("columnCreatedAt") }),
      createCrudActionsColumn<CreditPackageListItem>({
        onShow: setRowToShow,
        onEdit: setRowToEdit,
        onDelete: setRowToDelete,
      }),
    ],
    [t, locale, setRowToShow, setRowToEdit, setRowToDelete]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredCreditPackages}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        toolbarActions={
          <>
            <DashboardFilterSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "all", label: t("filterAllStatuses") },
                { value: "active", label: t("statusActive") },
                { value: "inactive", label: t("statusInactive") },
              ]}
            />
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <PlusIcon data-icon="inline-start" />
              {t("addCreditPackage")}
            </Button>
          </>
        }
      />

      <CreditPackageFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

      {rowToEdit && (
        <CreditPackageFormDialog
          mode="edit"
          creditPackage={rowToEdit}
          open={!!rowToEdit}
          onOpenChange={(open) => !open && closeEditDialog()}
        />
      )}

      <CreditPackageViewDialog
        creditPackage={rowToShow}
        onOpenChange={(open) => !open && closeShowDialog()}
        onEdit={(creditPackage) => {
          closeShowDialog();
          setRowToEdit(creditPackage);
        }}
      />

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={rowToDelete ? t("deleteDialogDescription", { name: resolveLocalizedText(rowToDelete.name, locale) }) : ""}
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
