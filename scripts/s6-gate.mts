/* S6a — the roster's numbers must reconcile against the tape's, or the page is not allowed to
 * print them. Re-runnable, read-only, run against whatever corpus is in the dev database. */
import { sql } from 'drizzle-orm';
const { getRoster, getDailySeries, getFreshness } = await import('../src/lib/accounts/read.ts');
const { db } = await import('../src/lib/db/index.ts');
const { trade, trader } = await import('../src/lib/db/schema.ts');
const { eq } = await import('drizzle-orm');

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
};

const [t] = await db.select({ id: trader.id }).from(trader).limit(1);
if (!t) { console.log('no trader in this database; nothing to gate'); process.exit(0); }

const roster = await getRoster(t.id);
console.log(`\n=== ROSTER: ${roster.length} account(s) ===\n`);

// The tape's own totals, computed independently of the roster's query.
const [tape] = await db
  .select({
    trades: sql<number>`count(*)`.mapWith(Number),
    net: sql<number>`coalesce(sum(${trade.grossPnlCents} + ${trade.feeCents}), 0)`.mapWith(Number),
  })
  .from(trade)
  .where(sql`${trade.traderId} = ${t.id} and ${trade.state} = 'ok'`);

const rosterTrades = roster.reduce((n, a) => n + a.trades, 0);
const rosterNet = roster.reduce((n, a) => n + a.netCents, 0);

check('the roster counts every countable trade the tape does', rosterTrades, tape.trades);
check('the roster nets to the same cents as the tape', rosterNet, tape.net);

const series = await getDailySeries(t.id);
const seriesNet = series.reduce((n, p) => n + p.cents, 0);
check('the daily series sums to the same net', seriesNet, tape.net);

const days = new Set(series.map((p) => p.day));
const [distinct] = await db
  .select({ n: sql<number>`count(distinct ${trade.sessionDate})`.mapWith(Number) })
  .from(trade)
  .where(sql`${trade.traderId} = ${t.id} and ${trade.state} = 'ok'`);
check('the series covers every session that traded', days.size, distinct.n);

const windowed = await getDailySeries(t.id, { from: '2099-01-01' });
check('a window in the future selects nothing', windowed.length, 0);

const fresh = await getFreshness(t.id);
console.log(`  INFO  freshness known for ${fresh.size} of ${roster.length} account(s)`);
for (const a of roster) {
  console.log(
    `        ${a.externalAccountId}  type=${a.accountType ?? 'null'} status=${a.status} ` +
      `trades=${a.trades} net=${a.netCents} last=${a.lastSessionDate ?? '-'}`
  );
}

console.log(failures === 0 ? '\nS6a GATE PASSED\n' : `\nS6a GATE FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
