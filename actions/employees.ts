"use server";

import { eq, notInArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { createEmployeeSchema, updateEmployeeSchema, type CreateEmployeeValues, type UpdateEmployeeValues } from "@/validation/employees";

export type EmployeeActionState = { error: string } | { success: true };

// "teacher" is self-provisioned; "admin" is the protected super-admin
// system role — neither can be assigned to or targeted as an employee.
const NON_EMPLOYEE_ROLES = ["teacher", "admin"];

async function assertAssignableRole(roleId: string) {
  const [role] = await db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role || NON_EMPLOYEE_ROLES.includes(role.name)) return null;
  return role;
}

export async function createEmployee(data: CreateEmployeeValues): Promise<EmployeeActionState> {
  const admin = await requirePermission(Permissions.employeesCreate);

  const tValidation = await getTranslations("validation.employees");
  const tErrors = await getTranslations("admin.employees.errors");
  const parsed = createEmployeeSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, email, password, roleId } = parsed.data;

  const role = await assertAssignableRole(roleId);
  if (!role) return { error: tErrors("invalidRole") };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: tErrors("emailTaken") };

  const { data: created, error: createError } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) return { error: tErrors("createUserFailed") };

  await db.insert(users).values({ id: created.user.id, name, email, roleId, creditsBalance: 0, active: true });

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.employeesCreate,
    resourceType: "employee",
    resourceId: created.user.id,
    newValues: { name, email, roleId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  return { success: true };
}

export async function updateEmployee(id: string, data: UpdateEmployeeValues): Promise<EmployeeActionState> {
  const admin = await requirePermission(Permissions.employeesUpdate);

  const tValidation = await getTranslations("validation.employees");
  const tErrors = await getTranslations("admin.employees.errors");
  const parsed = updateEmployeeSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, roleId, active } = parsed.data;

  const role = await assertAssignableRole(roleId);
  if (!role) return { error: tErrors("invalidRole") };

  const [existing] = await db
    .select({ name: users.name, roleId: users.roleId, active: users.active })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, id), notInArray(roles.name, NON_EMPLOYEE_ROLES)))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  await db.update(users).set({ name, roleId, active }).where(eq(users.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.employeesUpdate,
    resourceType: "employee",
    resourceId: id,
    oldValues: existing,
    newValues: { name, roleId, active },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  return { success: true };
}

export async function deleteEmployee(id: string): Promise<EmployeeActionState> {
  const admin = await requirePermission(Permissions.employeesDelete);
  const tErrors = await getTranslations("admin.employees.errors");
  if (admin.id === id) return { error: tErrors("cannotDeleteSelf") };

  const [existing] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, id), notInArray(roles.name, NON_EMPLOYEE_ROLES)))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  // Best-effort: an auth-side failure here still leaves a clean `users` row
  // removal below — same reasoning as actions/teachers.ts deleteTeacher.
  await createAdminClient().auth.admin.deleteUser(id);
  await db.delete(users).where(eq(users.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.employeesDelete,
    resourceType: "employee",
    resourceId: id,
    oldValues: existing,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  return { success: true };
}
