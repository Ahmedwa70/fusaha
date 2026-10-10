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
    // Authenticated successfully but has no public.users row — say so
    // instead of blaming the credentials (ownership is already proven).
    await supabase.auth.signOut();
    return { error: tErrors("profileMissing") };
  }

  if (!profile.active) {
    await supabase.auth.signOut();
    return { error: tErrors("accountInactive") };
  }

  redirect(profile.roleName !== "teacher" ? ROUTES.admin : ROUTES.dashboard);
}

// FormData-shaped wrapper so the login form can bind this action directly
// via <form action={...}> (useActionState). Progressive enhancement: with
// client JS the form submits through the onSubmit path below; without JS the
// browser POSTs to this action instead of falling back to a native GET that
// would put the credentials in the URL.
export async function signInWithFormData(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return signIn({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
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

  // Email/password signup needs the service-role key for auth.admin.createUser.
  // Without it this action used to throw and the form died with no feedback.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return { error: tErrors("serverNotConfigured") };
  }

  let createdUserId: string | null = null;
  try {
    const { data: created, error: createError } = await createAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) return { error: tErrors("createUserFailed") };
    createdUserId = created.user.id;

    await db
      .insert(users)
      .values({ id: created.user.id, name, email, roleId: teacherRole.id, creditsBalance: 0, active: true });
  } catch (cause) {
    // Convert thrown failures (network, DB down, rejected service key) into
    // a visible message instead of a silent dead button — and don't leave a
    // half-created auth user behind for the next attempt to trip on.
    console.error("[auth] signUp provisioning failed:", cause);
    if (createdUserId) {
      await createAdminClient().auth.admin.deleteUser(createdUserId).catch(() => {});
    }
    return { error: tErrors("createUserFailed") };
  }

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
