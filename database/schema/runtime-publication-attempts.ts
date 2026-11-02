import { pgTable, uuid, text, integer, bigint, smallint, timestamp, unique, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { runtimeVersions } from "./runtime-versions";
import { RuntimePublicationAttemptState } from "./enums";

// Durable idempotency, leases, and fencing for runtime publication.
// unique(idempotency_key) is the caller's retry identity. The ADR §5.4 triple
// unique (algorithm, identity, fingerprint) is deliberately NOT used:
// request_fingerprint ≡ identity under the frozen contract, so the triple
// degenerates to (algorithm, identity) — redundant with
// runtime_versions unique(identity_algorithm, identity) — while forbidding
// the proven-safe case of two different idempotency keys attempting the same
// package concurrently (decision 2026-11-01, design doc §11). Key reuse with a
// different package is rejected by the fingerprint-conflict check (finding F2).
export const runtimePublicationAttempts = pgTable(
  "runtime_publication_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runtimeVersionId: uuid("runtime_version_id").references(() => runtimeVersions.id, { onDelete: "restrict" }),
    identityAlgorithm: text("identity_algorithm").notNull(),
    runtimeIdentity: text("runtime_identity").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: smallint("state")
      .notNull()
      .default(RuntimePublicationAttemptState.Created)
      .$type<RuntimePublicationAttemptState>(),
    leaseOwner: text("lease_owner"),
    fencingToken: bigint("fencing_token", { mode: "number" }).notNull().default(0),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    stagingNamespace: text("staging_namespace").notNull(),
    expectedAssetCount: integer("expected_asset_count").notNull(),
    expectedPackageSizeBytes: bigint("expected_package_size_bytes", { mode: "number" }).notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique().on(table.idempotencyKey),
    check("runtime_publication_attempts_expected_asset_count_chk", sql`${table.expectedAssetCount} > 0`),
    check("runtime_publication_attempts_expected_size_chk", sql`${table.expectedPackageSizeBytes} >= 0`),
    index("runtime_publication_attempts_state_idx").on(table.state),
    index("runtime_publication_attempts_lease_idx").on(table.leaseExpiresAt),
    index("runtime_publication_attempts_identity_idx").on(table.runtimeIdentity),
    index("runtime_publication_attempts_version_idx").on(table.runtimeVersionId),
    // Non-unique reconciliation index (decision §11 of the design doc).
    index("runtime_publication_attempts_fingerprint_idx").on(
      table.identityAlgorithm,
      table.runtimeIdentity,
      table.requestFingerprint,
    ),
  ],
);
