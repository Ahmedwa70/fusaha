"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardFilterSelect } from "@/components/dashboard/filter-select";
import { DataTable } from "@/components/shared/data-table/data-table";
import {
  createTextColumn,
  createStatusColumn,
  createDateColumn,
  createCrudActionsColumn,
} from "@/components/shared/data-table/base-columns";
import type { TeacherListItem } from "@/lib/admin/queries/teacher";
import { TeacherFormDialog } from "./teacher-form-dialog";
import { TeacherViewDialog } from "./teacher-view-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useTeacherTable } from "../_hooks/use-teacher-table";

export function TeachersTable({ teachers }: { teachers: TeacherListItem[] }) {
  const t = useTranslations("admin.teachers");
  const [statusFilter, setStatusFilter] = useState("all");

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
  } = useTeacherTable();

  const filteredTeachers = useMemo(() => {
    if (statusFilter === "all") return teachers;
    return teachers.filter((teacher) => (statusFilter === "active" ? teacher.active : !teacher.active));
  }, [teachers, statusFilter]);

  const columns = useMemo(
    () => [
      createTextColumn<TeacherListItem>({ field: "name", header: t("columnName"), className: "font-medium" }),
      createTextColumn<TeacherListItem>({ field: "email", header: t("columnEmail") }),
      createTextColumn<TeacherListItem>({ field: "creditsBalance", header: t("columnCredits") }),
      createStatusColumn<TeacherListItem>({ field: "active", header: t("columnStatus") }),
      createDateColumn<TeacherListItem>({ field: "createdAt", header: t("columnJoinedAt") }),
      createCrudActionsColumn<TeacherListItem>({
        onShow: setRowToShow,
        onEdit: setRowToEdit,
        onDelete: setRowToDelete,
      }),
    ],
    [t, setRowToShow, setRowToEdit, setRowToDelete]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredTeachers}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        toolbarActions={
          <DashboardFilterSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: "all", label: t("filterAllStatuses") },
              { value: "active", label: t("statusActive") },
              { value: "inactive", label: t("statusInactive") },
            ]}
          />
        }
      />

      {rowToEdit && (
        <TeacherFormDialog
          teacher={rowToEdit}
          open={!!rowToEdit}
          onOpenChange={(open) => !open && closeEditDialog()}
        />
      )}

      <TeacherViewDialog
        teacher={rowToShow}
        onOpenChange={(open) => !open && closeShowDialog()}
        onEdit={(teacher) => {
          closeShowDialog();
          setRowToEdit(teacher);
        }}
      />

      <DeleteConfirmationDialog
        open={!!rowToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={rowToDelete ? t("deleteDialogDescription", { email: rowToDelete.email }) : ""}
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
