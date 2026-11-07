import { createHash } from "node:crypto";
import { signRequest } from "./sigv4";

// Server-side client for the library's PRIVATE Cloudflare R2 bucket.
// There is deliberately no presigned-URL path and no public base URL: every
// byte is fetched server-side through the permission-checked API routes, so
// the R2 hostname/object keys never reach the browser.

export type LibraryR2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function getLibraryR2Config(env: NodeJS.ProcessEnv = process.env): LibraryR2Config {
  const accountId = env.LIBRARY_R2_ACCOUNT_ID;
  const accessKeyId = env.LIBRARY_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.LIBRARY_R2_SECRET_ACCESS_KEY;
  const bucket = env.LIBRARY_R2_BUCKET_NAME;
  const missing = [
    ["LIBRARY_R2_ACCOUNT_ID", accountId],
    ["LIBRARY_R2_ACCESS_KEY_ID", accessKeyId],
    ["LIBRARY_R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["LIBRARY_R2_BUCKET_NAME", bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Library R2 is not configured; missing env: ${missing.join(", ")}`);
  }
  return { accountId, accessKeyId, secretAccessKey, bucket } as LibraryR2Config;
}

export function libraryR2Host(config: LibraryR2Config): string {
  return `${config.accountId}.r2.cloudflarestorage.com`;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function signedFetch(config: LibraryR2Config, method: "GET" | "PUT" | "HEAD", key: string, init: { body?: Buffer; contentType?: string; range?: string } = {}) {
  const host = libraryR2Host(config);
  const path = `/${config.bucket}/${encodeKey(key)}`;
  const payloadHash = init.body ? createHash("sha256").update(init.body).digest("hex") : "UNSIGNED-PAYLOAD";
  const signed = signRequest({ method, host, path, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, payloadHash, extraHeaders: init.range ? { range: init.range } : undefined });
  const headers: Record<string, string> = { ...signed.headers };
  if (init.contentType) headers["content-type"] = init.contentType;
  if (init.range) headers["range"] = init.range;
  const body = init.body ? new Uint8Array(init.body) : undefined;
  return fetch(`https://${host}${path}`, { method, headers, body });
}

export async function putLibraryObject(key: string, body: Buffer, contentType: string, config = getLibraryR2Config()): Promise<void> {
  const response = await signedFetch(config, "PUT", key, { body, contentType });
  if (!response.ok) {
    throw new Error(`R2 PUT failed for library object: HTTP ${response.status}`);
  }
}

export type LibraryObject = {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
};

export async function getLibraryObject(key: string, config = getLibraryR2Config()): Promise<LibraryObject> {
  const response = await signedFetch(config, "GET", key);
  if (!response.ok || !response.body) {
    throw new Error(`R2 GET failed for library object: HTTP ${response.status}`);
  }
  return {
    body: response.body,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.has("content-length") ? Number(response.headers.get("content-length")) : null,
  };
}

export type LibraryObjectRange =
  | { status: 206; body: ReadableStream<Uint8Array>; start: number; end: number; total: number }
  | { status: 416; total: number };

// Byte-range fetch for PDF viewers that issue Range requests. The range
// header is part of the SigV4 signature; a tampered or resigned range is
// rejected by R2 itself.
export async function getLibraryObjectRange(key: string, rangeHeader: string, config = getLibraryR2Config()): Promise<LibraryObjectRange> {
  const response = await signedFetch(config, "GET", key, { range: rangeHeader });
  if (response.status === 416 || !response.body) {
    const total = Number(response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("content-length") ?? 0) || 0;
    return { status: 416, total };
  }
  if (response.status !== 206) {
    throw new Error(`R2 range GET failed for library object: HTTP ${response.status}`);
  }
  const contentRange = response.headers.get("content-range") ?? "";
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
  if (!match) {
    throw new Error(`R2 range GET returned unparsable Content-Range: ${contentRange}`);
  }
  return {
    status: 206,
    body: response.body,
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
}
