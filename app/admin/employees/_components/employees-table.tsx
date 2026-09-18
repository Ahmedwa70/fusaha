"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DashboardFilterSelect } from "@/components/dashboard/filter-select";
import { DataTable } from "@/components/shared/data-table/data-table";
import {
  createTextColumn,
  createStatusColumn,
  createDateColumn,
  createCrudActionsColumn,
} from "@/components/shared/data-table/base-columns";
import type { EmployeeListItem, AssignableRole } from "@/lib/admin/queries/employee";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { EmployeeViewDialog } from "./employee-view-dialog";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { useEmployeeTable } from "../_hooks/use-employee-table";

export function EmployeesTable({
  employees,
  assignableRoles,
}: {
  employees: EmployeeListItem[];
  assignableRoles: AssignableRole[];
}) {
  const t = useTranslations("admin.employees");
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
  } = useEmployeeTable();

  const filteredEmployees = useMemo(() => {
    if (statusFilter === "all") return employees;
    return employees.filter((employee) => (statusFilter === "active" ? employee.active : !employee.active));
  }, [employees, statusFilter]);

  const columns = useMemo(
    () => [
      createTextColumn<EmployeeListItem>({ field: "name", header: t("columnName"), className: "font-medium" }),
      createTextColumn<EmployeeListItem>({ field: "email", header: t("columnEmail") }),
      createTextColumn<EmployeeListItem>({ field: "roleTitle", header: t("columnRole") }),
      createStatusColumn<EmployeeListItem>({ field: "active", header: t("columnStatus") }),
      createDateColumn<EmployeeListItem>({ field: "createdAt", header: t("columnJoinedAt") }),
      createCrudActionsColumn<EmployeeListItem>({
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
        data={filteredEmployees}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        toolbarActions={
          <div className="flex items-center gap-2">
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
              {t("addEmployee")}
            </Button>
          </div>
        }
      />

      <EmployeeFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} assignableRoles={assignableRoles} />

      {rowToEdit && (
        <EmployeeFormDialog
          mode="edit"
          employee={rowToEdit}
          assignableRoles={assignableRoles}
          open={!!rowToEdit}
          onOpenChange={(open) => !open && closeEditDialog()}
        />
      )}

      <EmployeeViewDialog
        employee={rowToShow}
        onOpenChange={(open) => !open && closeShowDialog()}
        onEdit={(employee) => {
          closeShowDialog();
          setRowToEdit(employee);
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
