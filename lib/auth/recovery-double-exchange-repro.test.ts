import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Reproduces the production bug against the real @supabase/ssr + auth-js,
// with a fake browser environment (window/document) and a mocked transport —
// no network, no real Supabase project.
//
// Bug chain (what happened in production for every recovery link):
//   1. The server action stored the PKCE code_verifier in a cookie.
//   2. The user clicked the emailed link and landed on
//      /auth/reset-password?code=... The gate created the browser client —
//      the page's first (singleton) browser client — whose initialization
//      scans the URL and, with detectSessionInUrl=true (the browser
//      default), auto-exchanged the code: session established, verifier
//      deleted.
//   3. The gate's explicit exchangeCodeForSession() awaited the same init
//      promise, so it always ran second, found no verifier, and failed —
//      and the catch {} in the gate reported a perfectly valid link as
//      "expired".
//
// The request side uses a non-singleton client (isSingleton: false) so the
// gate client is the first singleton browser client in this process, exactly
// like the page load in production.

const SUPABASE_URL = "https://test-project.supabase.co";
const STORAGE_KEY = "sb-test-project-auth-token";
const VERIFIER_COOKIE = `${STORAGE_KEY}-code-verifier`;

// --- fake browser environment (must exist before clients are created) ---

const cookieJar = new Map<string, string>();

const fakeDocument = {
  get cookie() {
    return [...cookieJar].map(([n, v]) => `${n}=${v}`).join("; ");
  },
  set cookie(serialized: string) {
    const [pair, ...attrs] = serialized.split("; ");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const maxAge = attrs
      .map((a) => a.split("="))
      .find(([k]) => k.toLowerCase() === "max-age");
    if (maxAge && Number(maxAge[1]) <= 0) cookieJar.delete(name);
    else cookieJar.set(name, value);
  },
};

// Node exposes a global BroadcastChannel; auth-js would create one per
// client and never close it, keeping the test process alive. The fake
// browser environment has none, which is fine — multi-tab sync is not under
// test here.
delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

Object.defineProperty(globalThis, "document", {
  value: fakeDocument,
  configurable: true,
});

let currentUrl = "https://app.example.com/auth/reset-password";
Object.defineProperty(globalThis, "window", {
  value: {
    document: fakeDocument,
    get location() {
      return { href: currentUrl };
    },
  },
  configurable: true,
});

// --- mocked transport ---

const calls: string[] = [];
const fetchMock = async (input: unknown) => {
  const url = String(input);
  calls.push(url);
  if (url.includes("/auth/v1/recover")) {
    return Response.json({});
  }
  if (url.includes("/auth/v1/token?grant_type=pkce")) {
    return Response.json({
      access_token: "access-token-1",
      refresh_token: "refresh-token-1",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: {
        id: "user-1",
        aud: "authenticated",
        role: "authenticated",
        email: "user@example.com",
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
      },
    });
  }
  throw new Error(`unexpected fetch: ${url}`);
};

const realFetch = globalThis.fetch;
globalThis.fetch = fetchMock as unknown as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
const { createClient } = await import("../supabase/client" + ".ts");

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("recovery flow through the app's browser client factory", () => {
  test("default client auto-exchanges the ?code= on init, so a second explicit exchange fails", async (t) => {
    // 1. Request the recovery email (non-singleton client so the gate client
    //    below is the process's first singleton browser client, as in
    //    production). The verifier lands in the fake document.cookie jar.
    const requesting = createClient({ isSingleton: false });
    try {
      const { error: requestError } = await requesting.auth.resetPasswordForEmail(
        "user@example.com",
        { redirectTo: "https://app.example.com/auth/reset-password" }
      );
      assert.equal(requestError, null);
      assert.ok(cookieJar.has(VERIFIER_COOKIE), "verifier cookie must be set");

      // 2. The user clicks the emailed link: the landing URL carries the
      //    code. A fresh singleton client is created (as the gate does) —
      //    initialization auto-exchanges the code before anything else.
      currentUrl = "https://app.example.com/auth/reset-password?code=recovery-code-1";
      const gateClient = createClient();
      try {
        // 3. The gate's explicit exchange now runs — after the auto-exchange
        //    (both await the same init promise) — and must fail even though
        //    the session was already established.
        const second = await gateClient.auth.exchangeCodeForSession("recovery-code-1");
        assert.notEqual(second.error, null, "second exchange must fail");

        // The mechanism of the failure, proven: the session EXISTS (the
        // auto-exchange succeeded and saved it) while the verifier is gone.
        assert.ok(cookieJar.has(STORAGE_KEY), "auto-exchange should have saved the session");
        assert.ok(!cookieJar.has(VERIFIER_COOKIE), "verifier must be consumed once");

        // And the failure happened locally: the token endpoint saw one call.
        const tokenCalls = calls.filter((u) => u.includes("grant_type=pkce"));
        assert.equal(tokenCalls.length, 1);
      } finally {
        gateClient.auth.stopAutoRefresh();
      }
    } finally {
      requesting.auth.stopAutoRefresh();
    }
  });
});
