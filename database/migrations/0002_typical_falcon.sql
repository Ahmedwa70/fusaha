ALTER TABLE "roles" ADD COLUMN "title" text;--> statement-breakpoint
UPDATE "roles" SET "title" = "name" WHERE "title" IS NULL;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;