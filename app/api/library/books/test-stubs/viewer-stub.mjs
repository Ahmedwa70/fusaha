// Mutable stub for @/lib/library/viewer — the test file drives the access
// decision the route under test will receive, and records calls.
export const viewerState = {
  access: null,
  calls: [],
};

export async function resolveLibraryBookAccess(slug) {
  viewerState.calls.push(slug);
  return viewerState.access;
}
