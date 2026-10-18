import { describe, test } from "node:test";
import assert from "node:assert/strict";
// Types resolve extensionless (bundler resolution); the runtime specifier keeps
// the ".ts" extension because Node's type stripping requires the exact path.
// A computed specifier avoids TS5097 (allowImportingTsExtensions is off and
// tsconfig.json stays untouched).
import type { parseRecoveryLink as parseFn } from "./recovery-link";
const { parseRecoveryLink }: { parseRecoveryLink: typeof parseFn } = await import("./recovery-link" + ".ts");

describe("parseRecoveryLink", () => {
  test("recovery fragment with access+refresh tokens is a session-tokens link", () => {
    const link = parseRecoveryLink(
      "#access_token=at-123&refresh_token=rt-456&type=recovery&expires_in=3600",
      ""
    );
    assert.deepEqual(link, { kind: "session-tokens", accessToken: "at-123", refreshToken: "rt-456" });
  });

  test("tokens without an explicit type are still accepted (older link format)", () => {
    const link = parseRecoveryLink("#access_token=at-123&refresh_token=rt-456", "");
    assert.equal(link.kind, "session-tokens");
  });

  test("PKCE recovery link carries the code in the query string", () => {
    const link = parseRecoveryLink("", "?code=pkce-abc&type=recovery");
    assert.deepEqual(link, { kind: "pkce-code", code: "pkce-abc" });
  });

  test("bare query string without the leading ? is parsed too", () => {
    const link = parseRecoveryLink("", "code=pkce-abc");
    assert.equal(link.kind, "pkce-code");
  });

  test("no fragment and no query is invalid (no OAuth code to mistake for recovery)", () => {
    assert.equal(parseRecoveryLink("", "").kind, "invalid");
  });

  test("signup-confirmation fragment is rejected, not treated as recovery", () => {
    const link = parseRecoveryLink("#access_token=at-123&refresh_token=rt-456&type=signup", "");
    assert.equal(link.kind, "invalid");
  });

  test("fragment missing refresh_token is invalid", () => {
    const link = parseRecoveryLink("#access_token=at-123&type=recovery", "");
    assert.equal(link.kind, "invalid");
  });

  test("empty token values are invalid", () => {
    const link = parseRecoveryLink("#access_token=&refresh_token=&type=recovery", "");
    assert.equal(link.kind, "invalid");
  });

  test("fragment tokens take precedence over a stray query code", () => {
    const link = parseRecoveryLink("#access_token=at-123&refresh_token=rt-456&type=recovery", "?code=other");
    assert.equal(link.kind, "session-tokens");
  });
});
