"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";
import { ROUTES } from "@/constants/routes";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  type LoginFormValues,
  type SignupFormValues,
  type ForgotPasswordFormValues,
} from "@/validation/auth";
import { updatePasswordSchema, type UpdatePasswordValues } from "@/validation/profile";

export type AuthActionState = { error: string } | null;

export async function signIn(data: LoginFormValues): Promise<AuthActionState> {
  const tValidation = await getTranslations("validation.auth");
  const tErrors = await getTranslations("auth.errors");
  const parsed = loginSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidForm") };

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !authData.user) return { error: tErrors("invalidCredentials") };

  const [profile] = await db
    .select({ roleName: roles.name, active: users.active })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, authData.user.id))
    .limit(1);

  if (!profile) {
    await supabase.auth.signOut();
    return { error: tErrors("invalidCredentials") };
  }

  if (!profile.active) {
    await supabase.auth.signOut();
    return { error: tErrors("accountInactive") };
  }

  redirect(profile.roleName !== "teacher" ? ROUTES.admin : ROUTES.dashboard);
}

export async function signUp(data: SignupFormValues): Promise<AuthActionState> {
  const tValidation = await getTranslations("validation.auth");
  const tErrors = await getTranslations("auth.errors");
  const parsed = signupSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidForm") };
  const { name, email, password } = parsed.data;

  const [existingProfile] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingProfile) return { error: tErrors("emailTaken") };

  const [teacherRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "teacher")).limit(1);
  if (!teacherRole) return { error: tErrors("roleNotFound") };

  const { data: created, error: createError } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) return { error: tErrors("createUserFailed") };

  await db
    .insert(users)
    .values({ id: created.user.id, name, email, roleId: teacherRole.id, creditsBalance: 0, active: true });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: tErrors("invalidCredentials") };

  redirect(ROUTES.dashboard);
}

export async function requestPasswordReset(data: ForgotPasswordFormValues): Promise<AuthActionState> {
  const tValidation = await getTranslations("validation.auth");
  const tErrors = await getTranslations("auth.errors");
  const parsed = forgotPasswordSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidForm") };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  // Resolves the same way whether or not the email is registered — the
  // caller shows a generic "check your inbox" message either way, so this
  // never leaks account existence.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${ROUTES.authCallback}?next=${ROUTES.resetPassword}`,
  });

  return null;
}

export async function resetPassword(data: UpdatePasswordValues): Promise<AuthActionState> {
  const tValidation = await getTranslations("validation.profile");
  const tErrors = await getTranslations("auth.errors");
  const parsed = updatePasswordSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidForm") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: tErrors("resetLinkExpired") };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: tErrors("resetPasswordFailed") };

  const [profile] = await db
    .select({ roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, user.id))
    .limit(1);

  redirect(profile?.roleName !== "teacher" ? ROUTES.admin : ROUTES.dashboard);
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}${ROUTES.authCallback}` },
  });
  if (error || !data.url) redirect(ROUTES.login);

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
