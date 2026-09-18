import { useState, useTransition } from "react";
import { deleteEmployee } from "@/actions/employees";
import type { EmployeeListItem } from "@/lib/admin/queries/employee";

export function useEmployeeTable() {
  const [isPending, startTransition] = useTransition();
  const [rowToDelete, setRowToDelete] = useState<EmployeeListItem | null>(null);
  const [rowToEdit, setRowToEdit] = useState<EmployeeListItem | null>(null);
  const [rowToShow, setRowToShow] = useState<EmployeeListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete) return;
    startTransition(async () => {
      const result = await deleteEmployee(rowToDelete.id);
      if ("error" in result) {
        setDeleteError(result.error);
        return;
      }
      closeDeleteDialog();
    });
  };

  return {
    rowToDelete,
    setRowToDelete,
    closeDeleteDialog,
    handleConfirmDelete,
    deleteError,
    isDeleting: isPending,
    rowToEdit,
    setRowToEdit,
    closeEditDialog: () => setRowToEdit(null),
    rowToShow,
    setRowToShow,
    closeShowDialog: () => setRowToShow(null),
  };
}
