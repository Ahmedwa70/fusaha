// Resolves the trusted origin OAuth should return the user to after the
// provider round-trip (the app-side callback that exchanges the code).
//
// NEVER build this from client headers alone: `Origin` and
// `x-forwarded-host` are caller-controllable, and an unchecked value here is
// an open redirect that hands the auth code to an external site. The
// resolved origin is therefore gated against an allow-list of hosts that
// only the platform or the operator can define:
//
//   - `NEXT_PUBLIC_SITE_URL` — used only when set AND a valid http(s) URL
//     (it is not guaranteed to exist; see the deployment docs).
//   - Vercel-managed deployment URLs — VERCEL_URL / VERCEL_BRANCH_URL /
//     VERCEL_PROJECT_PRODUCTION_URL are injected by the platform, never by
//     the caller, so they are safe to trust.
//   - localhost on any port — development only (`next dev`).
//
// A missing `Origin` header is fine on Vercel (`x-forwarded-host` is always
// present); a candidate host that matches nothing fails closed to `null` so
// the caller aborts the OAuth start instead of redirecting somewhere
// unplanned (e.g. Supabase's default Site URL, which is localhost).

export type HeaderReader = {
  get(name: string): string | null;
};

type Env = Record<string, string | undefined>;

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    // Platform vars like VERCEL_URL are bare hosts ("app.vercel.app")
    // without a scheme — retry as https before giving up.
    try {
      const url = new URL(`https://${value}`);
      return url.protocol === "https:" ? url : null;
    } catch {
      return null;
    }
  }
}

function isLocalDevHost(host: string): boolean {
  const name = host.toLowerCase();
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    name.endsWith(".localhost")
  );
}

export function resolveOAuthReturnOrigin(
  headers: HeaderReader,
  env: Env = process.env
): string | null {
  const trustedHosts = new Set<string>();
  const siteUrl = parseHttpUrl(env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl) trustedHosts.add(siteUrl.host.toLowerCase());
  for (const value of [
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const url = parseHttpUrl(value);
    if (url) trustedHosts.add(url.host.toLowerCase());
  }
  const allowLocalhost = env.NODE_ENV === "development";

  const candidates: string[] = [];
  const origin = headers.get("origin");
  if (origin) candidates.push(origin);
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = headers.get("x-forwarded-proto");
    candidates.push(
      `${proto === "http" || proto === "https" ? proto : "https"}://${forwardedHost}`
    );
  }

  for (const candidate of candidates) {
    const url = parseHttpUrl(candidate);
    if (!url) continue;
    const host = url.host.toLowerCase();
    if (trustedHosts.has(host)) return url.origin;
    if (allowLocalhost && isLocalDevHost(url.hostname.toLowerCase())) return url.origin;
  }
  return null;
}
