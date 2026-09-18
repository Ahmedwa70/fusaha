ALTER TABLE "users" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paddle_customer_id" text;--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN "stripe_session_id";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN "stripe_payment_method";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "paddle_transaction_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "paddle_payment_method" text;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD COLUMN "paddle_price_id" text;
