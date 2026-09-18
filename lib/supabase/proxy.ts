import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";
import { ROUTES } from "@/constants/routes";

// Refreshes the Supabase session cookie on every request and does the
// optimistic redirect for protected areas. This is a fast, cookie-only
// check — the real per-request auth check still happens in the Data
// Access Layer (lib/auth/dal.ts) for Server Components/Actions/Routes.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (!user && isProtected) {
    const redirectUrl = new URL(ROUTES.login, request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Not reset-password: that page relies on the session a recovery link
  // itself establishes, so an authenticated user must still be able to
  // reach it (see the `next` handling in app/auth/callback/route.ts).
  if (user && (pathname === ROUTES.login || pathname === ROUTES.signup || pathname === ROUTES.forgotPassword)) {
    const [profile] = await db
      .select({ roleName: roles.name, active: users.active })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, user.id))
      .limit(1);

    // No/inactive profile means requireTeacher/requireAdmin would bounce
    // them right back here anyway — let them see the login page instead of
    // redirecting into a dead end.
    if (profile?.active) {
      const target = profile.roleName === "admin" ? ROUTES.admin : ROUTES.dashboard;
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return response;
}
