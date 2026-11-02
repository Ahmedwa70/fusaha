import { pgTable, uuid, text, bigint, smallint, timestamp, unique, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { runtimeVersions } from "./runtime-versions";
import { runtimeStorageObjects } from "./runtime-storage-objects";

// Logical package files of a runtime_version. Content-addressed: one
// runtime_storage_objects row may back many assets across packages (identical
// files share one object — dedupe proven in the POC), so there is deliberately
// NO unique on storage_object_id here.
export const runtimeAssets = pgTable(
  "runtime_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runtimeVersionId: uuid("runtime_version_id")
      .notNull()
      .references(() => runtimeVersions.id, { onDelete: "restrict" }),
    storageObjectId: uuid("storage_object_id")
      .notNull()
      .references(() => runtimeStorageObjects.id, { onDelete: "restrict" }),
    path: text("path").notNull(),
    contentSha256: text("content_sha256").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    providerGeneration: text("provider_generation"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.runtimeVersionId, table.path),
    check("runtime_assets_sha_chk", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
    check("runtime_assets_size_chk", sql`${table.sizeBytes} >= 0`),
    index("runtime_assets_object_idx").on(table.storageObjectId),
  ],
);
