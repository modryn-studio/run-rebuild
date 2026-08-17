ALTER TABLE "account" ALTER COLUMN "account_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "broker_account_id" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "firm_source" text;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "size_dollars" integer;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "product_name" text;