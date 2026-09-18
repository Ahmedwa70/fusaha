import { useState, useTransition } from "react";
import { restoreLesson } from "@/actions/lessons";
import type { AdminLessonListItem } from "@/lib/admin/queries/lesson";

export function useLessonRestore() {
  const [isPending, startTransition] = useTransition();
  const [rowToRestore, setRowToRestore] = useState<AdminLessonListItem | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const closeRestoreDialog = () => {
    setRowToRestore(null);
    setRestoreError(null);
  };

  const handleConfirmRestore = () => {
    if (!rowToRestore) return;
    startTransition(async () => {
      const result = await restoreLesson(rowToRestore.id);
      if ("error" in result) {
        setRestoreError(result.error);
        return;
      }
      closeRestoreDialog();
    });
  };

  return {
    rowToRestore,
    setRowToRestore,
    closeRestoreDialog,
    handleConfirmRestore,
    restoreError,
    isRestoring: isPending,
  };
}
