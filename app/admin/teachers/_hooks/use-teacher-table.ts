import { useState, useTransition } from "react";
import { deleteTeacher } from "@/actions/teachers";
import type { TeacherListItem } from "@/lib/admin/queries/teacher";

export function useTeacherTable() {
  const [isPending, startTransition] = useTransition();
  const [rowToDelete, setRowToDelete] = useState<TeacherListItem | null>(null);
  const [rowToEdit, setRowToEdit] = useState<TeacherListItem | null>(null);
  const [rowToShow, setRowToShow] = useState<TeacherListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete) return;
    startTransition(async () => {
      const result = await deleteTeacher(rowToDelete.id);
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
