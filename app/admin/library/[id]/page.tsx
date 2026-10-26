import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { LibraryBookForm } from "../_components/library-book-form";

export default async function EditLibraryBookPage() {
  await requirePermission(Permissions.libraryUpdate);
  return <LibraryBookForm mode="edit" />;
}
