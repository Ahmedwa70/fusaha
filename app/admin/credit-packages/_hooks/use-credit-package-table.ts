import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteCreditPackage } from "@/actions/credit-packages";
import type { CreditPackageListItem } from "@/lib/admin/queries/credit-package";

export function useCreditPackageTable() {
  const tErrors = useTranslations("admin.creditPackages.errors");
  const [, startDeleteTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<CreditPackageListItem | null>(null);
  const [rowToEdit, setRowToEdit] = useState<CreditPackageListItem | null>(null);
  const [rowToShow, setRowToShow] = useState<CreditPackageListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete || isDeleting) return;
    setIsDeleting(true);
    startDeleteTransition(async () => {
      try {
        const result = await deleteCreditPackage(rowToDelete.id);
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

  return {
    rowToDelete,
    setRowToDelete,
    closeDeleteDialog,
    handleConfirmDelete,
    deleteError,
    isDeleting,
    rowToEdit,
    setRowToEdit,
    closeEditDialog: () => setRowToEdit(null),
    rowToShow,
    setRowToShow,
    closeShowDialog: () => setRowToShow(null),
  };
}
