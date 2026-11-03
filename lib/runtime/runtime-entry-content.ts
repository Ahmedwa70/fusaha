import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { db as appDb } from "@/lib/db";
import {
  runtimeVersions,
  runtimeAssets,
  runtimeStorageObjects,
  runtimeStorageLocations,
} from "@/database/schema";
import { s3GetObject, S3RequestError } from "./s3-sigv4";

// Reads the entry-point bytes of a published runtime version for the Phase 4
// play path. Provider-neutral at the database layer (runtime_storage_locations
// carries provider/bucket/object_key); only the "s3-compatible" provider label
// has a fetch implementation today — anything else fails closed rather than
// guessing. Bytes are verified against the content SHA-256 recorded in
// runtime_storage_objects, never the provider ETag.
//
// Configuration comes from the environment so the reader stays inert until an
// operator wires a storage endpoint; with no configuration, reads fail closed
// with "runtime-content-reader-unconfigured" instead of throwing at module load.

export type RuntimeEntryContentErrorCode =
  | "runtime-content-not-found"
  | "runtime-content-reader-unconfigured"
  | "runtime-content-provider-unsupported"
  | "runtime-content-storage-unavailable"
  | "runtime-content-integrity-failure";

export class RuntimeEntryContentError extends Error {
  readonly code: RuntimeEntryContentErrorCode;

  constructor(message: string, code: RuntimeEntryContentErrorCode) {
    super(message);
    this.name = "RuntimeEntryContentError";
    this.code = code;
  }
}

export type RuntimeEntryContent = Readonly<{
  html: string;
  contentType: string;
  runtimeIdentity: string;
  entryPoint: string;
  sizeBytes: number;
  sha256: string;
}>;

export interface RuntimeEntryContentReader {
  read(runtimeVersionId: string): Promise<RuntimeEntryContent>;
}

// Re-exported for existing callers; the canonical definition (and the signing
// implementation) now lives in ./s3-sigv4, shared with the Phase 5 publisher.
export type { S3FetchConfig } from "./s3-sigv4";
import type { S3FetchConfig } from "./s3-sigv4";

const S3_PROVIDER_LABEL = "s3-compatible";
const sha256Hex = (data: Buffer) => createHash("sha256").update(data).digest("hex");

export function readS3FetchConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3FetchConfig | null {
  const endpoint = env.RUNTIME_CONTENT_S3_ENDPOINT;
  const accessKey = env.RUNTIME_CONTENT_S3_ACCESS_KEY;
  const secretKey = env.RUNTIME_CONTENT_S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return {
    endpoint,
    accessKey,
    secretKey,
    region: env.RUNTIME_CONTENT_S3_REGION || "us-east-1",
  };
}

// GETs go through the shared SigV4 client in ./s3-sigv4; transport failures are
// mapped here to the reader's domain error codes.
async function fetchEntryObject(config: S3FetchConfig, bucket: string, key: string): Promise<Buffer> {
  try {
    return await s3GetObject(config, bucket, key);
  } catch (error) {
    if (error instanceof S3RequestError) {
      if (error.status === 404) {
        throw new RuntimeEntryContentError(`Runtime entry object not found: ${bucket}/${key}`, "runtime-content-not-found");
      }
      throw new RuntimeEntryContentError(
        `Runtime content storage error for ${bucket}/${key}: ${error.message}`,
        "runtime-content-storage-unavailable",
      );
    }
    throw error;
  }
}

type EntryLocationRow = Readonly<{
  runtimeId: string;
  identity: string;
  entryPoint: string;
  contentSha256: string;
  sizeBytes: number;
  provider: string;
  bucket: string;
  objectKey: string;
}>;

export function createS3CompatibleEntryContentReader(db: typeof appDb, config: S3FetchConfig | null): RuntimeEntryContentReader {
  return {
    async read(runtimeVersionId: string): Promise<RuntimeEntryContent> {
      if (!config) {
        // Fail closed: the cutover flag may be on while storage is not wired.
        throw new RuntimeEntryContentError(
          "Runtime content reader is not configured (set RUNTIME_CONTENT_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY).",
          "runtime-content-reader-unconfigured"
        );
      }

      const rows = await db
        .select({
          runtimeId: runtimeVersions.id,
          identity: runtimeVersions.identity,
          entryPoint: runtimeVersions.entryPoint,
          contentSha256: runtimeStorageObjects.contentSha256,
          sizeBytes: runtimeStorageObjects.sizeBytes,
          provider: runtimeStorageLocations.provider,
          bucket: runtimeStorageLocations.bucket,
          objectKey: runtimeStorageLocations.objectKey,
        })
        .from(runtimeVersions)
        .innerJoin(
          runtimeAssets,
          and(eq(runtimeAssets.runtimeVersionId, runtimeVersions.id), eq(runtimeAssets.path, runtimeVersions.entryPoint))
        )
        .innerJoin(runtimeStorageObjects, eq(runtimeStorageObjects.id, runtimeAssets.storageObjectId))
        .innerJoin(
          runtimeStorageLocations,
          and(
            eq(runtimeStorageLocations.storageObjectId, runtimeStorageObjects.id),
            eq(runtimeStorageLocations.isPrimary, true)
          )
        )
        .where(eq(runtimeVersions.id, runtimeVersionId))
        .limit(1);

      const row: EntryLocationRow | undefined = rows[0];
      if (!row) {
        throw new RuntimeEntryContentError(
          `No published entry asset/location for runtime version: ${runtimeVersionId}`,
          "runtime-content-not-found"
        );
      }
      if (row.provider !== S3_PROVIDER_LABEL) {
        throw new RuntimeEntryContentError(
          `Unsupported runtime content provider "${row.provider}" (only "${S3_PROVIDER_LABEL}" can be fetched).`,
          "runtime-content-provider-unsupported"
        );
      }

      const bytes = await fetchEntryObject(config, row.bucket, row.objectKey);
      const actualSha256 = sha256Hex(bytes);
      if (actualSha256 !== row.contentSha256) {
        throw new RuntimeEntryContentError(
          `Runtime entry bytes failed SHA-256 verification (expected ${row.contentSha256}, got ${actualSha256}).`,
          "runtime-content-integrity-failure"
        );
      }
      return {
        html: bytes.toString("utf8"),
        contentType: "text/html; charset=utf-8",
        runtimeIdentity: row.identity,
        entryPoint: row.entryPoint,
        sizeBytes: row.sizeBytes,
        sha256: actualSha256,
      };
    },
  };
}

let defaultReader: RuntimeEntryContentReader | undefined;

// Lazily built so importing this module never requires storage configuration.
export function getDefaultRuntimeEntryContentReader(): RuntimeEntryContentReader {
  if (!defaultReader) {
    defaultReader = createS3CompatibleEntryContentReader(appDb, readS3FetchConfigFromEnv());
  }
  return defaultReader;
}
