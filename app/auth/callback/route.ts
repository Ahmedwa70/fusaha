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
  const { searchParams, origin, host, pathname } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const redirectOrigin = resolveRedirectOrigin(request, origin);

  console.log("[oauth-diagnostic]", {
    event: "oauth_callback",
    host,
    pathname,
    stage: "received",
  });

  if (!code) {
    console.error("[oauth-diagnostic]", {
      event: "oauth_callback",
      host,
      pathname,
      stage: "missing_code",
      errorCode: "oauth_callback_failed",
    });
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=oauth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[oauth-diagnostic]", {
      event: "oauth_callback",
      host,
      pathname,
      stage: "exchange_failed",
      errorCode: "oauth_exchange_failed",
    });
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=oauth_exchange_failed`);
  }

  // Password-recovery links issued before the reset page learned to handle
  // them directly (see requestPasswordReset in actions/auth.ts) arrive here
  // with next=/auth/reset-password. Skip the sign-in profile checks below:
  // the session is already established, and resetting a password shouldn't
  // depend on the account being active or provisioned as a teacher.
  if (next === ROUTES.resetPassword) {
    console.log("[oauth-diagnostic]", {
      event: "oauth_callback",
      host,
      pathname,
      stage: "success",
      target: ROUTES.resetPassword,
    });
    return NextResponse.redirect(`${redirectOrigin}${ROUTES.resetPassword}`);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    console.error("[oauth-diagnostic]", {
      event: "oauth_callback",
      host,
      pathname,
      stage: "identity_missing",
      errorCode: "provisioning_failed",
    });
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
        const param =
          decision.reason === "email_registered_to_other_identity"
            ? "account_link_required"
            : "provisioning_failed";
        console.error("[oauth-diagnostic]", {
          event: "oauth_callback",
          host,
          pathname,
          stage: "provisioning_rejected",
          errorCode: param,
        });
        return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=${param}`);
      }
      console.error("[oauth-diagnostic]", {
        event: "oauth_callback",
        host,
        pathname,
        stage: "provisioning_failed",
        errorCode: "provisioning_failed",
      });
      return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=provisioning_failed`);
    }
  }

  if (profile.active) {
    const target = profile.roleName === "admin" ? ROUTES.admin : ROUTES.dashboard;
    console.log("[oauth-diagnostic]", {
      event: "oauth_callback",
      host,
      pathname,
      stage: "success",
      target,
    });
    return NextResponse.redirect(`${redirectOrigin}${target}`);
  }

  console.error("[oauth-diagnostic]", {
    event: "oauth_callback",
    host,
    pathname,
    stage: "account_inactive",
    errorCode: "account_inactive",
  });
  await supabase.auth.signOut();
  return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=account_inactive`);
}
