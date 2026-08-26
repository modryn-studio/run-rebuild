ALTER TABLE "account" DROP CONSTRAINT "account_state_check";--> statement-breakpoint
DROP INDEX "account_trader_state_idx";--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "closed_on" date;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "excluded_from_totals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "account_trader_status_idx" ON "account" USING btree ("trader_id","status");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_status_check" CHECK ("account"."status" in ('active', 'passed', 'failed', 'closed'));--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_type_status_check" CHECK (("account"."account_type" is null and "account"."status" = 'active')
          or ("account"."account_type" = 'personal' and "account"."status" in ('active', 'closed'))
          or ("account"."account_type" in ('evaluation', 'sim_funded') and "account"."status" in ('active', 'passed', 'failed')));