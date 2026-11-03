// Minimal dependency-free S3 REST client with AWS Signature Version 4
// (node:crypto only — same approach as the runtime-persistence POC client).
//
// This is the single signing implementation for the whole runtime module:
// runtime-entry-content.ts (Phase 4 reads) and runtime-content-store.ts
// (Phase 5 writes) both build on it, so reads and writes sign identically.
// Only the "s3-compatible" provider label is supported anywhere in lib/runtime.

import { createHash, createHmac } from "node:crypto";

export type S3FetchConfig = Readonly<{
  endpoint: string;
  accessKey: string;
  secretKey: string;
  region?: string;
}>;

export class S3RequestError extends Error {
  readonly status: number;
  readonly bucket: string;
  readonly key: string;

  constructor(message: string, status: number, bucket: string, key: string) {
    super(message);
    this.name = "S3RequestError";
    this.status = status;
    this.bucket = bucket;
    this.key = key;
  }
}

const sha256Hex = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

function canonicalUri(bucket: string, key: string): string {
  return `/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function signRequest(
  config: S3FetchConfig,
  method: "GET" | "PUT",
  bucket: string,
  key: string,
  extraHeaders: Record<string, string>,
  payload: Buffer,
): { url: string; headers: Record<string, string> } {
  const base = new URL(config.endpoint);
  const region = config.region ?? "us-east-1";
  const payloadHash = sha256Hex(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: base.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const request = [method, canonicalUri(bucket, key), "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(Buffer.from(request))].join("\n");
  const kDate = createHmac("sha256", `AWS4${config.secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `${base.protocol}//${base.host}${canonicalUri(bucket, key)}`,
    headers: { ...headers, authorization },
  };
}

async function executeSigned(
  config: S3FetchConfig,
  method: "GET" | "PUT",
  bucket: string,
  key: string,
  extraHeaders: Record<string, string>,
  payload: Buffer,
): Promise<Response> {
  const { url, headers } = signRequest(config, method, bucket, key, extraHeaders, payload);
  try {
    return await fetch(url, { method, headers, body: method === "GET" ? undefined : new Uint8Array(payload) });
  } catch (cause) {
    throw new S3RequestError(
      `Object storage unreachable: ${cause instanceof Error ? cause.message : String(cause)}`,
      0,
      bucket,
      key,
    );
  }
}

/** GET an object; throws S3RequestError (status 0 = unreachable, 404 = missing). */
export async function s3GetObject(config: S3FetchConfig, bucket: string, key: string): Promise<Buffer> {
  const response = await executeSigned(config, "GET", bucket, key, {}, Buffer.alloc(0));
  if (response.status === 404) {
    throw new S3RequestError(`Object not found: ${bucket}/${key}`, 404, bucket, key);
  }
  if (!response.ok) {
    throw new S3RequestError(`Object storage returned HTTP ${response.status} for ${bucket}/${key}`, response.status, bucket, key);
  }
  return Buffer.from(await response.arrayBuffer());
}

export type S3PutOptions = Readonly<{
  contentType: string;
  /** When "*", the provider must reject the write if the key already exists. */
  ifNoneMatch?: string;
}>;

/**
 * PUT an object. With ifNoneMatch: "*", a 412 Precondition Failed is thrown
 * as an S3RequestError with status 412 (write-once / no-overwrite semantics,
 * ADR §6.2) — callers map that to their domain error. Other non-2xx statuses
 * throw S3RequestError with the actual status.
 */
export async function s3PutObject(
  config: S3FetchConfig,
  bucket: string,
  key: string,
  bytes: Buffer,
  options: S3PutOptions,
): Promise<void> {
  const extraHeaders: Record<string, string> = { "content-type": options.contentType };
  if (options.ifNoneMatch) extraHeaders["if-none-match"] = options.ifNoneMatch;
  const response = await executeSigned(config, "PUT", bucket, key, extraHeaders, bytes);
  if (response.status === 412) {
    throw new S3RequestError(`Precondition failed (object already exists): ${bucket}/${key}`, 412, bucket, key);
  }
  if (!response.ok) {
    throw new S3RequestError(`Object storage returned HTTP ${response.status} for ${bucket}/${key}`, response.status, bucket, key);
  }
}
