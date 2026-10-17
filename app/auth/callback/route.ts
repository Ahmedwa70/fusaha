import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";
import { ROUTES } from "@/constants/routes";
import { decideNewUserProfile } from "@/lib/auth/sign-in-profile";

// Handles the redirect back from an OAuth provider (e.g. Google). Exchanges
// the auth code for a session. A Supabase auth user with no matching
// `users` row yet (first-time Google sign-in, from either the login or
// signup page) is self-provisioned here as a teacher account — signup is
// open, so there's no admin-side gate to wait for. A row that exists but is
// inactive (a deliberately suspended account) is signed back out.
function resolveRedirectOrigin(request: Request, requestOrigin: string) {
  // Behind a proxy/load balancer (e.g. Vercel) `origin` from the request URL
  // can point at an internal host — prefer the public host Supabase forwards.
  // x-forwarded-host is client-controllable, so only trust it when it matches
  // our configured site URL (avoids an open-redirect via a spoofed header).
  if (process.env.NODE_ENV === "development") return requestOrigin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const allowedHost = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host
    : null;
  if (forwardedHost && allowedHost && forwardedHost === allowedHost) {
    return `https://${forwardedHost}`;
  }

  return requestOrigin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const redirectOrigin = resolveRedirectOrigin(request, origin);

  if (!code) {
    // Supabase forwards provider-side failures (e.g. access_denied) as
    // error/error_description params with no code. Log which failure
    // occurred — never session-bound values like tokens or verifier state.
    const providerError = searchParams.get("error");
    const providerErrorDescription = searchParams.get("error_description");
    console.error(
      "[auth/callback] OAuth redirect arrived without a code:",
      providerError
        ? `provider_error=${providerError} ${providerErrorDescription ?? ""}`.trim()
        : "(no provider error details — possible direct visit or stale redirect)",
    );
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=oauth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Diagnose the real exchange failure (e.g. missing PKCE verifier). The
    // auth code itself must never be logged.
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=oauth_exchange_failed`);
  }

  // Password-recovery links issued before the reset page learned to handle
  // them directly (see requestPasswordReset in actions/auth.ts) arrive here
  // with next=/auth/reset-password. Skip the sign-in profile checks below:
  // the session is already established, and resetting a password shouldn't
  // depend on the account being active or provisioned as a teacher.
  if (next === ROUTES.resetPassword) {
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.resetPassword}`);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    // A successful exchange with no retrievable identity should not happen
    // — surface it instead of falling through to account_inactive.
    console.error("[auth/callback] session exchanged but getUser() returned no user");
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=provisioning_failed`);
  }

  let [profile] = await db
    .select({ active: users.active, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!profile) {
    const [emailOwner] = authUser.email
      ? await db.select({ id: users.id }).from(users).where(eq(users.email, authUser.email)).limit(1)
      : [];
    const [teacherRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, "teacher"))
      .limit(1);

    const decision = decideNewUserProfile({
      identity: {
        id: authUser.id,
        email: authUser.email ?? null,
        fullName:
          typeof authUser.user_metadata?.full_name === "string"
            ? authUser.user_metadata.full_name
            : null,
      },
      emailOwnerId: emailOwner?.id,
      teacherRoleId: teacherRole?.id,
    });

    if (decision.action === "provision") {
      // Idempotent: a concurrent callback for the same identity may have
      // already inserted the row — do not duplicate, adopt the existing one.
      await db.insert(users).values(decision.values).onConflictDoNothing({ target: users.id });
      [profile] = await db
        .select({ active: users.active, roleName: roles.name })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, authUser.id))
        .limit(1);
    }

    if (!profile) {
      // Either a deliberate rejection or the row still isn't there after
      // the insert — in both cases sign out and report a specific cause.
      await supabase.auth.signOut();
      if (decision.action === "reject") {
        console.error("[auth/callback] new-user provisioning rejected:", decision.reason);
        const param =
          decision.reason === "email_registered_to_other_identity"
            ? "account_link_required"
            : "provisioning_failed";
        return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=${param}`);
      }
      console.error("[auth/callback] users row still missing after provisioning insert");
      return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=provisioning_failed`);
    }
  }

  if (profile.active) {
    const target = profile.roleName === "admin" ? ROUTES.admin : ROUTES.dashboard;
    return NextResponse.redirect(`${redirectOrigin}${target}`);
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=account_inactive`);
}
