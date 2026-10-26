import { desc } from "drizzle-orm";
import { requirePermission, getRolePermissionKeys } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { db } from "@/lib/db";
import { libraryBooks } from "@/database/schema";
import { LibraryManagement } from "./_components/library-management";

export default async function AdminLibraryPage() {
  const admin = await requirePermission(Permissions.libraryList);
  const permissionKeys = await getRolePermissionKeys(admin.roleId);
  const books = await db.select({ id: libraryBooks.id, slug: libraryBooks.slug, originalTitle: libraryBooks.originalTitle, publicationStatus: libraryBooks.publicationStatus, reviewStatus: libraryBooks.reviewStatus, updatedAt: libraryBooks.updatedAt }).from(libraryBooks).orderBy(desc(libraryBooks.updatedAt));
  return <LibraryManagement canCreate={permissionKeys.has(Permissions.libraryCreate)} books={books} />;
}
