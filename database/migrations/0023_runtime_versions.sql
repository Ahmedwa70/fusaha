-- Immutable Runtime Versions registry (FUSAHA-ARCH-TR-003, ADR PERSISTENT_RUNTIME_STORAGE).
-- Expand phase only: five new tables + two additive nullable/defaulted columns on
-- lesson_versions. Nothing existing is altered or backfilled; every current row
-- stays runtime_binding_status = 0 (Unbound) and renders exactly as before.
-- The ADR §5.4 triple unique (algorithm, identity, fingerprint) is deliberately
-- NOT created — decision 2026-11-01 (design doc §11); a non-unique reconciliation
-- index replaces it.

CREATE TABLE "runtime_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity" text NOT NULL,
	"identity_algorithm" text NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"package_kind" smallint NOT NULL,
	"entry_point" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_sha256" text NOT NULL,
	"asset_count" integer NOT NULL,
	"package_size_bytes" bigint NOT NULL,
	"source_template_id" uuid,
	"created_by" uuid,
	"failure_code" text,
	"integrity_issue" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	CONSTRAINT "runtime_versions_identity_uk" UNIQUE("identity_algorithm", "identity"),
	CONSTRAINT "runtime_versions_sha_chk" CHECK ("manifest_sha256" ~ '^[0-9a-f]{64}$' AND "identity" ~ '^sha256-v1-[0-9a-f]{64}$'),
	CONSTRAINT "runtime_versions_asset_count_chk" CHECK ("asset_count" >= 1),
	CONSTRAINT "runtime_versions_package_size_chk" CHECK ("package_size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "runtime_versions" ADD CONSTRAINT "runtime_versions_source_template_id_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "runtime_versions" ADD CONSTRAINT "runtime_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "runtime_storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_sha256" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_type" text NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	CONSTRAINT "runtime_storage_objects_sha_chk" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "runtime_storage_objects_size_chk" CHECK ("size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "runtime_storage_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_object_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"provider_generation" text,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "runtime_storage_locations_uk" UNIQUE("provider", "bucket", "object_key")
);
--> statement-breakpoint
ALTER TABLE "runtime_storage_locations" ADD CONSTRAINT "rt_storage_locations_object_fk" FOREIGN KEY ("storage_object_id") REFERENCES "public"."runtime_storage_objects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "runtime_storage_locations_object_idx" ON "runtime_storage_locations" ("storage_object_id");
--> statement-breakpoint
CREATE TABLE "runtime_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_version_id" uuid NOT NULL,
	"storage_object_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content_sha256" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_type" text NOT NULL,
	"provider_generation" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_assets_path_uk" UNIQUE("runtime_version_id", "path"),
	CONSTRAINT "runtime_assets_sha_chk" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "runtime_assets_size_chk" CHECK ("size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "runtime_assets" ADD CONSTRAINT "runtime_assets_runtime_version_id_runtime_versions_id_fk" FOREIGN KEY ("runtime_version_id") REFERENCES "public"."runtime_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "runtime_assets" ADD CONSTRAINT "runtime_assets_storage_object_id_runtime_storage_objects_id_fk" FOREIGN KEY ("storage_object_id") REFERENCES "public"."runtime_storage_objects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "runtime_assets_object_idx" ON "runtime_assets" ("storage_object_id");
--> statement-breakpoint
CREATE TABLE "runtime_publication_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_version_id" uuid,
	"identity_algorithm" text NOT NULL,
	"runtime_identity" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"fencing_token" bigint DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"staging_namespace" text NOT NULL,
	"expected_asset_count" integer NOT NULL,
	"expected_package_size_bytes" bigint NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "runtime_publication_attempts_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "runtime_publication_attempts_expected_asset_count_chk" CHECK ("expected_asset_count" > 0),
	CONSTRAINT "runtime_publication_attempts_expected_size_chk" CHECK ("expected_package_size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "runtime_publication_attempts" ADD CONSTRAINT "rt_pub_attempts_version_fk" FOREIGN KEY ("runtime_version_id") REFERENCES "public"."runtime_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "runtime_publication_attempts_state_idx" ON "runtime_publication_attempts" ("state");
--> statement-breakpoint
CREATE INDEX "runtime_publication_attempts_lease_idx" ON "runtime_publication_attempts" ("lease_expires_at");
--> statement-breakpoint
CREATE INDEX "runtime_publication_attempts_identity_idx" ON "runtime_publication_attempts" ("runtime_identity");
--> statement-breakpoint
CREATE INDEX "runtime_publication_attempts_version_idx" ON "runtime_publication_attempts" ("runtime_version_id");
--> statement-breakpoint
-- Non-unique reconciliation index (design doc §11): replaces the rejected ADR §5.4 triple unique.
CREATE INDEX "runtime_publication_attempts_fingerprint_idx" ON "runtime_publication_attempts" ("identity_algorithm", "runtime_identity", "request_fingerprint");
--> statement-breakpoint
-- Expand phase: additive nullable column + defaulted status column. No backfill,
-- no behavior change; existing rows remain Unbound (0).
ALTER TABLE "lesson_versions" ADD COLUMN "runtime_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD COLUMN "runtime_binding_status" smallint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_runtime_version_id_runtime_versions_id_fk" FOREIGN KEY ("runtime_version_id") REFERENCES "public"."runtime_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Bound(1)/Legacy(2) require a runtime; Unbound(0)/Quarantined(3)/Unrecoverable(4) may be null.
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_binding_chk" CHECK ("runtime_binding_status" IN (0, 3, 4) OR "runtime_version_id" IS NOT NULL);
--> statement-breakpoint
CREATE INDEX "lesson_versions_runtime_idx" ON "lesson_versions" ("runtime_version_id");
