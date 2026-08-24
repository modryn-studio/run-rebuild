CREATE TABLE "trade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"event_id" bigint NOT NULL,
	"symbol_root" text NOT NULL,
	"contract" text,
	"entry_at" timestamp with time zone NOT NULL,
	"exit_at" timestamp with time zone NOT NULL,
	"session_date" date NOT NULL,
	"qty" integer NOT NULL,
	"direction" text,
	"entry_price" numeric(19, 6) NOT NULL,
	"exit_price" numeric(19, 6) NOT NULL,
	"gross_pnl_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'ok' NOT NULL,
	"quarantine_reason" text,
	"exclusion_reason" text,
	"projected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_state_check" CHECK ("trade"."state" in ('ok', 'quarantined', 'excluded')),
	CONSTRAINT "trade_direction_check" CHECK ("trade"."direction" is null or "trade"."direction" in ('long', 'short'))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"trader_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"net_pnl_cents" bigint DEFAULT 0 NOT NULL,
	"fees_cents" bigint DEFAULT 0 NOT NULL,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"first_trade_at" timestamp with time zone,
	"last_trade_at" timestamp with time zone,
	"projected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_trader_id_session_date_pk" PRIMARY KEY("trader_id","session_date")
);
--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_trader_id_trader_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."trader"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_trader_id_trader_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."trader"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_event_uq" ON "trade" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "trade_account_session_idx" ON "trade" USING btree ("account_id","session_date");--> statement-breakpoint
CREATE INDEX "trade_account_exit_idx" ON "trade" USING btree ("account_id","exit_at");--> statement-breakpoint
CREATE INDEX "trade_trader_session_idx" ON "trade" USING btree ("trader_id","session_date");--> statement-breakpoint
CREATE INDEX "trade_state_idx" ON "trade" USING btree ("state");--> statement-breakpoint
CREATE INDEX "session_trader_idx" ON "session" USING btree ("trader_id");