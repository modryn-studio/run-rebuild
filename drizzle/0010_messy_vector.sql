ALTER TABLE "account" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
-- HAND-EDITED (S5c). drizzle-kit generates the column change and nothing else, which would leave
-- every account already imported carrying a display_name Run wrote itself: the raw
-- external_account_id, auto-filled at creation. `accountRowTitle` returns display_name FIRST
-- because it means "what the trader called this", so those rows would keep printing
-- FTDFYL100183704873 forever while the composed "Tradeify (...4873)" was never reached.
--
-- Matched on equality with external_account_id, which is the auto-fill's exact signature. A trader
-- who deliberately typed their account number as its name is caught too, and loses nothing: with
-- no firm known the composed title falls back to that same string.
UPDATE "account" SET "display_name" = NULL WHERE "display_name" = "external_account_id";
