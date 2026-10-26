import { requirePermission, getRolePermissionKeys } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { LibraryManagement } from "./_components/library-management";

export default async function AdminLibraryPage() {
  const admin = await requirePermission(Permissions.libraryList);
  const permissionKeys = await getRolePermissionKeys(admin.roleId);
  return <LibraryManagement canCreate={permissionKeys.has(Permissions.libraryCreate)} />;
}
