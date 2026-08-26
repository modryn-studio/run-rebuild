/* THE SCRIPTED TRADES EVERY TRADE SURFACE ON THE RACK IS BUILT FROM.
 *
 * ONE HOME, because two sections now render the same shape: the tape (`sections/trades.tsx`) and
 * the drawer (`sections/trade-detail.tsx`). A drawer demo carrying its own hand-written row would
 * be a second opinion about what a trade looks like, and the first thing to drift would be the
 * field the drawer shows and the tape does not — the broker ids, which is precisely the part the
 * drawer exists to display.
 *
 * NO TYPE IMPORT REACHES A SERVER MODULE. `TapeRow` comes in as a TYPE only, so this file is safe
 * for the client section to import: `import type` is erased and cannot drag `@/lib/db` along.
 *
 * ─── NO FIXTURE HERE COULD BE MISTAKEN FOR REAL DATA ──────────────────────────────────────────
 *
 * The rack's standing rule, and it bites harder here than anywhere else, because these render as
 * MONEY. Every figure is obviously synthetic (7s and 3s, round hundreds), the account is not a
 * Tradovate name, and the dates are a Sunday and a Saturday — days the CME is shut — so no
 * screenshot of this page can be read as somebody's real session.
 */

import type { SessionGroup, TapeRow, TradesDigest } from '@/lib/trades/read';

export const row = (
  id: string,
  over: Partial<TapeRow> & Pick<TapeRow, 'entryAt' | 'exitAt' | 'sessionDate' | 'grossCents'>
): TapeRow => ({
  id,
  accountId: 'demo',
  accountName: 'Tradeify 50K (...0007)',
  /* THE TWO HALVES THE TAPE TRUNCATES BETWEEN. A long firm name on purpose: the rack's job is to
     show the row under squeeze, and "Tradeify" alone never reaches the width where the cut
     happens. */
  accountHead: 'Tradeify',
  accountTail: '50K (...0007)',
  // A real firm mark, because the row's account cell is one of the things being reviewed here and
  // an unlabelled account renders the half of it without a logo.
  firmLogo: '/firms/tradeify.jpeg',
  symbolRoot: 'MNQ',
  contract: 'MNQZ7',
  direction: 'long',
  qty: 3,
  entryPrice: '17777.250000',
  exitPrice: '17777.750000',
  feeCents: -300,
  netCents: over.grossCents - 300,
  state: 'ok',
  quarantineReason: null,
  exclusionReason: null,
  pairId: '777000000007',
  buyFillId: '777000000003',
  sellFillId: '777000000005',
  ...over,
});

const at = (iso: string) => new Date(iso);

export const TAPE_FIXTURE: SessionGroup[] = [
  {
    sessionDate: '2027-03-07',
    netCents: 70_000,
    feesCents: -900,
    tradeCount: 3,
    winCount: 2,
    lossCount: 1,
    winRatePct: 67,
    trades: [
      row('t1', { entryAt: at('2027-03-07T14:33:00Z'), exitAt: at('2027-03-07T14:37:00Z'), sessionDate: '2027-03-07', grossCents: 77_700 }),
      row('t2', { entryAt: at('2027-03-07T14:07:00Z'), exitAt: at('2027-03-07T14:09:00Z'), sessionDate: '2027-03-07', grossCents: -7_700, direction: 'short', symbolRoot: 'NQ', contract: 'NQZ7' }),
      /* QUARANTINED, and it is the row this fixture exists for: still listed, marked, muted rather
         than coloured, and absent from the band's own count above it. */
      row('t3', { entryAt: at('2027-03-07T13:51:00Z'), exitAt: at('2027-03-07T13:52:00Z'), sessionDate: '2027-03-07', grossCents: 300, state: 'quarantined', quarantineReason: 'XYZ is not in the contract spec.', symbolRoot: 'XYZ', contract: null, direction: null }),
      row('t4', { entryAt: at('2027-03-07T13:30:00Z'), exitAt: at('2027-03-07T13:33:00Z'), sessionDate: '2027-03-07', grossCents: 3_000 }),
    ],
  },
  {
    sessionDate: '2027-03-06',
    netCents: -33_300,
    feesCents: -600,
    tradeCount: 3,
    winCount: 0,
    lossCount: 3,
    winRatePct: 0,
    trades: [
      row('t5', { entryAt: at('2027-03-06T20:03:00Z'), exitAt: at('2027-03-06T20:11:00Z'), sessionDate: '2027-03-06', grossCents: -30_000, qty: 7 }),
      row('t6', { entryAt: at('2027-03-06T15:30:00Z'), exitAt: at('2027-03-06T15:31:00Z'), sessionDate: '2027-03-06', grossCents: -3_300, direction: 'short' }),
      row('t7', { entryAt: at('2027-03-06T09:00:00Z'), exitAt: at('2027-03-06T09:07:00Z'), sessionDate: '2027-03-06', grossCents: 0 }),
    ],
  },
];

export const DIGEST_FIXTURE: TradesDigest = {
  trades: 7,
  sessions: 3,
  accounts: 1,
  netCents: -37_700,
  feesCents: -1_500,
  wins: 3,
  losses: 3,
  winRatePct: 50,
  avgWinCents: 77_700,
  avgLossCents: -30_000,
  avgSessionCents: -12_500,
  bestSessionCents: 70_000,
  worstSessionCents: -33_300,
  firstDay: '2027-03-03',
  lastDay: '2027-03-07',
  lastImportAt: new Date('2027-03-08T14:12:00Z'),
  hasFees: true,
};

/* The export control renders only when there is something to export, so the rack has to hand it a
   non-empty selection or the foot of the card is simply absent here. Obviously-fake ids, per the
   rule at the top of this file. */
export const DIGEST_FIXTURE_IDS = ['fixture-trade-1', 'fixture-trade-2', 'fixture-trade-3'];

/* ─── THE DRAWER'S OWN CASES ───────────────────────────────────────────────────────────────────
 *
 * Four rows rather than one, because the drawer has four SHAPES and three of them are the ones a
 * single happy-path fixture would never render: the quarantine block, the fees line that says
 * "Not imported", and the "arrived without Tradovate's own ids" fallback. A rack that only ever
 * showed the first has reviewed a quarter of the panel.
 */

/** The ordinary case: a win, real fees, all three broker ids, so every copy control is live. */
export const DRAWER_TRADE = row('d1', {
  entryAt: at('2027-03-07T14:33:00Z'),
  exitAt: at('2027-03-07T14:37:00Z'),
  sessionDate: '2027-03-07',
  grossCents: 77_700,
});

/** A loss, and a SHORT — the pair that caught a real bug once, where entry/exit were mapped by
 *  side rather than by which fill opened, and every winning short printed as a loser. */
export const DRAWER_TRADE_SHORT = row('d2', {
  entryAt: at('2027-03-06T20:03:00Z'),
  exitAt: at('2027-03-06T22:11:00Z'),
  sessionDate: '2027-03-06',
  grossCents: -30_000,
  direction: 'short',
  qty: 7,
  symbolRoot: 'NQ',
  contract: 'NQZ7',
  entryPrice: '17333.000000',
  exitPrice: '17337.250000',
});

/** Quarantined on an unknown root: the extra Section appears, direction is honestly Unknown, and
 *  the contract falls back to the root because there is no parsed contract to show. */
export const DRAWER_TRADE_QUARANTINED = row('d3', {
  entryAt: at('2027-03-07T13:51:00Z'),
  exitAt: at('2027-03-07T13:52:00Z'),
  sessionDate: '2027-03-07',
  grossCents: 300,
  state: 'quarantined',
  quarantineReason: 'XYZ is not in the contract spec.',
  symbolRoot: 'XYZ',
  contract: null,
  direction: null,
});

/** No broker ids and no fees: the two fallbacks that state a gap instead of filling it with
 *  something that looks like provenance. */
export const DRAWER_TRADE_BARE = row('d4', {
  entryAt: at('2027-03-06T15:30:00Z'),
  exitAt: at('2027-03-06T15:31:00Z'),
  sessionDate: '2027-03-06',
  grossCents: -3_300,
  feeCents: 0,
  netCents: -3_300,
  pairId: null,
  buyFillId: null,
  sellFillId: null,
});

/* ─── THREE ACCOUNTS, FOR THE HEADER'S SELECTOR ───────────────────────────────────────────────
 *
 * `AccountSelect` renders NOTHING below two accounts, on the same rule the Filters panel's own
 * Accounts axis follows: a filter offering one choice cannot change anything, and here it would
 * additionally light the "narrowed" dot without narrowing. The real corpus has exactly one account,
 * so the control is invisible on live data and the rack is the only place it can be judged.
 *
 * FIXTURES RATHER THAN SEEDED ACCOUNTS (Luke, 2026-08-20: "we dont have to create a bunch of fake
 * accounts right now do we? that is what run-trading@v2 did but then things got messed up"). Right,
 * and the reason is the doctrine: a seeded account with invented trades produces figures that
 * reconcile against NOTHING, on a product whose one claim is that it never shows a number it cannot
 * reconcile. A rack fixture makes no such claim — it is scenery for a control, and it never touches
 * the corpus.
 *
 * The shapes are real: `firm` and `short` are what `getFacets` returns, and the short is the tail
 * of a Tradovate external id, which is the part a copy-trader running one strategy across twelve
 * accounts is actually reading.
 *
 * THREE STATUSES AND THREE TYPES ACROSS THREE ROWS, deliberately (2026-08-26). The filter panel
 * drops any axis the roster answers only one way, so a fixture where every account was `active` and
 * `evaluation` would render a rack specimen MISSING two of its five axes - and the sink would show
 * a control the product does not have. One of each is the smallest set that opens both.
 */
export const ACCOUNTS_FIXTURE = [
  {
    id: 'fixture-acct-1',
    name: 'Tradeify 50K',
    firm: 'Tradeify',
    short: '50K (...4873)',
    status: 'active' as const,
    accountType: 'sim_funded' as const,
  },
  {
    id: 'fixture-acct-2',
    name: 'Tradeify 100K',
    firm: 'Tradeify',
    short: '100K (...5120)',
    status: 'failed' as const,
    accountType: 'evaluation' as const,
  },
  {
    id: 'fixture-acct-3',
    name: 'Apex 150K',
    firm: 'Apex',
    short: '150K (...7731)',
    status: 'passed' as const,
    accountType: 'personal' as const,
  },
];
