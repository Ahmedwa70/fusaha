// Groups permission keys by the resource prefix before the first "." (e.g.
// "users.list" -> group "users") — mirrors Clinexa's getGroupedPermissions.
export function groupPermissionKeys(keys: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of keys) {
    const [resource] = key.split(".");
    (groups[resource] ??= []).push(key);
  }
  return groups;
}
