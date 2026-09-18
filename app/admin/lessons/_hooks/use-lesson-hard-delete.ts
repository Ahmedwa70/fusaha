import { useState, useTransition } from "react";
import { hardDeleteLesson } from "@/actions/lessons";
import type { AdminLessonListItem } from "@/lib/admin/queries/lesson";

export function useLessonHardDelete() {
  const [isPending, startTransition] = useTransition();
  const [rowToDelete, setRowToDelete] = useState<AdminLessonListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setRowToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!rowToDelete) return;
    startTransition(async () => {
      const result = await hardDeleteLesson(rowToDelete.id);
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
  };
}
