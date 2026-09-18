import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for Supabase Admin API calls (auth.admin.*). Never
// expose SUPABASE_SECRET_KEY or this client to the browser — it bypasses RLS
// and can manage any user's auth account.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
