-- `event` IS APPEND-ONLY TO THE APPLICATION, and this makes that real rather than aspirational.
--
-- Ported from run-trading@v2, which is the one piece of that build's ingest worth taking
-- verbatim. Everything else in the doctrine is a convention a future writer can forget; this is
-- the only one the database itself refuses to break.
--
-- WHY A TRIGGER AND NOT A REVOKE. Revoking UPDATE/DELETE from the app role would also block the
-- erasure path, and would be invisible in the schema — a future reader would find no explanation
-- for a permission denied. A trigger states its own reason in the error message.
--
-- THE ONE SANCTIONED MUTATION is the privileged erasure path (a "delete me" request), which sets
-- `run.privileged = 'on'` for its transaction. Normal app connections never set it, so every
-- ordinary UPDATE or DELETE raises. Corrections do not need this: a bust or an adjustment APPENDS
-- a new row pointing at the original via `corrects_event_id`.
--
-- `current_setting(..., true)` is the missing_ok form: without the second argument this throws
-- `unrecognized configuration parameter` on every connection that has never set it, which is all
-- of them, and the trigger would fail closed on inserts it should not touch.
--
-- HAND-WRITTEN, and it must stay that way. `drizzle-kit generate` diffs the schema file and knows
-- nothing about triggers, so it will neither create this nor drop it. Adding it to a generated
-- migration would mean it disappears the next time that migration is regenerated.
CREATE OR REPLACE FUNCTION run_block_event_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('run.privileged', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'event is append-only: % blocked (use the privileged erasure path)', TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS event_append_only ON "event";--> statement-breakpoint
CREATE TRIGGER event_append_only
  BEFORE UPDATE OR DELETE ON "event"
  FOR EACH ROW EXECUTE FUNCTION run_block_event_mutation();
