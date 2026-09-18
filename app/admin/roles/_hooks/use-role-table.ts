import { useState, useTransition } from "react";
import { deleteRole } from "@/actions/roles";
import type { RoleListItem } from "@/lib/admin/queries/role";

export function useRoleTable() {
  const [isPending, startTransition] = useTransition();
  const [rowToDelete, setRowToDelete] = useState<RoleListItem | null>(null);
  const [rowToEdit, setRowToEdit] = useState<RoleListItem | null>(null);
  const [rowToShow, setRowToShow] = useState<RoleListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete) return;
    startTransition(async () => {
      const result = await deleteRole(rowToDelete.id);
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
