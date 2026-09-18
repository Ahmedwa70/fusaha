import { getTranslations } from "next-intl/server";
import { getTeachers } from "@/lib/admin/queries/teacher";
import { TeachersTable } from "@/app/admin/teachers/_components/teachers-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminTeachersPage() {
  await requirePermission(Permissions.usersList);
  const t = await getTranslations("admin.teachers");
  const teachers = await getTeachers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <TeachersTable teachers={teachers} />
    </div>
  );
}
