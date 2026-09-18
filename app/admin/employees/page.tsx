import { getTranslations } from "next-intl/server";
import { getEmployees, getAssignableRoles } from "@/lib/admin/queries/employee";
import { EmployeesTable } from "@/app/admin/employees/_components/employees-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminEmployeesPage() {
  await requirePermission(Permissions.employeesList);
  const t = await getTranslations("admin.employees");
  const [employees, assignableRoles] = await Promise.all([
    getEmployees(),
    getAssignableRoles(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <EmployeesTable employees={employees} assignableRoles={assignableRoles} />
    </div>
  );
}
