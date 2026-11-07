import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, test } from "node:test";
import { signRequest } from "./sigv4.ts";

const SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";
const ACCESS_KEY = "AKIDEXAMPLE";
const NOW = new Date("2015-08-30T12:36:00Z");

// Independent reference implementation (written directly against node:crypto
// here, not shared with the module under test) so a slip in the module's
// string joining or key derivation cannot pass silently.
function referenceSignature(input) {
  const amzDate = "20150830T123600Z";
  const dateStamp = "20150830";
  const canonicalHeaders = `host:${input.host}\nx-amz-content-sha256:${input.payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [input.method, input.path, "", canonicalHeaders, "host;x-amz-content-sha256;x-amz-date", input.payloadHash].join("\n");
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const h = (key, data) => createHmac("sha256", key).update(data).digest();
  const kSigning = h(h(h(h(`AWS4${SECRET}`, dateStamp), input.region), input.service), "aws4_request");
  return { canonicalRequest, stringToSign, signature: createHmac("sha256", kSigning).update(stringToSign).digest("hex") };
}

describe("sigv4 signer", () => {
  test("matches an independent reference implementation", () => {
    const signed = signRequest({ method: "GET", host: "examplebucket.r2.cloudflarestorage.com", path: "/bucket/library/pdfs/ab/hash.pdf", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, region: "auto", service: "s3", now: NOW });
    const ref = referenceSignature({ method: "GET", host: "examplebucket.r2.cloudflarestorage.com", path: "/bucket/library/pdfs/ab/hash.pdf", payloadHash: "UNSIGNED-PAYLOAD", region: "auto", service: "s3" });
    assert.equal(signed.canonicalRequest, ref.canonicalRequest);
    assert.equal(signed.stringToSign, ref.stringToSign);
    assert.equal(signed.signature, ref.signature);
  });

  test("is deterministic for identical inputs and sensitive to the secret", () => {
    const base = { method: "GET", host: "h.r2.cloudflarestorage.com", path: "/b/k", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, now: NOW };
    const a = signRequest(base);
    const b = signRequest(base);
    assert.equal(a.signature, b.signature);
    const c = signRequest({ ...base, secretAccessKey: "differentSecret" });
    assert.notEqual(a.signature, c.signature);
  });

  test("defaults to UNSIGNED-PAYLOAD and R2 region/service", () => {
    const signed = signRequest({ method: "PUT", host: "h", path: "/b/k", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, payloadHash: "abc123", now: NOW });
    assert.ok(signed.canonicalRequest.endsWith("\nabc123"));
    assert.ok(signed.headers.authorization.includes("/auto/s3/aws4_request"));
    assert.equal(signed.headers["x-amz-content-sha256"], "abc123");
  });

  test("produces a 64-char lowercase hex signature and a full credential scope", () => {
    const signed = signRequest({ method: "GET", host: "h", path: "/b/k", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, now: NOW });
    assert.match(signed.signature, /^[a-f0-9]{64}$/);
    assert.ok(signed.headers.authorization.startsWith(`AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/20150830/auto/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=`));
  });
});

describe("sigv4 signer with extra signed headers (Range)", () => {
  test("signs the range header and includes it in SignedHeaders", () => {
    const signed = signRequest({
      method: "GET",
      host: "examplebucket.r2.cloudflarestorage.com",
      path: "/bucket/library/pdfs/ab/hash.pdf",
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET,
      now: NOW,
      extraHeaders: { range: "bytes=0-1023" },
    });
    // sorted: host < range < x-amz-content-sha256 < x-amz-date
    assert.ok(signed.canonicalRequest.includes("host:examplebucket.r2.cloudflarestorage.com\nrange:bytes=0-1023\nx-amz-content-sha256:"));
    assert.ok(signed.headers.authorization.includes("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"));
  });

  test("changing the range value changes the signature", () => {
    const base = { method: "GET", host: "h.r2.cloudflarestorage.com", path: "/b/k", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, now: NOW };
    const a = signRequest({ ...base, extraHeaders: { range: "bytes=0-1023" } });
    const b = signRequest({ ...base, extraHeaders: { range: "bytes=0-2047" } });
    const c = signRequest(base);
    assert.notEqual(a.signature, b.signature);
    assert.notEqual(a.signature, c.signature);
  });

  test("omitting extraHeaders preserves the legacy canonical header order", () => {
    const signed = signRequest({ method: "GET", host: "h", path: "/b/k", accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, now: NOW });
    assert.ok(signed.headers.authorization.includes("SignedHeaders=host;x-amz-content-sha256;x-amz-date"));
  });
});
