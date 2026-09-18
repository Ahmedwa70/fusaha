ALTER TABLE "level_definitions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "level_definitions" CASCADE;--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD COLUMN "level" text;--> statement-breakpoint
UPDATE "schema_definitions" SET "level" = 'المستوى الأول' WHERE "level" IS NULL;--> statement-breakpoint
ALTER TABLE "schema_definitions" ALTER COLUMN "level" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "schema_definitions" DROP CONSTRAINT "schema_definitions_pkey";--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD CONSTRAINT "schema_definitions_level_version_pk" PRIMARY KEY("level","version");
