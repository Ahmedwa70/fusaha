// Access policy for library books — the single place that decides who may
// READ inside the platform and who may DOWNLOAD. The two permissions are
// deliberately separated:
//
//   read:     any signed-in user for free_reading books; explicit grant or
//             library management for everything else.
//   download: NEVER implied by free_reading — only an explicit download
//             grant (library_download_grants) or library management.
//
// Future paid books plug into the same shape: a completed purchase inserts
// a grant row, and purchase of a "downloadable" tier can insert a grant
// with download rights without changing this module.

export type LibraryBookAccessFacts = {
  hasFile: boolean;
  accessStatus: string;
  hasGrant: boolean;
};

export type LibraryViewer = {
  userId: string;
  canManageLibrary: boolean;
};

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "no_file" | "no_grant" | "access_status" };

const deny = (reason: Exclude<AccessDecision, { allowed: true }>["reason"]): AccessDecision => ({ allowed: false, reason });

export function canReadLibraryBook(viewer: LibraryViewer | null, facts: LibraryBookAccessFacts): AccessDecision {
  if (!viewer) return deny("unauthenticated");
  if (!facts.hasFile) return deny("no_file");
  if (viewer.canManageLibrary) return { allowed: true };
  if (facts.accessStatus === "free_reading") return { allowed: true };
  if (facts.hasGrant) return { allowed: true };
  return deny("access_status");
}

export function canDownloadLibraryBook(viewer: LibraryViewer | null, facts: LibraryBookAccessFacts): AccessDecision {
  if (!viewer) return deny("unauthenticated");
  if (!facts.hasFile) return deny("no_file");
  // free_reading intentionally grants NO download right here.
  if (viewer.canManageLibrary || facts.hasGrant) return { allowed: true };
  return deny("no_grant");
}
