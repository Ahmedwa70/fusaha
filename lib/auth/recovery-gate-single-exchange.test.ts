import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Companion to recovery-double-exchange-repro.test.ts: proves the FIX.
// The recovery gate creates its client with { auth: { detectSessionInUrl: false } }
// through the app's factory, so initialization does NOT consume the ?code= —
// the gate's explicit exchangeCodeForSession is the single exchange, and it
// succeeds. Runs in its own process on purpose: createBrowserClient caches a
// singleton per page load, and in production the gate is the page's first
// (and only) browser-client creator.

const SUPABASE_URL = "https://test-project.supabase.co";
const STORAGE_KEY = "sb-test-project-auth-token";
const VERIFIER_COOKIE = `${STORAGE_KEY}-code-verifier`;

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

const currentUrl = "https://app.example.com/auth/reset-password?code=recovery-code-1";
Object.defineProperty(globalThis, "window", {
  value: {
    document: fakeDocument,
    get location() {
      return { href: currentUrl };
    },
  },
  configurable: true,
});

const calls: string[] = [];
const fetchMock = async (input: unknown) => {
  const url = String(input);
  calls.push(url);
  if (url.includes("/auth/v1/recover")) return Response.json({});
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

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
const realFetch = globalThis.fetch;
globalThis.fetch = fetchMock as unknown as typeof fetch;

const { createClient } = await import("../supabase/client" + ".ts");

describe("recovery gate client (detectSessionInUrl: false)", () => {
  test("init leaves the code untouched; the gate's single explicit exchange succeeds", async () => {
    // 1. Seed the verifier exactly as the server action does (non-singleton
    //    client so the gate client below is the process's first singleton
    //    browser client, as in production).
    const requesting = createClient({ isSingleton: false });
    try {
      const { error: requestError } = await requesting.auth.resetPasswordForEmail(
        "user@example.com",
        { redirectTo: "https://app.example.com/auth/reset-password" }
      );
      assert.equal(requestError, null);
      assert.ok(cookieJar.has(VERIFIER_COOKIE));
    } finally {
      requesting.auth.stopAutoRefresh();
    }

    // 2. Land on the page with ?code= and create the gate's client. With
    //    auto-detection disabled, initialization must NOT touch the code.
    const gateClient = createClient({ auth: { detectSessionInUrl: false } });
    try {
      assert.ok(
        !cookieJar.has(STORAGE_KEY),
        "no session may exist before the explicit exchange"
      );
      assert.equal(
        calls.filter((u) => u.includes("grant_type=pkce")).length,
        0,
        "initialization must not exchange the code"
      );

      // 3. The gate's explicit exchange is the only one — and it succeeds.
      const exchanged = await gateClient.auth.exchangeCodeForSession("recovery-code-1");
      assert.equal(exchanged.error, null);
      assert.equal(exchanged.data.session?.access_token, "access-token-1");
      assert.ok(cookieJar.has(STORAGE_KEY), "session must be saved");
      assert.ok(!cookieJar.has(VERIFIER_COOKIE), "verifier must be consumed");
    } finally {
      gateClient.auth.stopAutoRefresh();
    }
  });
});
