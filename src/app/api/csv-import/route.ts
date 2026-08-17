import { after } from 'next/server';
import { createRouteLogger } from '@/lib/route-logger';
import { getTrader } from '@/lib/trader';
import { detectTradovateFileType, type TradovateFileType } from '@/lib/csv/shared';
import { parseTradovateFillsCsv } from '@/lib/csv/fills';
import { parseTradovatePositionHistoryCsv } from '@/lib/csv/position-history';
import { parseCashHistory } from '@/lib/csv/cash-history';
import { parseTradovateOrdersCsv } from '@/lib/csv/orders';
import { parseAccountBalanceHistory } from '@/lib/csv/account-balance';
import { preflight, type PreflightFinding } from '@/lib/intake/preflight';
import { resolveAccountsFor } from '@/lib/intake/accounts';
import { commitImport, markImportCommitted } from '@/lib/intake/commit';
import {
  fillEventValues,
  roundTripEventValues,
  feeEventValues,
  orderEventValues,
} from '@/lib/intake/write';
import { resolveRoundTripInstant, resolveOrderInstant } from '@/lib/intake/round-trip-instant';
import { IMPORT_STREAM_CONTENT_TYPE, type ImportEvent } from '@/lib/intake/stream';
import { sendNotification, notifyHtml, alertSubject } from '@/lib/notify';
import { track } from '@/lib/track';
import type { ParsedFill } from '@/lib/csv/fills';

const log = createRouteLogger('csv-import');

/* A batch can be months of tape: five files, thousands of rows each, chunked inserts. Past
 * Vercel's default ceiling on a large first import, and a timeout HERE loses the corpus write
 * rather than just a read. See issue #5 for what this does not yet survive: the whole import is
 * one `db.batch` in one request, so a committed-but-timed-out run leaves rows under a `pending`
 * import that the file-hash unique index then refuses to let the trader retry. */
export const maxDuration = 60;

/* ORDER IS A CORRECTNESS REQUIREMENT, not a nicety, and it is why this route takes every file at
 * once rather than one per request.
 *
 * A round trip's true instant is resolved from the FILLS it references — Position History carries
 * local wall-clock with no zone — and a fee reaches its trade through the raw bucket string it
 * shares with its fill. So fills must be parsed before either. Rather than making the trader get
 * the drag-and-drop order right, the batch is sorted here. Anything unrecognised lands last and is
 * reported, never silently dropped. */
const INGEST_ORDER: TradovateFileType[] = [
  'fills',
  'position_history',
  'cash_history',
  'orders',
  'account_balance',
];
const orderRank = (t: TradovateFileType | undefined) => {
  const i = INGEST_ORDER.indexOf(t as TradovateFileType);
  return i === -1 ? INGEST_ORDER.length : i;
};

const headersOf = (csvText: string): string[] =>
  (csvText.split(/\r?\n/, 1)[0] ?? '').split(',').map((h) => h.trim());

export async function POST(req: Request): Promise<Response> {
  const ctx = log.begin();
  let traderId: string | null = null;
  let authUserIdOuter: string | null = null;

  try {
    const form = await req.formData().catch(() => null);
    const files = (form?.getAll('file') ?? []).filter((f): f is File => typeof f !== 'string');
    if (files.length === 0) {
      return log.end(ctx, Response.json({ error: 'No file provided' }, { status: 400 }));
    }

    /* IDENTITY FROM THE SESSION, NEVER FROM THE REQUEST. There is no trader id in the form above
       and that absence is the point — the record is somebody's trading history. */
    const trader = await getTrader();
    if (!trader) {
      return log.end(ctx, Response.json({ error: 'Not signed in' }, { status: 401 }));
    }
    traderId = trader.id;

    // Read everything first so the whole batch can be ordered before anything is parsed.
    const staged = await Promise.all(
      files.map(async (file) => {
        const csvText = await file.text();
        return { file, csvText, type: detectTradovateFileType(headersOf(csvText)) };
      })
    );

    const skipped = staged.filter((s) => !s.type).map((s) => s.file.name);
    const recognised = staged.filter((s) => s.type).sort((a, b) => orderRank(a.type) - orderRank(b.type));
    if (recognised.length === 0) {
      return log.end(
        ctx,
        Response.json(
          { error: `Not a Tradovate export: ${skipped.join(', ')}. Re-export from the Reports tab.` },
          { status: 400 }
        )
      );
    }

    /* Everything above can still fail with a real status code. From here the response is committed
       to 200 and a failure has to travel as an `error` event inside the stream. */
    const encoder = new TextEncoder();
    const importedTrader = trader.id;
    /* `analytics_event.user_id` references the AUTH user, not the trader row — the funnel starts
       before a trader exists, so it could not key on one. */
    const authUserId = trader.authUserId;
    authUserIdOuter = authUserId;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: ImportEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        /** A refusal, not a crash: the checks did their job. Distinct from the catch below. */
        const refuse = (message: string, findings: PreflightFinding[]) => {
          log.warn(ctx.reqId, 'import refused by preflight', {
            codes: findings.map((f) => f.code).join(','),
          });
          send({ type: 'error', message, findings });
        };

        try {
          // ── parse ────────────────────────────────────────────────────────────────────────
          const fills = recognised
            .filter((s) => s.type === 'fills')
            .flatMap((s) => parseTradovateFillsCsv(s.csvText));
          const roundTrips = recognised
            .filter((s) => s.type === 'position_history')
            .flatMap((s) => parseTradovatePositionHistoryCsv(s.csvText));
          const cash = recognised
            .filter((s) => s.type === 'cash_history')
            .map((s) => parseCashHistory(s.csvText));
          const fees = cash.flatMap((c) => c.fees);
          const tradePaired = cash.flatMap((c) => c.tradePaired);
          const orders = recognised
            .filter((s) => s.type === 'orders')
            .flatMap((s) => parseTradovateOrdersCsv(s.csvText));
          const statementFiles = recognised
            .filter((s) => s.type === 'account_balance')
            .map((s) => parseAccountBalanceHistory(s.csvText));
          const statement = {
            days: statementFiles.flatMap((s) => s.days),
            unreadableRows: statementFiles.reduce((n, s) => n + s.unreadableRows, 0),
            unrecognised: statementFiles.some((s) => s.unrecognised),
          };

          /* ── EVERY CHECK, BEFORE A SINGLE ROW IS WRITTEN ────────────────────────────────
             This is the whole of the loud-failure design and it runs here rather than behind a
             confirm panel (Luke, 2026-08-15). The trader is not asked to approve the numbers; the
             numbers are simply never stored if they cannot be reconciled. `commitImport` refuses a
             failing result too, so this is a second gate rather than the only one. */
          const checks = preflight({ fills, roundTrips, fees, tradePaired, statement });
          if (!checks.ok) {
            refuse(
              'These files cannot be imported yet.',
              checks.findings.filter((f) => f.blocking)
            );
            return;
          }

          /* ── ONE ACCOUNT, FOR NOW, AND IT REFUSES RATHER THAN GUESSING ──────────────────
             `commitImport` takes a single `accountId` for the whole import, so a genuine
             multi-account export cannot be committed correctly (issue #5). Preflight already
             reconciles per account, so the checks understand a copy-trader even though the write
             does not — which makes this the exact place to stop.
             Filing five accounts' rows under one would make a single 1-lot position read as a
             5-lot, in an append-only log, silently. A refusal costs the trader a re-export; the
             alternative costs them every figure derived from position size. */
          const accountIds = await resolveAccountsFor(fills, { traderId: importedTrader });
          if (accountIds.size > 1) {
            refuse(`These files cover ${accountIds.size} accounts. Export one account at a time.`, [
              {
                code: 'accounts_differ',
                blocking: true,
                detail: { total: accountIds.size, fillAccounts: [...accountIds.keys()] },
              },
            ]);
            return;
          }
          const accountId = [...accountIds.values()][0];
          if (!accountId) {
            /* Only reachable with zero Fills AND zero round trips AND at least one fee row — every
               other empty combination is already caught above (`fills_empty` needs round trips,
               `nothing_to_import` needs every count at zero). `rows_unnamed`'s copy is about ROWS
               THAT EXIST but carry no account name; here no fills exist to name one at all, so
               reusing that code would report "0 of your 0 rows" instead of the real problem. No
               findings, so `ImportRefused` falls back to this plain message. */
            refuse('No account named in these files.', []);
            return;
          }

          // ── build every event, in dependency order ───────────────────────────────────────
          const instantByFillId = new Map<string, Date>();
          const fillByBucket = new Map<string, ParsedFill>();
          const instantByOrderId = new Map<string, Date>();
          for (const f of fills) {
            if (f.externalFillId) instantByFillId.set(f.externalFillId, f.filledAt);
            if (f.feeBucketKey && !fillByBucket.has(f.feeBucketKey)) fillByBucket.set(f.feeBucketKey, f);
            /* EARLIEST fill wins for an order: a scaled entry fills in several parts and the order
               was placed before the first of them, so the first fill is the closest real instant
               the batch holds. Taking the last would date the order by when it finished filling. */
            if (f.externalOrderId) {
              const seen = instantByOrderId.get(f.externalOrderId);
              if (!seen || f.filledAt < seen) instantByOrderId.set(f.externalOrderId, f.filledAt);
            }
          }
          const common = { traderId: importedTrader, accountId, importId: '', source: 'csv' as const };

          const events = [
            ...fillEventValues(common, fills),
            ...roundTripEventValues(
              common,
              roundTrips.map((rt) => {
                const { at, timeSource } = resolveRoundTripInstant(rt, instantByFillId);
                return { rt, occurredAt: at, timeSource };
              })
            ),
            /* A fee's instant is its FILL's, never Cash History's own local string — that column
               carries no zone, so parsing it resolves against the server's offset and files an
               evening fee under the previous trade date. Unbucketed fees were already refused by
               `fees_partial` above, so `filter` here drops nothing a passing import still holds. */
            ...feeEventValues(
              common,
              fees
                .map((fee) => ({ fee, fill: fee.bucketKey ? fillByBucket.get(fee.bucketKey) : undefined }))
                .filter((x): x is { fee: (typeof fees)[number]; fill: ParsedFill } => !!x.fill)
                .map(({ fee, fill }) => ({ fee, occurredAt: fill.filledAt }))
            ),
            /* ORDERS BORROW THEIR FILL'S UTC WHERE THEY HAVE ONE. That export carries no timezone
               column at all, so a filled order is dated exactly from the fill that references it
               and an unfilled one — a cancelled stop, a rejected entry — falls back to the local
               clock and says so on the payload. Most orders are the second kind. */
            ...orderEventValues(
              common,
              orders.map((order) => {
                const { at, timeSource } = resolveOrderInstant(order, instantByOrderId);
                return { order, occurredAt: at, timeSource };
              })
            ),
          ];

          /* ── ONE COMMIT, ONE FILE HASH ──────────────────────────────────────────────────
             The hash identifies the artefact the trader chose, so the batch is hashed as one
             document: `(account_id, file_hash)` then makes re-uploading this exact set a no-op at
             the FILE level, which is a different guarantee from the row-level dedupe on `event`. */
          const fileText = recognised.map((s) => s.csvText).join('\n');
          const result = await commitImport({
            traderId: importedTrader,
            accountId,
            filename: recognised.map((s) => s.file.name).join(', '),
            fileText,
            source: 'tradovate_csv',
            rowsParsed: events.length,
            events,
            preflight: checks,
          });
          await markImportCommitted(result.importId);

          /* ── REPORT PER FILE ────────────────────────────────────────────────────────────
             The panel wants one event per file as it lands. The write is a single atomic batch, so
             every row landed at the same instant and these are a breakdown of one result rather
             than four separate writes. Proportional attribution would be a lie dressed as detail,
             so each file reports its own PARSED count against the batch's real written total: the
             last file carries the remainder, and the totals in `done` are authoritative. */
          const byType = new Map<TradovateFileType, number>();
          for (const s of recognised) {
            const parsedForType =
              s.type === 'fills'
                ? fills.length
                : s.type === 'position_history'
                  ? roundTrips.length
                  : s.type === 'cash_history'
                    ? fees.length
                    : s.type === 'orders'
                      ? orders.length
                      : statement.days.length;
            byType.set(s.type!, parsedForType);
          }
          let remaining = result.rowsWritten;
          const types = [...byType.keys()];
          for (const [i, type] of types.entries()) {
            const parsed = byType.get(type) ?? 0;
            const imported = i === types.length - 1 ? remaining : Math.min(remaining, parsed);
            remaining -= imported;
            send({ type: 'file', fileType: type, imported, parsed, accounts: [...accountIds.keys()] });
          }

          send({
            type: 'done',
            imported: result.rowsWritten,
            parsed: result.rowsParsed,
            accounts: [...accountIds.keys()],
            skipped,
            // Non-blocking findings still have to reach the trader: the import landed and a number
            // in it is worth a second look.
            warnings: checks.findings.filter((f) => !f.blocking),
          });
          log.info(ctx.reqId, 'CSV batch imported', {
            files: recognised.length,
            parsed: result.rowsParsed,
            imported: result.rowsWritten,
          });

          /* AFTER, NOT AWAITED. The client's `for await` over the NDJSON body only ends when the
             body closes, and the body does not close until this resolves — so awaiting analytics
             and a first-import email would make every trader sit on the progress panel through an
             SMTP handshake, invisible to the panel's own timing budget. `after()` rather than a
             floating promise, which CAN be killed when the response completes. */
          after(async () => {
            await Promise.allSettled([
              track('upload_completed', {
                userId: authUserId,
                properties: { files: recognised.length, imported: result.rowsWritten },
              }),
              notifyMismatch(importedTrader, checks.findings),
            ]);
          });
        } catch (error) {
          log.err(ctx, error);
          /* Reaching here means the write may already have landed. That is fine and is why the
             trader can simply retry: the batch is atomic, and the dedupe key makes a second pass
             over an already-imported file a no-op. */
          const message = error instanceof Error ? error.message : 'Import failed';
          send({ type: 'error', message });
          await Promise.allSettled([
            track('upload_failed', { userId: authUserId, properties: { reason: message.slice(0, 200) } }),
            sendNotification(
              alertSubject('🚨', 'CSV import failed'),
              notifyHtml('CSV import failed', [
                ['Trader ID', importedTrader],
                ['Error', message],
                ['When (UTC)', new Date().toISOString()],
              ]),
              { throttleKey: 'csv_import_failure', cooldownMinutes: 60 }
            ),
          ]);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': IMPORT_STREAM_CONTENT_TYPE,
        // A proxy that buffers would defeat the whole point by delivering every event at once.
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    /* Only PRE-stream failures reach here: no files, unauthenticated, unreadable form, nothing
       recognised. Once ingest begins the response is already a 200 stream and errors travel inside
       it. These are validation, i.e. the trader being a trader rather than an incident, so no alert
       fires — alerting on them is how an alert inbox becomes noise you stop reading. */
    log.err(ctx, error);
    const message = error instanceof Error ? error.message : 'Import failed';
    void track('upload_failed', { userId: authUserIdOuter, properties: { reason: message.slice(0, 200) } });
    return log.end(ctx, Response.json({ error: message }, { status: 400 }));
  }
}

/* AN IMPORT WHOSE SOURCES DISAGREE, alerted to Luke and not to the trader, deliberately and for now.
 *
 * A non-blocking reconciliation finding means the numbers may be off, and nobody has yet seen one
 * in the wild to know the false-positive rate. Warn the person who can investigate first; decide
 * what the trader sees once there is evidence.
 *
 * THROTTLED BY THE HOUR, not `once`. A trader retrying the same mismatched pair three times is one
 * problem; a genuinely new mismatch next week is worth hearing about again. */
async function notifyMismatch(traderId: string, findings: PreflightFinding[]): Promise<void> {
  const recon = findings.filter(
    (f) => f.code === 'pnl_unreconciled' || f.code === 'statement_uncovered'
  );
  if (recon.length === 0) return;

  const usd = (c: number | undefined) => `$${((c ?? 0) / 100).toFixed(2)}`;
  await sendNotification(
    alertSubject('⚠️', 'Import did not fully reconcile'),
    notifyHtml(
      'Import did not fully reconcile',
      recon.map((f): [string, string] => [
        f.code,
        f.code === 'pnl_unreconciled'
          ? `broker ${usd(f.detail.brokerCents)} vs ours ${usd(f.detail.ourCents)}, off by ${usd(f.detail.diffCents)} across ${f.detail.comparedRoundTrips} round trips`
          : `${f.detail.uncoveredDays?.length ?? 0} statement days not covered, worth ${usd(f.detail.uncoveredCents)}`,
      ])
    ),
    { throttleKey: `recon_mismatch:${traderId}`, cooldownMinutes: 60 }
  );
}
