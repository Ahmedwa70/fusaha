import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";
import { ROUTES } from "@/constants/routes";

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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password-recovery links carry their own destination (set when the
      // email was sent — see requestPasswordReset in actions/auth.ts) and
      // skip the sign-in profile checks below: the session is already
      // established, and resetting a password shouldn't depend on the
      // account being active or provisioned as a teacher.
      if (next === ROUTES.resetPassword) {
        return NextResponse.redirect(`${redirectOrigin}${ROUTES.resetPassword}`);
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      let [profile] = authUser
        ? await db
            .select({ active: users.active, roleName: roles.name })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, authUser.id))
            .limit(1)
        : [];

      if (!profile && authUser?.email) {
        const [teacherRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "teacher")).limit(1);
        if (teacherRole) {
          await db.insert(users).values({
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.full_name ?? authUser.email,
            roleId: teacherRole.id,
            creditsBalance: 0,
            active: true,
          });
          profile = { active: true, roleName: "teacher" };
        }
      }

      if (profile?.active) {
        const target = profile.roleName === "admin" ? ROUTES.admin : ROUTES.dashboard;
        return NextResponse.redirect(`${redirectOrigin}${target}`);
      }

      await supabase.auth.signOut();
      return NextResponse.redirect(`${redirectOrigin}${ROUTES.login}?error=account_inactive`);
    }
  }

  return NextResponse.redirect(
    `${redirectOrigin}${ROUTES.login}?error=account_not_found`,
  );
}
