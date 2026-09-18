CREATE TABLE "generation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid,
	"teacher_id" uuid,
	"source_type" smallint,
	"success" boolean NOT NULL,
	"duration_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_events" ADD CONSTRAINT "generation_events_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;