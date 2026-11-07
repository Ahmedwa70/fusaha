import { getRolePermissionKeys, requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { getLibraryStatsSnapshot, listLibraryBookRows } from "@/lib/library/admin-queries";
import { LibraryManagement } from "./_components/library-management";

const pageSize = 10;

export default async function AdminLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requirePermission(Permissions.libraryList);
  const permissionKeys = await getRolePermissionKeys(admin.roleId);
  const params = await searchParams;
  const query = typeof params.query === "string" ? params.query : undefined;
  const publicationStatus = typeof params.status === "string" ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const [{ books, total }, stats] = await Promise.all([
    listLibraryBookRows({ query, publicationStatus }, page, pageSize),
    getLibraryStatsSnapshot(),
  ]);

  return (
    <LibraryManagement
      canCreate={permissionKeys.has(Permissions.libraryCreate)}
      books={books}
      stats={stats}
      page={page}
      pageSize={pageSize}
      total={total}
      filters={{ query: query ?? "", status: publicationStatus ?? "" }}
    />
  );
}
