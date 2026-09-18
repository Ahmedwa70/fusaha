ALTER TABLE "credit_packages" ADD COLUMN "badge_label" text;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "footer_text" text;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "features" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "color_light" text;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "color_dark" text;