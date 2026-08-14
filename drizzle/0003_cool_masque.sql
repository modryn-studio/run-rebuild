CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"prop_firm" text,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"account_type" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_type_check" CHECK ("account"."account_type" in ('evaluation', 'funded', 'personal')),
	CONSTRAINT "account_state_check" CHECK ("account"."state" in ('active', 'closed', 'breached'))
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"trader_id" uuid NOT NULL,
	"account_id" uuid,
	"import_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"pnl_cents" bigint,
	"symbol" text,
	"qty" integer,
	"side" text,
	"corrects_event_id" bigint,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text,
	CONSTRAINT "event_type_check" CHECK ("event"."type" in ('fill', 'round_trip', 'fee', 'order', 'csv_import')),
	CONSTRAINT "event_source_check" CHECK ("event"."source" in ('csv', 'api', 'app')),
	CONSTRAINT "event_side_check" CHECK ("event"."side" is null or "event"."side" in ('buy', 'sell'))
);
--> statement-breakpoint
CREATE TABLE "import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trader_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_hash" text NOT NULL,
	"source" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rows_parsed" integer DEFAULT 0 NOT NULL,
	"rows_rejected" integer DEFAULT 0 NOT NULL,
	"range_start" date,
	"range_end" date,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "import_source_check" CHECK ("import"."source" in ('tradovate_csv', 'tradezella_csv', 'tradovate_oauth')),
	CONSTRAINT "import_status_check" CHECK ("import"."status" in ('pending', 'committed', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_trader_id_trader_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."trader"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_trader_id_trader_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."trader"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_import_id_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."import"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_corrects_fk" FOREIGN KEY ("corrects_event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import" ADD CONSTRAINT "import_trader_id_trader_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."trader"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import" ADD CONSTRAINT "import_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_identity_uq" ON "account" USING btree ("trader_id","platform","external_account_id");--> statement-breakpoint
CREATE INDEX "account_trader_idx" ON "account" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "account_trader_state_idx" ON "account" USING btree ("trader_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "event_account_dedupe_uq" ON "event" USING btree ("account_id","dedupe_key") WHERE "event"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "event_trader_idx" ON "event" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "event_account_idx" ON "event" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "event" USING btree ("type");--> statement-breakpoint
CREATE INDEX "event_import_idx" ON "event" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "event_account_occurred_idx" ON "event" USING btree ("account_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "import_file_uq" ON "import" USING btree ("account_id","file_hash");--> statement-breakpoint
CREATE INDEX "import_trader_idx" ON "import" USING btree ("trader_id");