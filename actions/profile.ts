"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users } from "@/database/schema";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireTeacher } from "@/lib/auth/dal";
import { updateNameSchema, updatePasswordSchema } from "@/validation/profile";

export type ProfileActionState = { error: string } | { success: true };

export async function updateProfileName(name: string): Promise<ProfileActionState> {
  const admin = await requireAdmin();

  const tValidation = await getTranslations("validation.profile");
  const tErrors = await getTranslations("admin.profile.errors");
  const parsed = updateNameSchema(tValidation).safeParse({ name });
  if (!parsed.success) return { error: tErrors("invalidData") };

  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, admin.id));

  // Name shows in the admin sidebar on every admin page, so revalidate
  // broadly rather than just the profile page.
  revalidatePath("/admin");
  return { success: true };
}

export async function updateProfilePassword(
  password: string,
  confirmPassword: string
): Promise<ProfileActionState> {
  await requireAdmin();

  const tValidation = await getTranslations("validation.profile");
  const tErrors = await getTranslations("admin.profile.errors");
  const parsed = updatePasswordSchema(tValidation).safeParse({ password, confirmPassword });
  if (!parsed.success) return { error: tErrors("invalidData") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: tErrors("updatePasswordFailed") };

  return { success: true };
}

export async function updateTeacherProfileName(name: string): Promise<ProfileActionState> {
  const teacher = await requireTeacher();

  const tValidation = await getTranslations("validation.profile");
  const tErrors = await getTranslations("dashboard.profile.errors");
  const parsed = updateNameSchema(tValidation).safeParse({ name });
  if (!parsed.success) return { error: tErrors("invalidData") };

  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, teacher.id));

  // Name shows in the dashboard sidebar on every teacher page, so revalidate
  // broadly rather than just the profile page.
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTeacherProfilePassword(
  password: string,
  confirmPassword: string
): Promise<ProfileActionState> {
  await requireTeacher();

  const tValidation = await getTranslations("validation.profile");
  const tErrors = await getTranslations("dashboard.profile.errors");
  const parsed = updatePasswordSchema(tValidation).safeParse({ password, confirmPassword });
  if (!parsed.success) return { error: tErrors("invalidData") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: tErrors("updatePasswordFailed") };

  return { success: true };
}
