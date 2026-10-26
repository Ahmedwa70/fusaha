import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { LibraryBookForm } from "../_components/library-book-form";

export default async function NewLibraryBookPage() {
  await requirePermission(Permissions.libraryCreate);
  return <LibraryBookForm mode="create" />;
}
