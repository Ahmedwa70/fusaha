import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteTemplate } from "@/actions/templates";
import type { templates } from "@/database/schema";

type TemplateRow = typeof templates.$inferSelect;

export function useTemplateTable() {
  const tErrors = useTranslations("admin.templates.errors");
  const [, startDeleteTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowToEdit, setRowToEdit] = useState<TemplateRow | null>(null);
  const [rowToShow, setRowToShow] = useState<TemplateRow | null>(null);
  const [rowToDelete, setRowToDelete] = useState<TemplateRow | null>(null);
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
        const result = await deleteTemplate(rowToDelete.id);
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
    rowToEdit,
    setRowToEdit,
    closeEditDialog: () => setRowToEdit(null),
    rowToShow,
    setRowToShow,
    closeShowDialog: () => setRowToShow(null),
    rowToDelete,
    setRowToDelete,
    closeDeleteDialog,
    handleConfirmDelete,
    deleteError,
    isDeleting,
  };
}
