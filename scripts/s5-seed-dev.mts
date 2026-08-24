/* Put the REAL ten-day export into the signed-in dev trader, so /trades can be looked at.
 *
 * Not a fixture and not a gate: this is Luke's own trading data going into Luke's own dev database
 * through the same commit and projection path the import route uses, so what the page renders is
 * what a real import produces rather than a mock of one.
 *
 * IDEMPOTENT. The file hash makes a second run a no-op at the import level and the dedupe key makes
 * it one at the row level, so running this twice imports nothing twice.
 *
 * Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s5-seed-dev.mts
 */
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, authUser } = await import('../src/lib/db/index.ts');
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills.ts');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history.ts');
const { parseCashHistory } = await import('../src/lib/csv/cash-history.ts');
const { fillEventValues, roundTripEventValues, feeEventValues } = await import('../src/lib/intake/write.ts');
const { resolveRoundTripInstant } = await import('../src/lib/intake/round-trip-instant.ts');
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');
const { preflight } = await import('../src/lib/intake/preflight.ts');
const { resolveAccountsFor } = await import('../src/lib/intake/accounts.ts');
const { projectAccount } = await import('../src/lib/trades/project.ts');

const D = (process.env.RUN_FIXTURES ?? 'C:/Users/Luke/Downloads/').replace(/\/?$/, '/');
const read = (f: string) => readFileSync(D + f).toString();

const fills = parseTradovateFillsCsv(read('Fills.csv'));
const roundTrips = parseTradovatePositionHistoryCsv(read('Position History (9).csv'));
const cash = parseCashHistory(read('Cash History.csv'));

/* THE REAL SIGNED-IN TRADER, never a made-up one — the whole point is to look at the page as it
   will actually be seen. Picks the most recently created trader that has an auth user behind it. */
const traders = await db
  .select({ id: trader.id, authUserId: trader.authUserId, email: authUser.email })
  .from(trader)
  .innerJoin(authUser, eq(authUser.id, trader.authUserId));
if (traders.length === 0) throw new Error('No trader exists yet. Sign in once, then re-run.');
const t = traders[traders.length - 1];
console.log(`trader ${t.id} (${t.email})`);

const checks = preflight({ fills, roundTrips, fees: cash.fees, tradePaired: cash.tradePaired });
if (!checks.ok) {
  throw new Error(`preflight refused: ${checks.findings.filter((f) => f.blocking).map((f) => f.code).join(', ')}`);
}

const accountIds = await resolveAccountsFor(fills, { traderId: t.id });
const accountId = [...accountIds.values()][0];
if (!accountId) throw new Error('no account named in the export');
const [acct] = await db.select().from(account).where(eq(account.id, accountId));
console.log(`account ${acct.externalAccountId}`);

const instantByFillId = new Map<string, Date>();
const fillByBucket = new Map<string, (typeof fills)[number]>();
for (const f of fills) {
  if (f.externalFillId) instantByFillId.set(f.externalFillId, f.filledAt);
  if (f.feeBucketKey && !fillByBucket.has(f.feeBucketKey)) fillByBucket.set(f.feeBucketKey, f);
}

const common = { traderId: t.id, accountId, importId: '', source: 'csv' as const };
const events = [
  ...fillEventValues(common, fills),
  ...roundTripEventValues(
    common,
    roundTrips.map((rt) => {
      const { at, timeSource } = resolveRoundTripInstant(rt, instantByFillId);
      return { rt, occurredAt: at, timeSource };
    })
  ),
  ...feeEventValues(
    common,
    cash.fees
      .map((fee) => ({ fee, fill: fee.bucketKey ? fillByBucket.get(fee.bucketKey) : undefined }))
      .filter((x): x is { fee: (typeof cash.fees)[number]; fill: (typeof fills)[number] } => !!x.fill)
      .map(({ fee, fill }) => ({ fee, occurredAt: fill.filledAt }))
  ),
];

/* ALREADY-IMPORTED IS A NORMAL OUTCOME, not a failure. `(account_id, file_hash)` is unique and
   `commitImport` THROWS on it rather than no-op'ing — which is right for the route, where a trader
   re-uploading the same file should be told, and wrong for a script whose job is "make sure this is
   in, then project". So the constraint is caught by name and the run continues to the projection,
   which is the half that actually needs re-running after a schema change. */
try {
  const result = await commitImport({
    traderId: t.id,
    accountId,
    filename: 'Fills.csv, Position History.csv, Cash History.csv',
    fileText: read('Fills.csv') + read('Position History (9).csv') + read('Cash History.csv'),
    source: 'tradovate_csv',
    rowsParsed: events.length,
    events,
    preflight: checks,
  });
  await markImportCommitted(result.importId);
  console.log(`committed: ${result.rowsWritten} rows written of ${result.rowsParsed} parsed`);
} catch (e) {
  const msg = String((e as { cause?: unknown })?.cause ?? e);
  if (!msg.includes('import_file_uq')) throw e;
  console.log('already imported, skipping the write');
}

const projected = await projectAccount(t.id, accountId);
console.log(`projected: ${projected.trades} trades, ${projected.quarantined} quarantined, ${projected.sessions} sessions`);
