import { pgTable, uuid, text, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";
import { runtimeStorageObjects } from "./runtime-storage-objects";

// Adapter-owned physical placement of a runtime_storage_objects row.
// Provider migration inserts a new non-primary location, verifies, and
// switches primary in a transaction — identity, asset paths, and lesson
// bindings never change (ADR §10).
export const runtimeStorageLocations = pgTable(
  "runtime_storage_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageObjectId: uuid("storage_object_id")
      .notNull()
      .references(() => runtimeStorageObjects.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    providerGeneration: text("provider_generation"),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    unique().on(table.provider, table.bucket, table.objectKey),
    index("runtime_storage_locations_object_idx").on(table.storageObjectId),
  ],
);
