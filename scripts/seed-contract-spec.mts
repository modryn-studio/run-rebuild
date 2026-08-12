// SEED contract_spec — from CME's own contract-spec API, idempotent.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/seed-contract-spec.mts
//
// A SCRIPT, NOT A MIGRATION. This is data, so it corrects without a deploy (architecture.md).
// Baked into a migration it would need a schema change to fix a typo, which is the wrong shape
// for a table whose job is to be edited when a real import quarantines something.
//
// ── WHERE THE NUMBERS CAME FROM ───────────────────────────────────────────────────────────
// Read 2026-08-12 from CME Group's own contract-spec service, not from a summary of it and not
// from memory:
//
//   GET /CmeWS/mvc/ProductSlate/V2/List?...        the product roster: globex root, exchange
//   GET /CmeWS/mvc/ContractSpecs/List/productId/N  per product: contract unit, tick, hours
//
// The roster is scoped to what a PROP TRADER CAN REACH, which is the same scoping decision the
// previous build made (`run-trading@v2:src/lib/instruments.ts`) and for the same reason: the
// firms publish "all CME-listed products" rather than a curated list, so the useful boundary is
// what someone might actually put on. Everything here is CME / CBOT / NYMEX / COMEX, which is
// what Tradovate carries.
//
// ── EXCHANGE IS NOT ALL "CME" ─────────────────────────────────────────────────────────────
// It is the exchange that drives the session calendar, and the four are genuinely different
// products of one group: CBOT holds the grains and the treasuries, NYMEX the energy, COMEX the
// metals. Filing YM under CME rather than CBOT would be wrong in the one field this table keeps
// for calendar purposes.
//
// ── TICK SIZE IS IN QUOTE UNITS, AND THAT IS WHY THIS LIST IS NOT LONGER ──────────────────
// `tick_size` must be expressed in the same units as the price column of the broker's export,
// because `tape.ts` multiplies it by a point value derived FROM that column to sanity-check the
// tick's worth. Get the unit wrong and the check is confidently wrong.
//
// For decimal-quoted products the exchange's published figure IS the quote unit, and those are
// seeded. THREE FAMILIES ARE DELIBERATELY ABSENT because their published unit and their quoted
// unit differ, and which one a Tradovate export writes cannot be settled without a real export:
//
//   grains/oilseeds  ZC ZS ZW KE ZL ZM ZO   CME publishes 0.0025 (dollars per bushel);
//                                           the pit and most platforms quote cents. 100x apart.
//   treasuries       ZT ZF ZN TN ZB UB ZQ   quoted in 32nds and halves of 32nds. Whether an
//                                           export writes 117'16 or 117.50 changes everything.
//   livestock        LE HE GF               published 0.00025 per pound, quoted in cents.
//
// A MISSING ROW FAILS LOUDLY — the root quarantines and the trader is told. A WRONG ROW is a
// plausible number nobody catches. So absent is the correct state for all three until one real
// export settles the convention, at which point each is a one-line addition.
//
// ALSO ABSENT: SR3 (Three-Month SOFR), whose tick size is not a constant — it changes with
// months to expiry. A field that cannot hold one value does not get one guessed for it.
//
// ── AND WHY point_value_cents IS NOT HERE ─────────────────────────────────────────────────
// It was the reason this table existed and it is now derived from the trader's own round trips
// (architecture.md). The published CONTRACT UNIT below is recorded as a CROSS-CHECK, never as
// the source — derivation rule 6. That check has been run and it passed to the cent:
//
//   MNQ  derived $2.00 from 296 round trips   ·  CME publishes "$2 x Nasdaq-100 Index"
//   NQ   derived $20.00 from 61 round trips   ·  CME publishes "$20 x Nasdaq-100 Index"
//
// If a future import disagrees with the published unit, that disagreement is a FINDING to
// surface, not a reason to overwrite what the broker actually paid.
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, contractSpec } = await import('../src/lib/db/index.ts');

// tick is the Globex OUTRIGHT tick — never ClearPort, never BTIC, never the calendar spread.
// Two roots would have been seeded wrong by taking the API's first entry: EMD (ClearPort 0.01
// vs Globex 0.10) and every FX pair (ClearPort is one tenth of Globex). The `$` column is the
// tick's VALUE, which is derived rather than stored, and is here only so the plausibility bound
// in tape.ts can be read against real numbers.
const ROWS: { root: string; tick: string; exch: string; tickValue: string; unit: string }[] = [
  // Equity index — CME, except the Dow pair, which is CBOT
  { root: 'ES',   tick: '0.25',       exch: 'CME',   tickValue: '$12.50', unit: '$50 x S&P 500' },
  { root: 'MES',  tick: '0.25',       exch: 'CME',   tickValue: '$1.25',  unit: '$5 x S&P 500' },
  { root: 'NQ',   tick: '0.25',       exch: 'CME',   tickValue: '$5.00',  unit: '$20 x Nasdaq-100' },
  { root: 'MNQ',  tick: '0.25',       exch: 'CME',   tickValue: '$0.50',  unit: '$2 x Nasdaq-100' },
  { root: 'YM',   tick: '1.00',       exch: 'CBOT',  tickValue: '$5.00',  unit: '$5 x DJIA' },
  { root: 'MYM',  tick: '1.00',       exch: 'CBOT',  tickValue: '$0.50',  unit: '$0.50 x DJIA' },
  { root: 'RTY',  tick: '0.10',       exch: 'CME',   tickValue: '$5.00',  unit: '$50 x Russell 2000' },
  { root: 'M2K',  tick: '0.10',       exch: 'CME',   tickValue: '$0.50',  unit: '$5 x Russell 2000' },
  { root: 'NKD',  tick: '5.00',       exch: 'CME',   tickValue: '$25.00', unit: '$5 x Nikkei 225' },
  { root: 'EMD',  tick: '0.10',       exch: 'CME',   tickValue: '$10.00', unit: '$100 x S&P MidCap 400' },
  // Energy — NYMEX
  { root: 'CL',   tick: '0.01',       exch: 'NYMEX', tickValue: '$10.00', unit: '1,000 barrels' },
  { root: 'MCL',  tick: '0.01',       exch: 'NYMEX', tickValue: '$1.00',  unit: '100 barrels' },
  { root: 'NG',   tick: '0.001',      exch: 'NYMEX', tickValue: '$10.00', unit: '10,000 MMBtu' },
  { root: 'MNG',  tick: '0.001',      exch: 'NYMEX', tickValue: '$1.00',  unit: '1,000 MMBtu' },
  { root: 'QG',   tick: '0.005',      exch: 'NYMEX', tickValue: '$12.50', unit: '2,500 MMBtu' },
  { root: 'BZ',   tick: '0.01',       exch: 'NYMEX', tickValue: '$10.00', unit: '1,000 barrels' },
  { root: 'RB',   tick: '0.0001',     exch: 'NYMEX', tickValue: '$4.20',  unit: '42,000 gallons' },
  { root: 'HO',   tick: '0.0001',     exch: 'NYMEX', tickValue: '$4.20',  unit: '42,000 gallons' },
  // Metals — COMEX, except platinum and palladium, which are NYMEX
  { root: 'GC',   tick: '0.10',       exch: 'COMEX', tickValue: '$10.00', unit: '100 troy oz' },
  { root: 'MGC',  tick: '0.10',       exch: 'COMEX', tickValue: '$1.00',  unit: '10 troy oz' },
  { root: 'SI',   tick: '0.005',      exch: 'COMEX', tickValue: '$25.00', unit: '5,000 troy oz' },
  { root: 'SIL',  tick: '0.005',      exch: 'COMEX', tickValue: '$5.00',  unit: '1,000 troy oz' },
  { root: 'HG',   tick: '0.0005',     exch: 'COMEX', tickValue: '$12.50', unit: '25,000 lb' },
  { root: 'MHG',  tick: '0.0005',     exch: 'COMEX', tickValue: '$1.25',  unit: '2,500 lb' },
  { root: 'PL',   tick: '0.10',       exch: 'NYMEX', tickValue: '$5.00',  unit: '50 troy oz' },
  { root: 'PA',   tick: '0.50',       exch: 'NYMEX', tickValue: '$50.00', unit: '100 troy oz' },
  // FX — CME. Globex ticks; ClearPort's are a tenth of these and would seed 10x wrong.
  { root: '6E',   tick: '0.000050',   exch: 'CME',   tickValue: '$6.25',  unit: '125,000 EUR' },
  { root: 'M6E',  tick: '0.0001',     exch: 'CME',   tickValue: '$1.25',  unit: '12,500 EUR' },
  { root: '6B',   tick: '0.0001',     exch: 'CME',   tickValue: '$6.25',  unit: '62,500 GBP' },
  { root: 'M6B',  tick: '0.0001',     exch: 'CME',   tickValue: '$0.625', unit: '6,250 GBP' },
  { root: '6A',   tick: '0.00005',    exch: 'CME',   tickValue: '$5.00',  unit: '100,000 AUD' },
  { root: 'M6A',  tick: '0.0001',     exch: 'CME',   tickValue: '$1.00',  unit: '10,000 AUD' },
  { root: '6J',   tick: '0.0000005',  exch: 'CME',   tickValue: '$6.25',  unit: '12,500,000 JPY' },
  { root: '6C',   tick: '0.00005',    exch: 'CME',   tickValue: '$5.00',  unit: '100,000 CAD' },
  { root: '6S',   tick: '0.00005',    exch: 'CME',   tickValue: '$6.25',  unit: '125,000 CHF' },
  { root: '6N',   tick: '0.00005',    exch: 'CME',   tickValue: '$5.00',  unit: '100,000 NZD' },
  { root: '6M',   tick: '0.00001',    exch: 'CME',   tickValue: '$5.00',  unit: '500,000 MXN' },
  // Crypto — CME. See docs/market-hours.md: these are 24/7 and are the only products here whose
  // book is open across the 17:00 CT roll.
  { root: 'BTC',  tick: '5.00',       exch: 'CME',   tickValue: '$25.00', unit: '5 bitcoin' },
  { root: 'MBT',  tick: '5.00',       exch: 'CME',   tickValue: '$0.50',  unit: '0.1 bitcoin' },
  { root: 'ETH',  tick: '0.50',       exch: 'CME',   tickValue: '$25.00', unit: '50 ether' },
  { root: 'MET',  tick: '0.50',       exch: 'CME',   tickValue: '$0.05',  unit: '0.1 ether' },
];

// Currency is USD for every row and is still a column rather than a constant: it is not
// derivable, a non-USD product's P&L may never be summed with a USD one, and the day this table
// grows past CME Group is not the day to discover the assumption was hardcoded.
const CURRENCY = 'USD';

let written = 0;
for (const r of ROWS) {
  await db
    .insert(contractSpec)
    .values({ symbolRoot: r.root, tickSize: r.tick, currency: CURRENCY, exchange: r.exch })
    .onConflictDoUpdate({
      target: contractSpec.symbolRoot,
      set: { tickSize: r.tick, currency: CURRENCY, exchange: r.exch },
    });
  written++;
}

const all = await db.select().from(contractSpec);
console.log(`seeded ${written} row(s); contract_spec now holds ${all.length}.`);

// The bound in tape.ts is calibrated against these, so print the range it was calibrated on.
// If a future row falls outside it, that is a decision to make, not a number to nudge.
const values = ROWS.map((r) => Number(r.tickValue.replace(/[$,]/g, '')));
const lo = ROWS[values.indexOf(Math.min(...values))];
const hi = ROWS[values.indexOf(Math.max(...values))];
console.log(`tick value spans ${lo.tickValue} (${lo.root}) to ${hi.tickValue} (${hi.root}).`);
