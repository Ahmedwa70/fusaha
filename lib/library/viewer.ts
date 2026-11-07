import { getCurrentUser, getRolePermissionKeys } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { getBookFileBySlug, hasDownloadGrant } from "./book-files";
import { canReadLibraryBook, canDownloadLibraryBook, type LibraryViewer, type AccessDecision } from "./access-policy";

// Shared viewer + access resolution for the reader page and the stream /
// download API routes, so all three enforce exactly the same policy.

export async function getLibraryViewer(): Promise<LibraryViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const keys = await getRolePermissionKeys(user.roleId);
  return {
    userId: user.id,
    canManageLibrary: keys.has(Permissions.libraryUpdate) || keys.has(Permissions.libraryPublish),
  };
}

export type ResolvedLibraryAccess = {
  viewer: LibraryViewer | null;
  bundle: Awaited<ReturnType<typeof getBookFileBySlug>>;
  read: AccessDecision;
  download: AccessDecision;
};

export async function resolveLibraryBookAccess(slug: string): Promise<ResolvedLibraryAccess> {
  const [viewer, bundle] = await Promise.all([getLibraryViewer(), getBookFileBySlug(slug)]);
  const facts = {
    hasFile: !!bundle,
    isPublished: bundle
      ? bundle.book.publicationStatus === "published" && bundle.book.reviewStatus === "verified"
      : false,
    accessStatus: bundle?.book.accessStatus ?? "unknown",
    hasGrant: viewer && bundle ? await hasDownloadGrant(bundle.book.id, viewer.userId) : false,
  };
  return {
    viewer,
    bundle,
    read: canReadLibraryBook(viewer, facts),
    download: canDownloadLibraryBook(viewer, facts),
  };
}
