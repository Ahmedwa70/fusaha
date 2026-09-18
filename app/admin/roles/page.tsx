import { getTranslations } from "next-intl/server";
import { getRoles, getAllPermissions } from "@/lib/admin/queries/role";
import { RolesTable } from "@/app/admin/roles/_components/roles-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminRolesPage() {
  await requirePermission(Permissions.rolesList);
  const t = await getTranslations("admin.roles");
  const [roles, allPermissions] = await Promise.all([getRoles(), getAllPermissions()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <RolesTable roles={roles} allPermissions={allPermissions} />
    </div>
  );
}
