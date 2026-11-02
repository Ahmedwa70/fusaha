import { pgTable, uuid, text, bigint, smallint, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { RuntimeStorageObjectState } from "./enums";

// Provider-neutral logical object: the stable identity of a stored byte
// sequence. Provider details (bucket/key/generation) live only in
// runtime_storage_locations, so the object layer survives provider migration
// (ADR §9/§10) without touching assets or versions.
export const runtimeStorageObjects = pgTable(
  "runtime_storage_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentSha256: text("content_sha256").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    state: smallint("state").notNull().default(RuntimeStorageObjectState.Staged).$type<RuntimeStorageObjectState>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (table) => [
    check("runtime_storage_objects_sha_chk", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
    check("runtime_storage_objects_size_chk", sql`${table.sizeBytes} >= 0`),
  ],
);
