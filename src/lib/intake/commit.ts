import 'server-only';
import { createHash } from 'node:crypto';
import { db, event, importBatch } from '@/lib/db';
import { sessionDateFor } from '@/lib/time/session';
import type { EventValues } from './write';

/* THE WRITE PATH. One import, one atomic batch, and a count that is the truth.
 *
 * Nothing above this decides what a row means; nothing below it knows what a Tradovate export is.
 * It takes finished event values and puts them in the log.
 */

/* 1,000 ROWS PER STATEMENT, and the ceiling is measured rather than assumed.
 *
 * Postgres caps a statement at 65,535 bind parameters. `event` binds 14 columns per row, so the
 * arithmetic predicts 65535/14 = 4,681 rows — and `scripts/s4-gate.mts` §5 brackets it: 4,681
 * inserts, 5,000 does not.
 *
 * THE ERROR NEVER SAYS SO. Neon's http driver reports a generic "Database request failed" on both
 * sides of the boundary, so anyone hitting this in production would have no clue what the limit
 * was. 1,000 is comfortably under it and is a round number that survives someone adding a column
 * to `event` without re-deriving anything. */
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
  source: 'tradovate_csv' | 'tradezella_csv' | 'tradovate_oauth';
  /** Rows the parser produced. Kept separate from what the database accepts — see below. */
  rowsParsed: number;
  rowsRejected?: number;
  /** Finished event values. `importId` is filled in here, so callers pass a placeholder. */
  events: Omit<EventValues, 'importId'>[];
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
