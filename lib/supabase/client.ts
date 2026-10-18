import { createBrowserClient } from "@supabase/ssr";
import type { CookieMethodsBrowser, CookieOptionsWithName } from "@supabase/ssr";
import type { SupabaseClientOptions } from "@supabase/supabase-js";

// Mirrors the (non-deprecated) createBrowserClient options signature: SSR
// cookie handling is automatic in the browser, so the cookie methods stay
// optional here.
type ClientOptions = SupabaseClientOptions<string> & {
  cookies?: CookieMethodsBrowser;
  cookieOptions?: CookieOptionsWithName;
  cookieEncoding?: "raw" | "base64url";
  isSingleton?: boolean;
};

// Browser-side Supabase client (Client Components). Accepts client options
// (e.g. auth flow behavior) so call sites that manage auth URLs explicitly
// can disable the library's automatic URL processing.
export function createClient(options?: ClientOptions) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options
  );
}
