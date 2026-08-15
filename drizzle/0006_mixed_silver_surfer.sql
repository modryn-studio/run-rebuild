-- `funded` -> `sim_funded`. See ACCOUNT_TYPES in schema.ts for why the longer word is the honest
-- one: a prop account is funded by the FIRM and traded in SIMULATION, and `funded` sitting one
-- column away from `personal` (which IS real money) claims something untrue about the trader's risk.
--
-- HAND-EDITED. drizzle-kit generated the DROP and the ADD and nothing between them, because it
-- diffs schema and knows nothing about the rows already under the old constraint. Adding the new
-- CHECK against a table still holding 'funded' fails the migration outright, so the UPDATE is not
-- tidiness — it is the difference between this running and not.
--
-- Ordered DROP -> UPDATE -> ADD deliberately: the old constraint forbids the new value, so the
-- update cannot run while it is still in place.
ALTER TABLE "account" DROP CONSTRAINT "account_type_check";--> statement-breakpoint
UPDATE "account" SET "account_type" = 'sim_funded' WHERE "account_type" = 'funded';--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_type_check" CHECK ("account"."account_type" in ('evaluation', 'sim_funded', 'personal'));
