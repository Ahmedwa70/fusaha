// Mutable stub for @/lib/auth/dal — controls who the current viewer is.
export const dalState = {
  user: null, // { id, roleId } or null
  permissionKeys: new Set(),
};

export async function getCurrentUser() {
  return dalState.user;
}

export async function getRolePermissionKeys() {
  return dalState.permissionKeys;
}
