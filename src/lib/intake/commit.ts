import 'server-only';
import { createHash } from 'node:crypto';
import { db, event, importBatch } from '@/lib/db';
import { IMPORT_SOURCES } from '@/lib/db/schema';
import { sessionDateFor } from '@/lib/time/session';
import type { EventValues } from './write';
import type { PreflightResult } from './preflight';

/* THE WRITE PATH. One import, one atomic batch, and a count that is the truth.
 *
 * Nothing above this decides what a row means; nothing below it knows what a Tradovate export is.
 * It takes finished event values and puts them in the log.
 */

/* 1,000 ROWS PER STATEMENT, and the ceiling is measured rather than assumed — but the arithmetic
 * that used to be written here was wrong twice over, and the gate agreed with it for the wrong
 * reason. Corrected 2026-08-15 against drizzle's own `toSQL()`.
 *
 * IT SAID: "Postgres caps a statement at 65,535 bind parameters. `event` binds 14 columns per row,
 * so 65535/14 = 4,681 rows", and the gate brackets exactly 4,681 / 5,000.
 *
 * BOTH HALVES WERE WRONG. `event` has 15 insertable columns, not 14. And drizzle only binds
 * columns whose value is not `undefined` — the rest emit a literal `default` and cost no
 * parameter — so the gate's own fixture binds 7 per row and the production fill shape binds 11.
 * Measured: 4,681 gate rows is 32,767 parameters, not 65,534.
 *
 * SO THE REAL CEILING IS 32,767, the signed int16 max, and 4,681 lands on it by coincidence:
 * 65535/14 and 32767.5/7 are the same number. The gate had been reading the right boundary off a
 * calculation that did not describe it.
 *
 * What that changes: at 11 bound columns the true safe maximum is 32767/11 = 2,978 rows, so 1,000
 * carries 3x headroom rather than the 4.7x the old note implied. Still safe. The comment was the
 * dangerous part, because it is what the next person reads before raising the chunk to 4,000.
 *
 * THE ERROR NEVER SAYS SO. Neon's http driver reports a generic "Database request failed" on both
 * sides of the boundary, so anyone hitting this in production would have no clue what the limit
 * was. */
const INSERT_CHUNK = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** sha256 of the file's bytes. The `(account_id, file_hash)` unique index turns a re-upload into a
 *  no-op at the FILE level — a different guarantee from the row-level dedupe on `event`, which
 *  catches the same trade arriving inside a *different* file. Hashing the text rather than the
 *  parsed rows is deliberate: it identifies the artefact the trader actually chose. */
export const hashFile = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

export interface CommitArgs {
  traderId: string;
  accountId: string;
  filename: string;
  fileText: string;
  /** DERIVED from the schema's own list, never re-typed. Three copies of one enum (the const
   *  array, the CHECK constraint, and a hand-written union here) meant adding a source widened
   *  neither the signature nor the build. */
  source: (typeof IMPORT_SOURCES)[number];
  /** Rows the parser produced. Kept separate from what the database accepts — see below. */
  rowsParsed: number;
  rowsRejected?: number;
  /** Finished event values. `importId` is filled in here, so callers pass a placeholder. */
  events: Omit<EventValues, 'importId'>[];
  /**
   * THE PREFLIGHT RESULT, REQUIRED, and it is required because every other guarantee in this file
   * is a convention the caller can forget.
   *
   * `preflight` is the whole of the loud-failure design and nothing structurally obliged anyone to
   * run it: the route S4e builds could have called `commitImport` directly and written an
   * unchecked import to an append-only log. The same reasoning the append-only TRIGGER exists for
   * applies here — "everything else in the doctrine is a convention a future writer can forget;
   * this is the only one that cannot be" — so the check becomes part of the type instead of part
   * of the etiquette. Passing a failing result throws below rather than writing.
   */
  preflight: PreflightResult;
}

export interface CommitResult {
  importId: string;
  /** Rows the parser produced. */
  rowsParsed: number;
  /** ROWS THE DATABASE ACTUALLY ACCEPTED. See the note on the return below. */
  rowsWritten: number;
  /** Trade dates covered, from the one time module. Null when the batch carried no events. */
  rangeStart: string | null;
  rangeEnd: string | null;
}

/**
 * Write one import: the provenance row and every event, in a single atomic batch.
 *
 * THE IMPORT ID IS GENERATED HERE, not read back from the insert, and that is what makes one
 * batch possible. `db.batch` runs its statements in one transaction but cannot feed the result of
 * statement 1 into statement 2 — so if the id came from the database, the events could not
 * reference it without a second round trip, and a crash in between would leave a provenance row
 * with no rows under it. A client-side uuid is known before anything is sent.
 *
 * ATOMIC BECAUSE A HALF-WRITTEN LOG CANNOT BE REPAIRED. `event` is append-only and enforced by a
 * trigger, so there is no cleanup path for a partial import — the rows would simply be there,
 * forever, with no import row to explain them. `db.batch` is the tool rather than
 * `db.transaction`, which the neon-http driver does not support at all.
 *
 * IT RETURNS ROWS WRITTEN, NEVER ROWS ATTEMPTED. `onConflictDoNothing` means a re-import inserts
 * nothing, and `.returning()` yields only the rows that actually landed. Reporting the parsed
 * count here is the bug this signature exists to prevent: "imported 187" when the real answer is
 * zero is precisely the kind of confident-wrong number the product is built against.
 */
export async function commitImport(args: CommitArgs): Promise<CommitResult> {
  /* THE GUARD IS HERE AND NOT IN THE CALLER, on purpose. A blocking finding means the numbers this
     import would write cannot be reconciled, and `event` is append-only: there is no later repair.
     Refusing at the write is the only place the refusal is unskippable. */
  if (!args.preflight.ok) {
    const blocking = args.preflight.findings.filter((f) => f.blocking).map((f) => f.code);
    throw new Error(`Refusing to commit an import that failed preflight: ${blocking.join(', ')}`);
  }

  const importId = crypto.randomUUID();
  const values = args.events.map((e) => ({ ...e, importId }));

  // The window this file covers, in TRADE dates, from the module that owns every time bucket.
  // Never `Math.min` on the raw instants formatted later — that would answer in the server's zone.
  const dates = values.map((v) => sessionDateFor(v.occurredAt)).sort();
  const rangeStart = dates[0] ?? null;
  const rangeEnd = dates[dates.length - 1] ?? null;

  const statements = [
    db.insert(importBatch).values({
      id: importId,
      traderId: args.traderId,
      accountId: args.accountId,
      filename: args.filename,
      fileHash: hashFile(args.fileText),
      source: args.source,
      rowsParsed: args.rowsParsed,
      rowsRejected: args.rowsRejected ?? 0,
      rangeStart,
      rangeEnd,
      // `pending` until the caller confirms. Nothing reads a pending import.
      status: 'pending',
    }),
    ...chunk(values, INSERT_CHUNK).map((c) =>
      db.insert(event).values(c).onConflictDoNothing().returning({ id: event.id })
    ),
  ];

  // drizzle's `batch()` wants a fixed-length tuple; this list is variable by design, one statement
  // per chunk. Every statement after the first has the same shape, so the assertion is safe.
  const results = (await db.batch(
    statements as unknown as Parameters<typeof db.batch>[0]
  )) as unknown as { id: number }[][];

  return {
    importId,
    rowsParsed: args.rowsParsed,
    rowsWritten: results.slice(1).reduce((n, rows) => n + rows.length, 0),
    rangeStart,
    rangeEnd,
  };
}

/**
 * Flip a pending import to committed.
 *
 * SEPARATE FROM THE WRITE, because the wireframe's step 3 is a real gate: the counts, the date
 * range and the fee-resolution figure are shown BEFORE anything is trusted, and the trader presses
 * Import. The events are already in the log by then — they have to be, to be counted honestly —
 * so what `committed` marks is not "the rows exist" but "a person looked at them and agreed".
 */
export async function markImportCommitted(importId: string): Promise<void> {
  const { eq } = await import('drizzle-orm');
  await db.update(importBatch).set({ status: 'committed' }).where(eq(importBatch.id, importId));
}

/** Mark a pending import rejected. The events stay: they are in an append-only log and cannot be
 *  removed, which is why a rejected import must be filtered out by every read rather than deleted.
 *  That is the cost of an immutable log, and it is a smaller cost than a log you can rewrite. */
export async function markImportRejected(importId: string): Promise<void> {
  const { eq } = await import('drizzle-orm');
  await db.update(importBatch).set({ status: 'rejected' }).where(eq(importBatch.id, importId));
}
