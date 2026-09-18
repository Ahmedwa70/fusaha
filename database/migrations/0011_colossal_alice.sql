CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"html_player" text NOT NULL,
	"empty_template" text NOT NULL,
	"blueprint" text NOT NULL,
	"validation_script" text NOT NULL,
	"preview_image" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD CONSTRAINT "schema_definitions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;