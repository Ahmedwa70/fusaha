import { pgTable, uuid, text, integer, bigint, smallint, jsonb, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { templates } from "./templates";
import { RuntimeVersionState, RuntimePackageKind } from "./enums";

// Immutable shared runtime package. One row per unique canonical package
// (unique identity_algorithm+identity). Bytes live in object storage via
// runtime_storage_objects/locations; this row is metadata + lifecycle only.
// Rendering a lesson never joins templates/schema_definitions after binding.
export const runtimeVersions = pgTable(
  "runtime_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identity: text("identity").notNull(),
    identityAlgorithm: text("identity_algorithm").notNull(),
    state: smallint("state").notNull().default(RuntimeVersionState.Pending).$type<RuntimeVersionState>(),
    packageKind: smallint("package_kind").notNull().$type<RuntimePackageKind>(),
    entryPoint: text("entry_point").notNull(),
    manifest: jsonb("manifest").notNull(),
    manifestSha256: text("manifest_sha256").notNull(),
    assetCount: integer("asset_count").notNull(),
    packageSizeBytes: bigint("package_size_bytes", { mode: "number" }).notNull(),
    sourceTemplateId: uuid("source_template_id").references(() => templates.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    failureCode: text("failure_code"),
    integrityIssue: text("integrity_issue"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  },
  (table) => [
    unique().on(table.identityAlgorithm, table.identity),
    check("runtime_versions_sha_chk", sql`${table.manifestSha256} ~ '^[0-9a-f]{64}$' AND ${table.identity} ~ '^sha256-v1-[0-9a-f]{64}$'`),
    check("runtime_versions_asset_count_chk", sql`${table.assetCount} >= 1`),
    check("runtime_versions_package_size_chk", sql`${table.packageSizeBytes} >= 0`),
  ],
);
