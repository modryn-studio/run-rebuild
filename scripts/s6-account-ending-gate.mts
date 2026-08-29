/* DOES THE VOCABULARY TABLE STILL AGREE WITH THE DATABASE? All 16 pairs, against the LIVE CHECK.
 *
 *   npx tsx --env-file=.env.local --conditions=react-server scripts/s6-account-ending-gate.mts
 *
 * `ACCOUNT_ENDINGS` in `lib/prop-firms.ts` is `account_type_status_check` restated in a layer a
 * client component can import - which is the only way a screen can ASK "how did it end" before the
 * constraint refuses the answer. Two statements of one rule is exactly the drift this repo's own
 * comments spend paragraphs warning about, so this gate reads the constraint out of `pg_constraint`
 * and evaluates it, in Postgres, for every (type, status) pair. It never writes.
 *
 * IT EVALUATES THE REAL EXPRESSION rather than re-parsing it. Substituting the two column names and
 * asking the database to answer means the gate cannot drift from the constraint by misreading it -
 * whatever Postgres thinks the rule is, is what gets compared.
 *
 * WHY THIS GATE EXISTS: `docs/scar-tissue.md`, "A CHECK the UI could reach, and no question in front
 * of it". A closed sim-funded account relabelled as an evaluation, refused correctly by the
 * database and delivered to the trader as a 500. */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ACCOUNT_ENDINGS, accountStatusFits } from '@/lib/prop-firms';

const TYPES = [null, 'evaluation', 'sim_funded', 'personal'] as const;
const STATUSES = ['active', 'passed', 'failed', 'closed'] as const;

const rows = (
  await db.execute(
    sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'account_type_status_check'`
  )
).rows as { def: string }[];
const def = rows[0].def.replace(/^CHECK\s*/i, '');
console.log('LIVE CHECK:', def.replace(/\s+/g, ' '));

let bad = 0;
for (const t of TYPES) {
  for (const s of STATUSES) {
    const expr = def
      .replace(/account_type/g, t === null ? `null::text` : `'${t}'::text`)
      .replace(/status/g, `'${s}'::text`);
    const r = (await db.execute(sql.raw(`select (${expr}) as ok`))).rows as {
      ok: boolean | null;
    }[];
    const dbSays = r[0].ok === true;
    const weSay = accountStatusFits(t, s);
    if (dbSays !== weSay) {
      bad++;
      console.log(`MISMATCH ${t} + ${s}: db=${dbSays} table=${weSay}`);
    }
  }
}
console.log('endings:', JSON.stringify(ACCOUNT_ENDINGS));
console.log(bad === 0 ? 'PASS: all 16 pairs agree' : `FAIL: ${bad} mismatched`);
process.exit(bad === 0 ? 0 : 1);
