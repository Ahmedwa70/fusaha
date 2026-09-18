"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users } from "@/database/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { updateTeacherSchema, type UpdateTeacherValues } from "@/validation/teachers";

export type TeacherActionState = { error: string } | { success: true };

export async function updateTeacher(id: string, data: UpdateTeacherValues): Promise<TeacherActionState> {
  const admin = await requirePermission(Permissions.usersUpdate);

  const tValidation = await getTranslations("validation.teachers");
  const tErrors = await getTranslations("admin.teachers.errors");
  const parsed = updateTeacherSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };
  const { name, creditsBalance, active } = parsed.data;

  const [existing] = await db
    .select({ name: users.name, creditsBalance: users.creditsBalance, active: users.active })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  await db.update(users).set({ name, creditsBalance, active }).where(eq(users.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.usersUpdate,
    resourceType: "teacher",
    resourceId: id,
    oldValues: existing,
    newValues: { name, creditsBalance, active },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/teachers");
  return { success: true };
}

export async function deleteTeacher(id: string): Promise<TeacherActionState> {
  const admin = await requirePermission(Permissions.usersDelete);
  const tErrors = await getTranslations("admin.teachers.errors");
  if (admin.id === id) return { error: tErrors("cannotDeleteSelf") };

  const [existing] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  // Best-effort: an auth-side failure here still leaves a clean `users` row
  // removal below, and a stray auth account is handled the same way a
  // never-provisioned one is (app/auth/callback/route.ts signs it out and
  // cleans it up on the next failed login attempt).
  await createAdminClient().auth.admin.deleteUser(id);
  await db.delete(users).where(eq(users.id, id));

  await recordAuditLog({
    userId: admin.id,
    action: Permissions.usersDelete,
    resourceType: "teacher",
    resourceId: id,
    oldValues: existing,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/teachers");
  return { success: true };
}
