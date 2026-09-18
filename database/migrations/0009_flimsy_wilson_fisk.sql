ALTER TYPE "public"."ledger_reason" ADD VALUE IF NOT EXISTS 'generation';--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD COLUMN "schema_definition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_schema_definition_id_schema_definitions_id_fk" FOREIGN KEY ("schema_definition_id") REFERENCES "public"."schema_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "lesson_versions" DROP COLUMN "schema_version";