import { describe, test } from "node:test";
import assert from "node:assert/strict";
// Types resolve extensionless (bundler resolution); the runtime specifier keeps
// the ".ts" extension because Node's type stripping requires the exact path.
// A computed specifier avoids TS5097 (allowImportingTsExtensions is off and
// tsconfig.json stays untouched).
import type { resolveOAuthReturnOrigin as resolveFn } from "./oauth-return-url";
const { resolveOAuthReturnOrigin }: { resolveOAuthReturnOrigin: typeof resolveFn } =
  await import("./oauth-return-url" + ".ts");

function headers(entries: Record<string, string>): {
  get(name: string): string | null;
} {
  const map = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
}

const PREVIEW = "fusaha-git-fix-trigger-dev-migration-ahmedwa7070-5275.vercel.app";
const env = (overrides: Record<string, string> = {}): Record<string, string | undefined> => ({
  NODE_ENV: "production",
  ...overrides,
});

describe("resolveOAuthReturnOrigin", () => {
  test("local dev: accepts localhost origin in development", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "http://localhost:3000" }),
      env({ NODE_ENV: "development" })
    );
    assert.equal(result, "http://localhost:3000");
  });

  test("vercel preview: origin header matching platform VERCEL_URL is accepted", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: `https://${PREVIEW}` }),
      env({ VERCEL_URL: PREVIEW })
    );
    assert.equal(result, `https://${PREVIEW}`);
  });

  test("the reported bug: missing Origin falls back to x-forwarded-host (platform host)", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ "x-forwarded-host": PREVIEW, "x-forwarded-proto": "https" }),
      env({ VERCEL_URL: PREVIEW, VERCEL_BRANCH_URL: PREVIEW })
    );
    assert.equal(result, `https://${PREVIEW}`);
  });

  test("custom production domain: origin matching NEXT_PUBLIC_SITE_URL is accepted", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "https://app.fusaha.example" }),
      env({ NEXT_PUBLIC_SITE_URL: "https://app.fusaha.example" })
    );
    assert.equal(result, "https://app.fusaha.example");
  });

  test("security: spoofed Origin to an external site is rejected even when forwarded-host matches", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "https://evil.example", "x-forwarded-host": PREVIEW }),
      env({ VERCEL_URL: PREVIEW })
    );
    assert.equal(result, `https://${PREVIEW}`);
  });

  test("security: spoofed forwarded-host to an external site is rejected", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" }),
      env({ VERCEL_URL: PREVIEW })
    );
    assert.equal(result, null);
  });

  test("security: localhost origin is NOT accepted outside development", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "http://localhost:3000" }),
      env({ VERCEL_URL: PREVIEW })
    );
    assert.equal(result, null);
  });

  test("fail closed: no usable headers means no origin, even with SITE_URL set", () => {
    const result = resolveOAuthReturnOrigin(
      headers({}),
      env({ NEXT_PUBLIC_SITE_URL: "https://app.fusaha.example" })
    );
    assert.equal(result, null);
  });

  test("fail closed: invalid NEXT_PUBLIC_SITE_URL is ignored, not trusted", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "https://not-a-match.example" }),
      env({ NEXT_PUBLIC_SITE_URL: "not a url", VERCEL_URL: PREVIEW })
    );
    assert.equal(result, null);
  });

  test("malicious protocols are never returned", () => {
    const result = resolveOAuthReturnOrigin(
      headers({ origin: "javascript:alert(1)" }),
      env({ NODE_ENV: "development" })
    );
    assert.equal(result, null);
  });
});
