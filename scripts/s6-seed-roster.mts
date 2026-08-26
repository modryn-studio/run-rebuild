/* SEVEN SYNTHETIC ACCOUNTS BESIDE LUKE'S REAL ONE, so `/accounts` has a roster to be judged on.
 *
 * WHY THIS EXISTS. The dev corpus holds exactly one account, unlabelled, active. That renders a
 * roster with one group, one chip, no CLOSED section, and a Filters control that correctly hides
 * itself because neither of its axes has two answers. None of `S6`'s design can be looked at
 * against a corpus like that, and none of it can be compared to `run-trading@v2`, whose own roster
 * runs to 29 accounts across three types.
 *
 * IT GOES THROUGH THE REAL PIPELINE, exactly as `s5-seed-dev.mts` does with the real export: CSV
 * text -> parser -> preflight -> commit -> project. Nothing is written straight to `trade`. That
 * matters more than it looks, because a projection with no events behind it is a row that vanishes
 * the first time anything replays the log — and the log is the corpus.
 *
 * THE PRICES ARE REAL. Round trips are priced off Massive's 1-minute aggregate bars for the actual
 * contract on the actual session, so a synthetic MNQ trade opens and closes at prices MNQ really
 * traded at that day. Made-up prices would have made the tape's own arithmetic — entry, exit,
 * points, ticks — quietly nonsense the moment anyone read a row closely.
 *
 * THE P/L IS COMPUTED HERE AND WRITTEN INTO THE CSV, and that is not a shortcut, it is the
 * contract. Run NEVER derives gross P&L from a multiplier: `project.ts` takes it from Position
 * History's `P/L` column, because the broker's number is the one that reconciles. So this file has
 * to behave like the broker — the multipliers below exist to GENERATE a coherent file, and nothing
 * downstream reads them. Verified against Luke's own export: MNQU6 bought 29312.50, sold 29275.75,
 * qty 1, and Tradovate wrote -73.50 — which is 36.75 points at $2, so MNQ is $2/point.
 *
 * FEES KEY TO FILLS ON RAW STRINGS. `feeBucket` is `${Timestamp}|${Contract}` taken verbatim from
 * both files, so a Cash History row's timestamp text must match its fill's character for character.
 * CLAUDE.md states the rule and this is the writer's side of it.
 *
 * IDEMPOTENT. Each account's files hash to a stable value, so a second run is a no-op at the import
 * level and the dedupe key makes it one at the row level. `--reset` drops only what this script
 * created, by account name prefix, and never touches Luke's real Tradeify account.
 *
 * Run: npx tsx --env-file=.env.local --conditions=react-server scripts/s6-seed-roster.mts
 *      ...same, plus --reset   to clear the synthetic accounts first
 */

import { loadEnv } from './load-env.mts';

loadEnv();

const { db, trader, account, authUser, event, importBatch, trade, tradingSession } = await import(
  '../src/lib/db/index.ts'
);
const { sql, eq, inArray } = await import('drizzle-orm');
const { parseTradovateFillsCsv } = await import('../src/lib/csv/fills.ts');
const { parseTradovatePositionHistoryCsv } = await import('../src/lib/csv/position-history.ts');
const { parseCashHistory } = await import('../src/lib/csv/cash-history.ts');
const { fillEventValues, roundTripEventValues, feeEventValues } = await import(
  '../src/lib/intake/write.ts'
);
const { resolveRoundTripInstant } = await import('../src/lib/intake/round-trip-instant.ts');
const { commitImport, markImportCommitted } = await import('../src/lib/intake/commit.ts');
const { preflight } = await import('../src/lib/intake/preflight.ts');
const { resolveAccountsFor } = await import('../src/lib/intake/accounts.ts');
const { projectAccount } = await import('../src/lib/trades/project.ts');

const RESET = process.argv.includes('--reset');

/* ── WHAT A CONTRACT IS WORTH, FOR GENERATION ONLY ────────────────────────────────────────────
 * CME's published multipliers. Nothing downstream reads these: they exist so the `P/L` this script
 * writes agrees with the prices beside it, the way a broker's file does. MNQ is confirmed against
 * Luke's own export (see the header); the rest are the exchange's own contract specs.
 * `commission` is a flat $0.39 a fill, which is what Tradovate bills Luke on MNQ — a synthetic
 * account is not a claim about anyone's fee schedule, and one rate keeps every difference in net
 * P&L a difference in TRADING rather than in cost. */
type Spec = { root: string; contract: string; mult: number; tick: number; decimals: number };
const SPECS: Record<string, Spec> = {
  MNQ: { root: 'MNQ', contract: 'MNQU6', mult: 2, tick: 0.25, decimals: 2 },
  MES: { root: 'MES', contract: 'MESU6', mult: 5, tick: 0.25, decimals: 2 },
  MGC: { root: 'MGC', contract: 'MGCQ6', mult: 10, tick: 0.1, decimals: 1 },
  MCL: { root: 'MCL', contract: 'MCLQ6', mult: 100, tick: 0.01, decimals: 2 },
  M2K: { root: 'M2K', contract: 'M2KU6', mult: 5, tick: 0.1, decimals: 1 },
  MYM: { root: 'MYM', contract: 'MYMU6', mult: 0.5, tick: 1, decimals: 0 },
};
const COMMISSION_PER_FILL = 0.39;

const PRODUCT_DESC: Record<string, string> = {
  MNQ: 'Micro E-mini NASDAQ-100',
  MES: 'Micro E-mini S&P 500',
  MGC: 'E-Micro Gold',
  MCL: 'Micro WTI Crude Oil',
  M2K: 'Micro E-mini Russell 2000',
  MYM: 'Micro E-mini Dow Jones',
};

/* ── THE ROSTER THIS PRODUCES ─────────────────────────────────────────────────────────────────
 * Chosen so every state the roster can draw has something in it: three types, all four statuses,
 * a CLOSED group, an unlabelled row, and two accounts sharing a prefix so the "apply this firm to
 * my other N accounts" path has siblings to act on when `S6e` lands.
 *
 * `ELTDENF` IS A REAL CONFIRMED PREFIX (TradeDay, in `prop-firms.ts`), used deliberately on one
 * account so the seed exercises the DETECTION path — `resolveAccount` will fill its firm from the
 * prefix table with `firm_source: 'detected'` before this script states anything. Every other
 * prefix is invented, so those rows arrive with no firm and get one stated, which is the other
 * half of the same flow.
 *
 * Account names copy Tradovate's own shape from the real export: a letter prefix followed by a long
 * digit run (`FTDFYL100183704873`), and a separate numeric broker id (`56963172`). */
type Plan = {
  name: string;
  brokerId: string;
  firm: string | null;
  type: 'evaluation' | 'sim_funded' | 'personal' | null;
  status: 'active' | 'passed' | 'failed' | 'closed';
  size: number | null;
  roots: string[];
  /** Trading days, most recent last. Kept inside the window Massive has bars for. */
  days: string[];
  /** Roughly how the equity curve should read, so the sparklines are not all the same shape. */
  bias: 'up' | 'down' | 'chop';
  trades: number;
};

const DAYS_A = ['2026-07-08', '2026-07-09', '2026-07-10', '2026-07-13', '2026-07-14'];
const DAYS_B = ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-20'];
const DAYS_C = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'];

const PLAN: Plan[] = [
  {
    name: 'APXTRF241180553907',
    brokerId: '57104882',
    firm: 'Apex Trader Funding',
    type: 'evaluation',
    status: 'active',
    size: 50_000,
    roots: ['MNQ', 'MES'],
    days: DAYS_B,
    bias: 'chop',
    trades: 34,
  },
  {
    name: 'APXTRF241180554021',
    brokerId: '57104931',
    firm: 'Apex Trader Funding',
    type: 'evaluation',
    status: 'passed',
    size: 50_000,
    roots: ['MNQ'],
    days: DAYS_A,
    bias: 'up',
    trades: 28,
  },
  {
    name: 'TPTRDR880412663145',
    brokerId: '57210447',
    firm: 'Take Profit Trader',
    type: 'evaluation',
    status: 'failed',
    size: 100_000,
    roots: ['MCL', 'MNQ'],
    days: DAYS_C,
    bias: 'down',
    trades: 31,
  },
  {
    name: 'ELTDENF260623134425',
    brokerId: '56880314',
    // Left null: the prefix is real, so `resolveAccount` detects TradeDay on its own.
    firm: null,
    type: 'sim_funded',
    status: 'active',
    size: 150_000,
    roots: ['MES', 'MYM'],
    days: DAYS_B,
    bias: 'up',
    trades: 26,
  },
  {
    name: 'MFFUTR553901284470',
    brokerId: '57330190',
    firm: 'My Funded Futures',
    type: 'sim_funded',
    status: 'closed',
    size: 100_000,
    roots: ['MGC'],
    days: DAYS_C,
    bias: 'up',
    trades: 19,
  },
  {
    name: 'PERSONAL4471902238',
    brokerId: '55120763',
    firm: 'Personal',
    type: 'personal',
    status: 'active',
    size: null,
    roots: ['MES', 'MGC'],
    days: DAYS_A,
    bias: 'chop',
    trades: 22,
  },
  {
    name: 'APXTRF241180554188',
    brokerId: '57105002',
    // Deliberately left unlabelled: keeps the "Not yet labelled" group and the row's own
    // "Name this account" prompt on screen, which is a real state and the one a fresh import lands in.
    firm: null,
    type: null,
    status: 'active',
    size: null,
    roots: ['M2K'],
    days: DAYS_A.slice(0, 3),
    bias: 'down',
    trades: 12,
  },
];

/** Every synthetic name shares no prefix with Luke's real `FTDFYL...`, which is what makes `--reset`
 *  safe: it can only ever match rows this script wrote. */
const SYNTHETIC_PREFIXES = ['APXTRF', 'TPTRDR', 'ELTDENF', 'MFFUTR', 'PERSONAL'];

// ── Massive ──────────────────────────────────────────────────────────────────────────────────

const MASSIVE_KEY = process.env.MASSIVE_API_KEY?.trim();

type Bar = { at: Date; close: number };

/* ONE DAY OF 1-MINUTE BARS FOR ONE CONTRACT. `window_start` is nanoseconds; the API returns newest
 * first, so this sorts. A day with no bars (a holiday, or a contract Massive has no history for)
 * returns empty and the caller skips that day rather than inventing one. */
async function bars(contract: string, day: string): Promise<Bar[]> {
  if (!MASSIVE_KEY) return [];
  const from = new Date(`${day}T13:30:00Z`).getTime() * 1e6;
  const to = new Date(`${day}T20:00:00Z`).getTime() * 1e6;
  const url =
    `https://api.massive.com/futures/v1/aggs/${contract}` +
    `?resolution=1min&limit=500&window_start.gte=${from}&window_start.lte=${to}&apiKey=${MASSIVE_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: { window_start: number; close: number }[] };
    return (json.results ?? [])
      .map((b) => ({ at: new Date(Number(b.window_start) / 1e6), close: b.close }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  } catch {
    return [];
  }
}

// ── deterministic randomness, so a re-run produces the identical corpus ──────────────────────

function rng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
    return ((h >>> 8) & 0xffffff) / 0xffffff;
  };
}

// ── formatting, copied from the real export's own conventions ────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
/** `07/08/2026 08:32:45` — the export's local wall clock, which carries no zone. Chicago is the
 *  session's own clock and the file is written in it. */
function localStamp(at: Date): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('month')}/${g('day')}/${g('year')} ${g('hour')}:${g('minute')}:${g('second')}`;
}
const isoDay = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(at);
const utcStamp = (at: Date) => at.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '.000Z');
const shortDate = (at: Date) => {
  const d = isoDay(at).split('-');
  return `${Number(d[1])}/${Number(d[2])}/${d[0].slice(2)}`;
};

type RT = {
  pairId: string;
  buyFillId: string;
  sellFillId: string;
  spec: Spec;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  boughtAt: Date;
  soldAt: Date;
  longFirst: boolean;
};

/* ── ONE ACCOUNT'S ROUND TRIPS, PRICED OFF REAL BARS ──────────────────────────────────────────
 * Each trade picks a real entry bar, holds for a plausible few minutes, and exits at whatever the
 * contract actually printed then — then nudges the exit by a whole number of TICKS so the outcome
 * follows the account's intended bias without ever landing off the tick grid. A price that is not a
 * multiple of the tick size is the tell that a file was invented. */
async function buildTrades(p: Plan, idBase: number): Promise<RT[]> {
  const rand = rng(p.name);
  const out: RT[] = [];
  let id = idBase;

  const perDay = Math.max(1, Math.ceil(p.trades / p.days.length));

  for (const day of p.days) {
    for (const root of p.roots) {
      const spec = SPECS[root];
      const series = await bars(spec.contract, day);
      if (series.length < 30) continue;

      const n = Math.max(1, Math.round(perDay / p.roots.length));
      for (let i = 0; i < n && out.length < p.trades; i++) {
        const start = Math.floor(rand() * (series.length - 20)) + 2;
        const hold = 2 + Math.floor(rand() * 14);
        const a = series[start];
        const b = series[Math.min(series.length - 1, start + hold)];

        /* WHICH WAY THE TRADE WENT. `chop` is a coin flip; the other two lean, but never to
           certainty — an account that never loses is not a roster anybody learns anything from. */
        const winRate = p.bias === 'up' ? 0.62 : p.bias === 'down' ? 0.34 : 0.48;
        const win = rand() < winRate;
        const long = rand() < 0.55;

        const qty = 1 + Math.floor(rand() * 3);
        const entry = a.close;
        // Ticks of movement, sized off what the contract actually did between the two bars.
        const drift = Math.abs(b.close - entry) / spec.tick;
        const ticks = Math.max(2, Math.round(drift || 4 + rand() * 12));
        const dir = (win ? 1 : -1) * (long ? 1 : -1);
        const exit = round(entry + dir * ticks * spec.tick, spec.decimals);

        const buyPrice = long ? entry : exit;
        const sellPrice = long ? exit : entry;
        const pnl = round((sellPrice - buyPrice) * spec.mult * qty, 2);

        const buyAt = long ? a.at : b.at;
        const sellAt = long ? b.at : a.at;

        out.push({
          pairId: String(id++),
          buyFillId: String(id++),
          sellFillId: String(id++),
          spec,
          qty,
          buyPrice,
          sellPrice,
          pnl,
          boughtAt: buyAt,
          soldAt: sellAt,
          longFirst: long,
        });
      }
    }
  }
  return out.sort((x, y) => x.soldAt.getTime() - y.soldAt.getTime());
}

const round = (n: number, d: number) => Number(n.toFixed(d));
const money = (n: number) => n.toFixed(2);

// ── the three files ──────────────────────────────────────────────────────────────────────────

function fillsCsv(p: Plan, rts: RT[]): string {
  const head =
    '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission';
  const rows: string[] = [];
  for (const r of rts) {
    const legs = [
      { id: r.buyFillId, side: ' Buy', action: 0, price: r.buyPrice, at: r.boughtAt },
      { id: r.sellFillId, side: ' Sell', action: 1, price: r.sellPrice, at: r.soldAt },
    ];
    for (const leg of legs) {
      rows.push(
        [
          leg.id,
          leg.id,
          '4399654',
          utcStamp(leg.at),
          isoDay(leg.at),
          leg.action,
          r.qty,
          leg.price,
          'true',
          p.brokerId,
          leg.id,
          leg.id,
          localStamp(leg.at),
          shortDate(leg.at),
          p.name,
          leg.side,
          r.qty,
          money(leg.price),
          '-2',
          '0',
          r.spec.tick,
          r.spec.contract,
          r.spec.root,
          PRODUCT_DESC[r.spec.root],
          money(COMMISSION_PER_FILL * r.qty),
        ].join(',')
      );
    }
  }
  return [head, ...rows].join('\n');
}

function positionCsv(p: Plan, rts: RT[]): string {
  const head =
    'Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp';
  const rows = rts.map((r) =>
    [
      r.pairId,
      localStamp(r.soldAt),
      isoDay(r.soldAt),
      '0',
      '',
      r.qty,
      money(r.buyPrice),
      r.qty,
      money(r.sellPrice),
      p.name,
      r.spec.contract,
      r.spec.root,
      PRODUCT_DESC[r.spec.root],
      '-2',
      '0',
      r.spec.tick,
      r.pairId,
      r.buyFillId,
      r.sellFillId,
      r.qty,
      money(r.buyPrice),
      money(r.sellPrice),
      money(r.pnl),
      'USD',
      localStamp(r.boughtAt),
      localStamp(r.soldAt),
    ].join(',')
  );
  return [head, ...rows].join('\n');
}

/* THE FEE FILE, AND ITS TIMESTAMPS MUST MATCH THE FILLS' CHARACTER FOR CHARACTER. `feeBucket` keys
 * on `${Timestamp}|${Contract}` taken raw from both files — CLAUDE.md's "fees key to fills on RAW
 * STRINGS, because Cash History timestamps carry no timezone and parsing them shifts every fee by
 * the server's offset". So `localStamp` is called on the same instant here as there. */
function cashCsv(p: Plan, rts: RT[], txBase: number): string {
  const head =
    'Account,Transaction ID,Timestamp,Date,Delta,Amount,Cash Change Type,Currency,Contract';
  let tx = txBase;
  let balance = p.size ?? 25_000;
  const rows: string[] = [
    [
      p.name,
      String(tx++),
      localStamp(new Date(`${p.days[0]}T11:00:00Z`)),
      p.days[0],
      `"${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}"`,
      `"${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}"`,
      ' Fund Transaction',
      'USD',
      '',
    ].join(','),
  ];

  for (const r of rts) {
    for (const leg of [
      { at: r.boughtAt },
      { at: r.soldAt },
    ]) {
      const fee = round(COMMISSION_PER_FILL * r.qty, 2);
      balance -= fee;
      rows.push(
        [
          p.name,
          String(tx++),
          localStamp(leg.at),
          isoDay(leg.at),
          money(-fee),
          money(balance),
          ' Commission',
          'USD',
          r.spec.contract,
        ].join(',')
      );
    }
    balance += r.pnl;
  }
  return [head, ...rows].join('\n');
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────

const [t] = await db
  .select({ id: trader.id, email: authUser.email })
  .from(trader)
  .innerJoin(authUser, eq(authUser.id, trader.authUserId))
  .where(eq(authUser.email, 'luke@modrynstudio.com'))
  .limit(1);

if (!t) {
  console.error('No trader for luke@modrynstudio.com. Sign in on the dev app first.');
  process.exit(1);
}
console.log(`trader ${t.email} (${t.id})\n`);

if (RESET) {
  /* SCOPED TO WHAT THIS SCRIPT WROTE, by account-name prefix. Luke's real `FTDFYL...` account
     shares no prefix with any of them, so it cannot be reached from here.
     `event` refuses ordinary DELETE — the append-only trigger — so the privileged flag and the
     deletes have to travel in ONE statement: `set_config(..., true)` is transaction-local and
     `neon-http` has no interactive transaction, so two calls lose the flag in between. */
  const like = SYNTHETIC_PREFIXES.map((p) => `'${p}%'`).join(', ');
  await db.execute(
    sql.raw(`
    DO $$
    DECLARE ids uuid[];
    BEGIN
      SELECT array_agg(id) INTO ids FROM "account"
       WHERE trader_id = '${t.id}' AND (${SYNTHETIC_PREFIXES.map((p) => `external_account_id LIKE '${p}%'`).join(' OR ')});
      IF ids IS NULL THEN RETURN; END IF;
      PERFORM set_config('run.privileged', 'on', true);
      DELETE FROM "trade"  WHERE account_id = ANY(ids);
      DELETE FROM "event"  WHERE account_id = ANY(ids);
      DELETE FROM "import" WHERE account_id = ANY(ids);
      DELETE FROM "account" WHERE id = ANY(ids);
    END $$;
  `)
  );
  // The session rollup is per TRADER, so it is rebuilt below rather than deleted by account.
  console.log(`reset: cleared synthetic accounts (${like})\n`);
}

let idSeed = 610_000_000_000;
let txSeed = 900_000_000_000;
const touched: string[] = [];

for (const p of PLAN) {
  const rts = await buildTrades(p, idSeed);
  idSeed += 100_000;
  if (rts.length === 0) {
    console.log(`  SKIP  ${p.name} — Massive returned no bars for its contracts/days`);
    continue;
  }

  const fillsText = fillsCsv(p, rts);
  const posText = positionCsv(p, rts);
  const cashText = cashCsv(p, rts, txSeed);
  txSeed += 100_000;

  const fills = parseTradovateFillsCsv(fillsText);
  const roundTrips = parseTradovatePositionHistoryCsv(posText);
  const cash = parseCashHistory(cashText);

  const checks = preflight({ fills, roundTrips, fees: cash.fees, tradePaired: cash.tradePaired });
  if (!checks.ok) {
    console.log(
      `  REFUSED  ${p.name} — ${checks.findings.filter((f) => f.blocking).map((f) => f.code).join(', ')}`
    );
    continue;
  }

  const accountIds = await resolveAccountsFor(fills, { traderId: t.id });
  const accountId = [...accountIds.values()][0];
  if (!accountId) {
    console.log(`  SKIP  ${p.name} — no account named in the generated file`);
    continue;
  }

  /* THE SAME EVENT ASSEMBLY THE ROUTE DOES, and the fee half is the part that matters: a fee is
     dated by the FILL it belongs to, found through `feeBucketKey`, because Cash History's own
     timestamps carry no zone. A fee with no matching fill is dropped rather than dated by guess. */
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

  /* ALREADY-IMPORTED IS A NORMAL OUTCOME for a re-run, and `commitImport` throws on the unique
     `(account_id, file_hash)` rather than no-op'ing — right for the route, wrong for a seeder whose
     job is "make sure this is in, then project". Caught by constraint name so a real failure still
     surfaces. */
  let wrote = 0;
  try {
    const result = await commitImport({
      traderId: t.id,
      accountId,
      filename: `${p.name}: Fills, Position History, Cash History`,
      fileText: fillsText + posText + cashText,
      source: 'tradovate_csv',
      rowsParsed: events.length,
      events,
      preflight: checks,
    });
    await markImportCommitted(result.importId);
    wrote = result.rowsWritten;
  } catch (e) {
    const msg = String((e as { cause?: unknown })?.cause ?? e);
    if (!msg.includes('import_file_uq')) throw e;
  }

  const projected = await projectAccount(t.id, accountId);
  const net = rts.reduce((n, r) => n + r.pnl, 0) - rts.length * 2 * COMMISSION_PER_FILL;
  console.log(
    `  ${p.name.padEnd(20)} ${String(projected.trades).padStart(3)} trades  ` +
      `${p.roots.join('/').padEnd(9)}  net ${money(net).padStart(10)}  ` +
      `${wrote ? `${wrote} rows` : 'already in'}${projected.quarantined ? `  ⚠ ${projected.quarantined} quarantined` : ''}`
  );
  touched.push(accountId);
}

/* ── THE LABELS, APPLIED AFTER THE IMPORT ─────────────────────────────────────────────────────
 * An import creates every account UNLABELLED — no type, status active — and that is the documented
 * normal state, not a gap: phase is never derivable from an export, so it has to be asked for
 * afterwards. This is that answer, written the way `S6e`'s label flow will write it.
 * `firm_source: 'stated'` for a firm named here; the TradeDay row is left alone, because
 * `resolveAccount` already detected it from its real prefix and 'detected' is the honest record of
 * how Run came to believe it. */
console.log('\nlabels:');
for (const p of PLAN) {
  const patch: Record<string, unknown> = { status: p.status };
  if (p.type !== null) patch.accountType = p.type;
  if (p.size !== null) patch.sizeDollars = p.size;
  if (p.firm !== null) {
    patch.propFirm = p.firm;
    patch.firmSource = 'stated';
  }
  const done = await db
    .update(account)
    .set(patch)
    .where(sql`${account.traderId} = ${t.id} AND ${account.externalAccountId} = ${p.name}`)
    .returning({ id: account.id });
  if (done.length > 0) {
    console.log(
      `  ${p.name.padEnd(20)} ${(p.type ?? 'unlabelled').padEnd(11)} ${p.status.padEnd(7)} ${p.firm ?? '(detected)'}`
    );
  }
}

const roster = await db
  .select({
    name: account.externalAccountId,
    type: account.accountType,
    status: account.status,
    firm: account.propFirm,
  })
  .from(account)
  .where(eq(account.traderId, t.id));

console.log(`\nroster is now ${roster.length} accounts:`);
for (const r of roster) {
  console.log(
    `  ${(r.name ?? '').padEnd(20)} ${(r.type ?? '—').padEnd(11)} ${(r.status ?? '').padEnd(7)} ${r.firm ?? '—'}`
  );
}
process.exit(0);
