// Mutable stub for @/lib/auth/dal — controls whether the permission check
// passes or rejects, mimicking requirePermission's redirect-by-throw.
export const dalState = {
  deny: false,
  user: { id: "a1", roleId: "r1" },
};

export async function requirePermission() {
  if (dalState.deny) throw new Error("unauthorized");
  return dalState.user;
}

export async function requireAdmin() {
  return requirePermission();
}
