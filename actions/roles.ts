"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { roles, permissions, rolePermissions } from "@/database/schema";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { roleSchema, type RoleValues } from "@/validation/roles";

export type RoleActionState = { error: string } | { success: true };

async function syncRolePermissions(roleId: string, permissionKeys: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionKeys.length === 0) return;

    const matched = await tx
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));

    if (matched.length === 0) return;

    await tx.insert(rolePermissions).values(matched.map((p) => ({ roleId, permissionId: p.id })));
  });
}

export async function createRole(data: RoleValues): Promise<RoleActionState> {
  const admin = await requirePermission(Permissions.rolesCreate);

  const tValidation = await getTranslations("validation.roles");
  const tErrors = await getTranslations("admin.roles.errors");
  const parsed = roleSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, title, permissionKeys } = parsed.data;

  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
  if (existing) return { error: tErrors("nameTaken") };

  const [created] = await db.insert(roles).values({ name, title, isSystem: false }).returning({ id: roles.id });
  await syncRolePermissions(created.id, permissionKeys);

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.rolesCreate,
    resourceType: "role",
    resourceId: created.id,
    newValues: { name, title, permissionKeys },
  });

  revalidatePath("/admin/roles");
  return { success: true };
}

export async function updateRole(id: string, data: RoleValues): Promise<RoleActionState> {
  const admin = await requirePermission(Permissions.rolesUpdate);

  const tValidation = await getTranslations("validation.roles");
  const tErrors = await getTranslations("admin.roles.errors");

  const [role] = await db.select({ isSystem: roles.isSystem }).from(roles).where(eq(roles.id, id)).limit(1);
  if (!role) return { error: tErrors("notFound") };
  if (role.isSystem) return { error: tErrors("cannotEditSystem") };

  const parsed = roleSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, title, permissionKeys } = parsed.data;

  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
  if (existing && existing.id !== id) return { error: tErrors("nameTaken") };

  const grantRows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, id));
  const [oldRole] = await db.select({ name: roles.name, title: roles.title }).from(roles).where(eq(roles.id, id)).limit(1);

  await db.update(roles).set({ name, title }).where(eq(roles.id, id));
  await syncRolePermissions(id, permissionKeys);

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.rolesUpdate,
    resourceType: "role",
    resourceId: id,
    oldValues: { ...oldRole, permissionKeys: grantRows.map((g) => g.key) },
    newValues: { name, title, permissionKeys },
  });

  revalidatePath("/admin/roles");
  return { success: true };
}

export async function deleteRole(id: string): Promise<RoleActionState> {
  const admin = await requirePermission(Permissions.rolesDelete);
  const tErrors = await getTranslations("admin.roles.errors");

  const [role] = await db.select({ name: roles.name, title: roles.title, isSystem: roles.isSystem }).from(roles).where(eq(roles.id, id)).limit(1);
  if (!role) return { error: tErrors("notFound") };
  if (role.isSystem) return { error: tErrors("cannotDeleteSystem") };

  await db.delete(roles).where(eq(roles.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.rolesDelete,
    resourceType: "role",
    resourceId: id,
    oldValues: { name: role.name, title: role.title },
  });

  revalidatePath("/admin/roles");
  return { success: true };
}
