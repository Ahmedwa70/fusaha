import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { roles, permissions, rolePermissions } from "@/database/schema";
import type { PermissionKey } from "@/constants/permissions";

export type RoleListItem = {
  id: string;
  name: string;
  title: string;
  isSystem: boolean;
  permissionKeys: PermissionKey[];
};

export async function getRoles(): Promise<RoleListItem[]> {
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, title: roles.title, isSystem: roles.isSystem })
    .from(roles)
    .where(eq(roles.isSystem, false))
    .orderBy(roles.title);

  if (roleRows.length === 0) return [];

  const grantRows = await db
    .select({ roleId: rolePermissions.roleId, key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

  const keysByRole = new Map<string, PermissionKey[]>();
  for (const grant of grantRows) {
    const keys = keysByRole.get(grant.roleId) ?? [];
    keys.push(grant.key as PermissionKey);
    keysByRole.set(grant.roleId, keys);
  }

  return roleRows.map((role) => ({
    ...role,
    permissionKeys: keysByRole.get(role.id) ?? [],
  }));
}

export async function getAllPermissions(): Promise<PermissionKey[]> {
  const rows = await db.select({ key: permissions.key }).from(permissions).orderBy(permissions.key);
  return rows.map((r) => r.key as PermissionKey);
}
