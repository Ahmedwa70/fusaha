// Mutable stub for ./book-files as imported by viewer.ts — controls the
// bundle lookup and the per-(book, user) grant lookup.
export const bookFilesState = {
  bundle: null,
  grant: false,
};

export async function getBookFileBySlug() {
  return bookFilesState.bundle;
}

export async function hasDownloadGrant() {
  return bookFilesState.grant;
}
