import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createBrowserClient } from "@supabase/ssr";

// Regression test for the recovery-link failure: the browser client
// initializes itself by scanning window.location and auto-exchanging any
// `?code=` it finds (detectSessionInUrl defaults to true in browsers). The
// recovery gate also calls exchangeCodeForSession() explicitly — a SECOND
// exchange of the same one-time code. This test proves, against the real
// @supabase/ssr + auth-js with a mocked transport (no network), that:
//   1. resetPasswordForEmail persists the PKCE code_verifier in cookies,
//   2. the first exchange succeeds and consumes the code + verifier,
//   3. any second exchange always fails WITHOUT reaching the server,
// so exactly one exchange path must own the code (the gate disables
// auto-detection; see recovery-session-gate.tsx).

const SUPABASE_URL = "https://test-project.supabase.co";
const STORAGE_KEY = "sb-test-project-auth-token";
const VERIFIER_COOKIE = `${STORAGE_KEY}-code-verifier`;

function makeCookieJar() {
  const jar = new Map<string, string>();
  return {
    jar,
    getAll() {
      return [...jar].map(([name, value]) => ({ name, value }));
    },
    setAll(
      cookiesToSet: { name: string; value: string; options?: { maxAge?: number } }[]
    ) {
      for (const { name, value, options } of cookiesToSet) {
        if (options?.maxAge === 0) jar.delete(name);
        else jar.set(name, value);
      }
    },
  };
}

function makeFakeFetch() {
  const calls: { url: string }[] = [];
  const fetchMock = async (input: unknown, init?: { method?: string }) => {
    const url = String(input);
    calls.push({ url });
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
    throw new Error(`unexpected fetch: ${url} ${init?.method ?? ""}`);
  };
  return { fetchMock, calls };
}

describe("PKCE recovery: the code is single-use", () => {
  let jar: ReturnType<typeof makeCookieJar>;
  let transport: ReturnType<typeof makeFakeFetch>;

  beforeEach(() => {
    jar = makeCookieJar();
    transport = makeFakeFetch();
  });

  afterEach(() => {
    // No background refresh should be pending; nothing to clean up because
    // autoRefreshToken is off outside browsers.
  });

  test("second exchange of the same code fails locally and never reaches the server", async () => {
    const client = createBrowserClient(SUPABASE_URL, "anon-key", {
      cookies: { getAll: jar.getAll, setAll: jar.setAll },
      global: { fetch: transport.fetchMock as unknown as typeof fetch },
    });

    // 1. Requesting the recovery email generates and persists the verifier.
    const { error: requestError } = await client.auth.resetPasswordForEmail(
      "user@example.com",
      { redirectTo: "https://app.example.com/auth/reset-password" }
    );
    assert.equal(requestError, null);
    assert.ok(
      jar.jar.has(VERIFIER_COOKIE),
      `verifier cookie ${VERIFIER_COOKIE} should be set, got: ${[...jar.jar.keys()]}`
    );

    // 2. The first exchange succeeds, establishes the session, and consumes
    //    the one-time code + verifier.
    const first = await client.auth.exchangeCodeForSession("recovery-code-1");
    assert.equal(first.error, null);
    assert.equal(first.data.session?.access_token, "access-token-1");
    assert.equal(
      jar.jar.has(VERIFIER_COOKIE),
      false,
      "verifier must be removed after a successful exchange"
    );

    // 3. A second exchange (what the gate did before the fix, after the
    //    client auto-exchanged during initialization) fails locally — the
    //    verifier is gone — and must not even call the token endpoint.
    const second = await client.auth.exchangeCodeForSession("recovery-code-1");
    assert.notEqual(second.error, null);
    const tokenCalls = transport.calls.filter((c) => c.url.includes("grant_type=pkce"));
    assert.equal(
      tokenCalls.length,
      1,
      "the second exchange must fail before hitting the server"
    );
  });
});
