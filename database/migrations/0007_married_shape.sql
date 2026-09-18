ALTER TABLE "schema_definitions" DROP CONSTRAINT "schema_definitions_level_version_pk";--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD CONSTRAINT "schema_definitions_level_version_unique" UNIQUE("level","version");