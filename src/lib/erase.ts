import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db, authUser } from '@/lib/db';

/* ERASE ONE TRADER: every row they own, then the sign-in itself. The one owner of this SQL, called
 * by `/api/trader/erase` and proven by `scripts/erase-gate.mts` - two callers, one block, so the
 * gate exercises the statement the route runs and not a copy of it.
 *
 * ONE STATEMENT, AND IT HAS TO BE. `event` refuses DELETE unless `run.privileged` is on, and
 * `set_config(..., true)` is TRANSACTION-local; neon-http has no interactive transactions, so a
 * `set_config` call followed by a `DELETE` call loses the flag between them and the trigger
 * correctly refuses. A DO block is one statement, so the PERFORM and every DELETE share a
 * transaction. `s4-gate.mts` measured this and says "whatever builds the real erasure path must do
 * the same"; `import-recovery-gate.mts` uses the identical block. This is that path.
 *
 * THE ID IS INLINED, NOT BOUND, and that needs an argument because it is the one thing this repo
 * never otherwise does. A DO block takes no bind parameters (Postgres: "bind message supplies 1
 * parameters, but prepared statement requires 0" - hit live while writing the recovery gate). So the
 * value is checked against a strict charset FIRST: Better Auth ids are URL-safe base62, and
 * anything outside `[A-Za-z0-9_-]` is refused, not escaped. Nothing that can carry a quote reaches
 * the string. The caller is expected to have taken the id from the SESSION, never a request.
 *
 * ORDER: children before parents, `event` first because it is the guarded one. `trade` and `session`
 * are rebuildable projections, but they are also the trader's data and go with everything else.
 * `auth_user` last, through drizzle, and its FK cascades take `auth_session`, `auth_account` and
 * `analytics_event` - which makes `track.ts`'s "cascades on delete" true by this function existing.
 *
 * AT BETA SCALE THIS IS SYNCHRONOUS AND FINISHES. #42 measured 130,809 events timing out on a
 * 0.25 CU compute; ten traders with a few thousand rows each are two orders of magnitude under
 * that. The public-launch shape - chunked deletes or a background job - is #42's remaining scope.
 */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export async function eraseTrader(authUserId: string): Promise<{ elapsedMs: number }> {
  if (!ID_SHAPE.test(authUserId)) {
    // Cannot happen with Better Auth's ids. If it ever does, refusing is the only safe answer.
    throw new Error(`auth user id outside the inlinable charset (${authUserId.length} chars)`);
  }

  const started = Date.now();
  await db.execute(
    sql.raw(`
      DO $$
      DECLARE tid uuid;
      BEGIN
        SELECT id INTO tid FROM trader WHERE auth_user_id = '${authUserId}';
        IF tid IS NULL THEN RETURN; END IF;
        PERFORM set_config('run.privileged', 'on', true);
        DELETE FROM "event"   WHERE trader_id = tid;
        DELETE FROM "trade"   WHERE trader_id = tid;
        DELETE FROM "session" WHERE trader_id = tid;
        DELETE FROM "import"  WHERE trader_id = tid;
        DELETE FROM "account" WHERE trader_id = tid;
        DELETE FROM "trader"  WHERE id = tid;
      END $$;
    `)
  );
  await db.delete(authUser).where(eq(authUser.id, authUserId));
  return { elapsedMs: Date.now() - started };
}
