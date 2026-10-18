// Recovery email links (Supabase Auth) deliver the session in one of two
// shapes, depending on the "secure email links (PKCE)" dashboard setting:
//
//   - Implicit grant (default): tokens arrive in the URL *fragment*
//     (`#access_token=...&refresh_token=...&type=recovery`) — the browser
//     never sends the fragment to the server, so only client-side code can
//     see it.
//   - PKCE: a one-time `code` arrives in the query string instead.
//
// The reset-password page is a client gate that must classify the incoming
// link before it can know whether a recovery session can be established.
// This helper is the pure, browser-independent part of that classification.
export type RecoveryLink =
  | { kind: "session-tokens"; accessToken: string; refreshToken: string }
  | { kind: "pkce-code"; code: string }
  | { kind: "invalid" };

function parseParams(input: string): URLSearchParams {
  // Accept a bare "a=1&b=2" string as well as a full "#a=1" / "?a=1" —
  // window.location.hash/search include the leading separator.
  return new URLSearchParams(input.replace(/^[#?]/, ""));
}

export function parseRecoveryLink(hash: string, search: string): RecoveryLink {
  const fragment = parseParams(hash);
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const type = fragment.get("type");

  // Only a recovery session may establish a session on the reset page — a
  // signup-confirmation link (type=signup) landing here with tokens must be
  // rejected, not silently converted into a login.
  if (accessToken && refreshToken && (!type || type === "recovery")) {
    return { kind: "session-tokens", accessToken, refreshToken };
  }

  const query = parseParams(search);
  const code = query.get("code");
  if (code) return { kind: "pkce-code", code };

  return { kind: "invalid" };
}
