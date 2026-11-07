import { createHash, createHmac } from "node:crypto";

// Minimal, self-contained AWS Signature Version 4 signer for the library's
// private Cloudflare R2 bucket. Kept independent from lib/runtime/s3-sigv4
// on purpose: the library storage lifecycle must be free to diverge from
// the lesson Runtime storage. R2 uses region "auto" and service "s3".

const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export type SignRequestInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  path: string; // e.g. /bucket/key — already URI-encoded per segment
  accessKeyId: string;
  secretAccessKey: string;
  region?: string; // R2 expects "auto"
  service?: string; // "s3"
  payloadHash?: string; // defaults to UNSIGNED-PAYLOAD (safe for GET/proxying)
  now?: Date; // injectable for deterministic tests
  extraHeaders?: Record<string, string>; // additional SIGNED headers (lowercase names), e.g. { range }
};

export type SignedRequest = {
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
};

export function signRequest(input: SignRequestInput): SignedRequest {
  const region = input.region ?? "auto";
  const service = input.service ?? "s3";
  const payloadHash = input.payloadHash ?? "UNSIGNED-PAYLOAD";
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "") + "Z";
  const dateStamp = amzDate.slice(0, 8);

  // Canonical headers: lowercase names, trimmed values, sorted. "host" is
  // always present; x-amz-* headers and any extra signed headers (e.g.
  // "range") are merged and lexicographically sorted so the SignedHeaders
  // list matches the canonical request exactly.
  const headerMap: Record<string, string> = {
    host: input.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(input.extraHeaders ?? {}),
  };
  const sortedNames = Object.keys(headerMap).sort();
  const canonicalHeaders = sortedNames.map((name) => `${name}:${headerMap[name]}`).join("\n") + "\n";
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    input.method,
    input.path,
    "", // empty canonical query string — callers must presign separately if ever needed
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return {
    headers: {
      host: input.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    canonicalRequest,
    stringToSign,
    signature,
  };
}
