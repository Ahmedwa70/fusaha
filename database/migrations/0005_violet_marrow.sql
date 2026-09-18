CREATE TABLE "level_definitions" (
	"level_number" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"definition" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_definitions" (
	"version" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
