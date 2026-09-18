import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, roles, permissions, rolePermissions } from "@/database/schema";
import { ROUTES } from "@/constants/routes";
import type { PermissionKey } from "@/constants/permissions";

// Cached per-request: safe to call from multiple Server Components without
// re-hitting Supabase/the DB. This is the real (non-optimistic) auth check —
// proxy.ts only does a fast redirect, this is the source of truth.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const [profile] = await db
    .select({ user: users, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, authUser.id))
    .limit(1);
  if (!profile || !profile.user.active) return null;

  return { ...profile.user, roleName: profile.roleName };
});

export async function requireTeacher() {
  const user = await getCurrentUser();
  if (!user || user.roleName !== "teacher") {
    if (user) await (await createClient()).auth.signOut();
    redirect(ROUTES.login);
  }
  return user;
}

// "Admin platform access" means any role other than "teacher" — the admin
// role plus any custom staff role created via the Roles UI (see
// actions/employees.ts). requirePermission() below is what actually scopes
// what a given role can do inside the platform.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.roleName === "teacher") {
    if (user) await (await createClient()).auth.signOut();
    redirect(ROUTES.login);
  }
  return user;
}

// Baseline admin gate plus a specific permission grant check for the user's
// role. Returns the same shape as requireAdmin() so call sites can swap
// `await requireAdmin()` for `await requirePermission(Permissions.xxx)`
// with no other changes needed.
export async function requirePermission(key: PermissionKey) {
  const user = await requireAdmin();

  const [grant] = await db
    .select({ id: rolePermissions.roleId })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(rolePermissions.roleId, user.roleId), eq(permissions.key, key)))
    .limit(1);
  if (!grant) redirect(ROUTES.unauthorized);

  return user;
}

// All permission keys granted to a role — used to filter UI (e.g. the admin
// sidebar) down to what the current role can actually reach. Cached per
// request like getCurrentUser, since layout + every page under /admin reads it.
export const getRolePermissionKeys = cache(async (roleId: string): Promise<Set<PermissionKey>> => {
  const grants = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));

  return new Set(grants.map((g) => g.key)) as Set<PermissionKey>;
});
