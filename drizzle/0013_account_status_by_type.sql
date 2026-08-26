ALTER TABLE "account" DROP CONSTRAINT "account_type_status_check";--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_type_status_check" CHECK (("account"."account_type" is null and "account"."status" = 'active')
          or ("account"."account_type" = 'personal' and "account"."status" in ('active', 'closed'))
          or ("account"."account_type" = 'evaluation' and "account"."status" in ('active', 'passed', 'failed'))
          or ("account"."account_type" = 'sim_funded' and "account"."status" in ('active', 'failed', 'closed')));