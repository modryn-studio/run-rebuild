// SEED contract_spec — narrow, from the exchange's own published spec, idempotent.
//
// Run: npx tsx --env-file=.env.local --conditions=react-server scripts/seed-contract-spec.mts
//
// A SCRIPT, NOT A MIGRATION. This is data, so it corrects without a deploy (architecture.md).
// Baked into a migration it would need a schema change to fix a typo, which is the wrong shape
// for a table whose whole job is to be edited when a real import quarantines something.
//
// ── WHY THERE ARE ONLY TWO ROWS ───────────────────────────────────────────────────────────
// The asymmetry decides the width, and it is not close:
//
//   a MISSING row  -> the trade quarantines, loudly, in front of the trader
//   a WRONG row    -> a plausible number nobody catches, under every figure in the product
//
// So breadth bought from memory is a liability rather than coverage. MNQ and NQ are what Luke's
// corpus actually contains (612 fills, 357 round trips, two roots). ES and MES are not seeded
// even though they are the obvious next two, because "obvious" is exactly the reasoning that
// puts an unverified row in the table.
//
// ── AND WHY point_value_cents IS NOT HERE ─────────────────────────────────────────────────
// It was the reason this table existed and it is now derived from the trader's own round trips
// (architecture.md, the contract_spec section). The published CONTRACT UNIT below is recorded
// in the comments as a CROSS-CHECK, never as the source — derivation rule 6. The check has been
// run once already and it passed cleanly:
//
//   MNQ   derived $2.00 from 296 round trips   ·  CME publishes "$2 x Nasdaq-100 Index"
//   NQ    derived $20.00 from 61 round trips   ·  CME publishes "$20 x Nasdaq-100 Index"
//
// Both to the cent, from the broker's realised P&L, with no table involved. If a future import
// ever disagrees with the published unit, that disagreement is a FINDING to surface, not a
// reason to overwrite what the broker actually paid.
import { loadEnv } from './load-env.mts';

loadEnv();

const { db, contractSpec } = await import('../src/lib/db/index.ts');

// Read 2026-08-12 from CME Group's own contract-spec pages, by reading the markup rather than a
// summary of it. `tickSize` is in QUOTE UNITS (index points), never money — the dollar figure
// beside it is the tick's VALUE, which is point value x tick size and therefore derived, not
// stored. Naming the unit in the field is the rule that stops a 2.13-point gap being rendered
// as $2.13 (architecture.md, price precision).
const ROWS = [
  {
    // Micro E-mini Nasdaq-100 Index Futures
    // https://www.cmegroup.com/markets/equities/nasdaq/micro-e-mini-nasdaq-100.contractSpecs.html
    // CONTRACT UNIT               $2 x Nasdaq-100 Index          (cross-check only)
    // MINIMUM PRICE FLUCTUATION   Outright: 0.25 index points = $0.50
    // PRICE QUOTATION             U.S. dollars and cents per index point
    // EXCHANGE RULEBOOK           CME 361
    symbolRoot: 'MNQ',
    tickSize: '0.25',
    currency: 'USD',
    exchange: 'CME',
  },
  {
    // E-mini Nasdaq-100 Futures
    // https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html
    // CONTRACT UNIT               $20 x Nasdaq-100 Index         (cross-check only)
    // MINIMUM PRICE FLUCTUATION   Outright: 0.25 index points = $5.00
    // PRICE QUOTATION             U.S. dollars and cents per index point
    // EXCHANGE RULEBOOK           CME 359
    symbolRoot: 'NQ',
    tickSize: '0.25',
    currency: 'USD',
    exchange: 'CME',
  },
] as const;

// Upsert rather than insert, so re-running is a no-op and a corrected value lands without
// anybody deleting a row by hand in a database console.
for (const row of ROWS) {
  await db
    .insert(contractSpec)
    .values(row)
    .onConflictDoUpdate({
      target: contractSpec.symbolRoot,
      set: { tickSize: row.tickSize, currency: row.currency, exchange: row.exchange },
    });
  console.log(`  seeded  ${row.symbolRoot}  tick ${row.tickSize} ${row.exchange} ${row.currency}`);
}

const all = await db.select().from(contractSpec);
console.log(`\ncontract_spec now holds ${all.length} row(s).`);
