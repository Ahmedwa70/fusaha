// Runtime content store: the storage boundary the Phase 5 publisher writes
// through. One implementation today — S3-compatible (SigV4, node:crypto only)
// — over the shared signer in ./s3-sigv4. Storage-facing semantics follow ADR
// §6.2: objects are write-once (If-None-Match: * at the provider level), and
// byte identity is verified with an independent SHA-256, never ETag.

import { s3GetObject, s3PutObject, S3RequestError, type S3FetchConfig } from "./s3-sigv4";

export type RuntimeContentStoreErrorCode =
  | "content-store-unavailable"
  | "content-store-not-found"
  | "content-store-key-conflict"
  | "content-store-unconfigured";

export class RuntimeContentStoreError extends Error {
  readonly code: RuntimeContentStoreErrorCode;

  constructor(message: string, code: RuntimeContentStoreErrorCode) {
    super(message);
    this.name = "RuntimeContentStoreError";
    this.code = code;
  }
}

export type PutIfAbsentResult = "created" | "exists";

export interface RuntimeContentStore {
  /**
   * Write-once PUT: the provider must reject the write if the key already
   * exists. When it already exists, the stored bytes are fetched and compared;
   * identical bytes are an exact dedupe ("exists"), different bytes are a
   * hard conflict (a content-addressed key must never change its bytes).
   */
  putIfAbsent(key: string, bytes: Buffer, contentType: string): Promise<PutIfAbsentResult>;
  /** GET; throws content-store-not-found when the key does not exist. */
  get(key: string): Promise<Buffer>;
}

export function createS3RuntimeContentStore(config: S3FetchConfig | null, bucket: string): RuntimeContentStore {
  return {
    async putIfAbsent(key, bytes, contentType) {
      if (!config) {
        throw new RuntimeContentStoreError(
          "Runtime content store is not configured (set RUNTIME_CONTENT_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY and RUNTIME_CONTENT_S3_BUCKET).",
          "content-store-unconfigured",
        );
      }
      try {
        await s3PutObject(config, bucket, key, bytes, { contentType, ifNoneMatch: "*" });
        return "created";
      } catch (error) {
        if (error instanceof S3RequestError && error.status === 412) {
          const existing = await this.get(key);
          if (!existing.equals(bytes)) {
            throw new RuntimeContentStoreError(
              `Object key conflict with different bytes at ${bucket}/${key}`,
              "content-store-key-conflict",
            );
          }
          return "exists";
        }
        throw toStoreError(error, bucket, key);
      }
    },

    async get(key) {
      if (!config) {
        throw new RuntimeContentStoreError(
          "Runtime content store is not configured (set RUNTIME_CONTENT_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY and RUNTIME_CONTENT_S3_BUCKET).",
          "content-store-unconfigured",
        );
      }
      try {
        return await s3GetObject(config, bucket, key);
      } catch (error) {
        throw toStoreError(error, bucket, key);
      }
    },
  };
}

function toStoreError(error: unknown, bucket: string, key: string): RuntimeContentStoreError {
  if (error instanceof RuntimeContentStoreError) return error;
  if (error instanceof S3RequestError && error.status === 404) {
    return new RuntimeContentStoreError(`Object not found: ${bucket}/${key}`, "content-store-not-found");
  }
  const message = error instanceof Error ? error.message : String(error);
  return new RuntimeContentStoreError(`Object storage error for ${bucket}/${key}: ${message}`, "content-store-unavailable");
}

export type S3StoreConfig = Readonly<{
  config: S3FetchConfig | null;
  bucket: string;
}>;

/**
 * Reads the publish-side storage configuration from the environment.
 * RUNTIME_CONTENT_S3_BUCKET names the publish target; without it (or any of
 * the connection variables) the store is inert and fails closed at first use.
 */
export function readS3StoreConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3StoreConfig {
  const endpoint = env.RUNTIME_CONTENT_S3_ENDPOINT;
  const accessKey = env.RUNTIME_CONTENT_S3_ACCESS_KEY;
  const secretKey = env.RUNTIME_CONTENT_S3_SECRET_KEY;
  const bucket = env.RUNTIME_CONTENT_S3_BUCKET;
  const config = endpoint && accessKey && secretKey
    ? { endpoint, accessKey, secretKey, region: env.RUNTIME_CONTENT_S3_REGION || "us-east-1" }
    : null;
  return { config, bucket: bucket ?? "" };
}
