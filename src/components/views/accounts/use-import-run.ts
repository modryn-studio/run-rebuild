'use client';

/* Drives the import progress panel from the REAL server stream. Ported from `run-trading@v2`
 * (2026-08-15, S4e).
 *
 * Every step corresponds to work that actually happened: the list is built from the file types the
 * trader really staged, each one flips to done only when the server says that file landed, and the
 * counts are rows the database actually accepted. Nothing advances on a timer. That is the whole
 * reason the route streams NDJSON instead of returning once.
 */

import { useCallback, useState } from 'react';
import { analytics } from '@/lib/analytics';
import { readImportStream } from '@/lib/intake/stream';
import type { PreflightFinding } from '@/lib/intake/preflight';
import type { TradovateFileType } from '@/lib/csv/shared';
import type { Step } from './progress-panel';

/** What the trader gets back once the whole run resolves. */
export interface ImportOutcome {
  /** Rows the database ACCEPTED. Zero on a re-upload, which is correct and is its own screen. */
  imported: number;
  /** Rows read from the files, whether or not they were new. */
  parsed: number;
  /** Account names seen across the batch. More than one means a copy-trader. */
  accounts: string[];
  /** Non-blocking findings. The import landed and these still deserve saying. */
  warnings: PreflightFinding[];
}

/* Server file type → what the trader calls it. "Trades" not "round trips": the export is named
 * Position History and the rows are their trades; nobody thinks in FIFO pairings.
 *
 * ONE VERB, AND NO TRAILING NOUNS (Luke, 2026-08-03, after asking whether the list was centred). It
 * was not, and measuring said why: the track is `w-max`, so its width is set by the WIDEST row and
 * every row shares a left edge to keep the bullets in a column. The longest label therefore lands
 * centred and every shorter one sits left of it — "Saving your fills" read 36px left of the card's
 * centre while "Filing your performance report" read 18px right of it.
 *
 * That is a COPY problem, not a layout one. Centring each row instead would fix the text and break
 * the bullets, which would then jitter horizontally as labels change length. So "report" and
 * "history" are gone — the trader is watching their own upload and knows what a balance file is —
 * and the Filing/Saving split went with them. That split encoded required versus optional, which is
 * real but not a thing anyone needs told mid-upload, and it cost the optional rows both a different
 * verb and the extra width. One verb also aligns the first word down the column, so the rows read
 * as a set even where the tails differ. */
const FILE_LABELS: Record<string, string> = {
  fills: 'Saving your fills',
  position_history: 'Saving your trades',
  cash_history: 'Saving your fees',
  orders: 'Saving your orders',
  account_balance: 'Checking the statement',
  performance: 'Saving your performance',
};

/* Mirrors the server's ingest order so the pending rows appear in the order they will complete. A
 * list that reorders itself as results arrive would read as confusion, not progress. */
const ORDER = ['fills', 'position_history', 'cash_history', 'orders', 'account_balance'];
const rank = (t: string) => (ORDER.indexOf(t) === -1 ? ORDER.length : ORDER.indexOf(t));

const UNIT: Record<string, string> = {
  fills: 'fills',
  position_history: 'trades',
  cash_history: 'fee lines',
  orders: 'orders',
  account_balance: 'days',
};

/* The client already detected each file's type to gate the Continue button, so the step list can be
 * built before the request goes out — the trader sees what is coming, not just what is done.
 *
 * NO `extract` STEP. v2 ran a model call here and this build has no equivalent yet: the read is
 * S6/S7 and is behind the blocked pattern-versus-reading decision. Worth knowing when it lands, from
 * v2's own audit: two of its three callers threw the facts away and were paying for the single
 * longest beat in the panel to render nothing. */
export function buildSteps(fileTypes: string[]): Step[] {
  const seen = [...new Set(fileTypes)].filter(Boolean).sort((a, b) => rank(a) - rank(b));
  return [
    { id: 'read', label: 'Reading your files', state: 'active' },
    ...seen.map((t): Step => ({ id: t, label: FILE_LABELS[t] ?? `Saving your ${t}`, state: 'pending' })),
  ];
}

/**
 * idle      nothing has been attempted
 * running   work in flight, every exit locked
 * settling  all steps ticked, holding so the final check is actually SEEN before the handoff
 * failed    stopped, panel stays put with the failing step visible so it can be acted on
 */
export type RunPhase = 'idle' | 'running' | 'settling' | 'failed';

interface Run {
  steps: Step[];
  error: string | null;
  /** The structured findings behind `error`, when the failure was a preflight refusal rather than
   *  an exception. This is the only surface the thirteen codes ever reach. */
  findings: PreflightFinding[];
  phase: RunPhase;
  start: (files: File[], fileTypes: TradovateFileType[]) => Promise<ImportOutcome | null>;
  reset: () => void;
}

/* Long enough for the check to draw plus a breath. Not a fake step and not a manufactured gate: it
 * is the true terminal state of a real process, held long enough to register. Without it the phase
 * change landed in the same React commit as the final tick, so the panel unmounted on the very
 * render that ticked the last check and the trader never saw the work finish. */
const SETTLE_MS = 700;

/* THE BEAT: how long a step holds before it may tick. On a session-sized export the real ingest for
 * each file finishes in single-digit milliseconds, so without a floor the whole checklist resolves
 * inside one frame and a trader never reads a row (caught dogfooding, 2026-07-24). This never SLOWS
 * a real large import — it only holds a step open when the work finished faster than a human can
 * read, which is the one case it exists for.
 *
 * IT ADAPTS TO THE STEP COUNT, and that is the part that was wrong (Luke, 2026-08-03). A flat 500ms
 * per row made the checklist LONGER the more exports you staged: three files 2.0s, six files 3.5s.
 * Asked which he uploads, Luke's answer settles it — "users might upload the required three or all
 * six. you never know" — so the pacing cannot assume either. A fixed budget divided across the rows
 * makes four steps and seven steps land within ~150ms of each other instead of 1.5s apart.
 *
 * WHY 700 AND NOT LESS: the beat has to be longer than the track's own motion or the list never
 * rests. That was the real bug behind "the rotating messages fly by" — the scroll animation and the
 * cadence were BOTH 500ms, so a new slide began the instant the last ended and the steps never
 * landed, they smeared. The track is 260ms, so every beat has stillness in it: 440ms at the calm
 * end, 160ms at the tightest. The check draws inside that stillness. */
const BEAT_MAX = 700;
const BEAT_MIN = 420;
const BEAT_BUDGET = 2800;

const beatFor = (rows: number) =>
  Math.max(BEAT_MIN, Math.min(BEAT_MAX, Math.round(BEAT_BUDGET / Math.max(1, rows))));

/* `dryRun` IS A DEMO-ONLY ESCAPE HATCH, AND IT IS A SAFETY PROPERTY RATHER THAN A CONVENIENCE.
 *
 * `/kitchen-sink/demo` mounts the REAL upload step so the screens can be judged without a session
 * and without re-uploading five CSVs to reach the one you are iterating. But the real upload step
 * posts to `/api/csv-import`, so staging files there and pressing Continue would write to the
 * corpus. A demo that can mutate the database is not a demo.
 *
 * v2 LEARNED THIS THE EXPENSIVE WAY and the lesson is worth carrying with the code: its upload
 * scene was behind `dryRun` while its Add-manually scene was not, so walking those screens created
 * four live accounts from a page whose own header promised it could not. Its note draws the right
 * conclusion — "the rule is the property, not the patch: if a form mounted here can reach the
 * network, this file is lying."
 *
 * When true, `start()` walks the same step machine on the same measured beats and returns a
 * fabricated outcome, without ever touching the network. What stays REAL is everything worth
 * reviewing: file staging, header detection, the step list, the beat, and every layout decision.
 * Only the request is suppressed.
 */
export function useImportRun(options?: { dryRun?: boolean }): Run {
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<PreflightFinding[]>([]);
  const [phase, setPhase] = useState<RunPhase>('idle');

  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
    setFindings([]);
    setPhase('idle');
  }, []);

  const dryRun = options?.dryRun ?? false;

  const start = useCallback(
    async (files: File[], fileTypes: TradovateFileType[]): Promise<ImportOutcome | null> => {
      if (dryRun) {
        /* THE SAME BEAT THE REAL SMALL IMPORT RUNS, which is the thing being tuned. v2's dry run
           passed raw client labels where the live path passed server keys, so every id missed both
           lookups: the panel read "Filing Fills" instead of "Saving your fills" and every row ran a
           flat 1500ms, meaning the "measured beats" its own comment promised had never once run.
           That cannot recur here, because both sides of this build share one detector and there are
           no client labels to mistranslate. */
        const rows = buildSteps(fileTypes);
        const dryBeat = beatFor(rows.length);
        setPhase('running');
        setSteps(rows);
        for (let i = 0; i < rows.length; i++) {
          await new Promise((r) => setTimeout(r, dryBeat));
          setSteps((prev) =>
            prev.map((st, j) =>
              j === i ? { ...st, state: 'done' } : j === i + 1 ? { ...st, state: 'active' } : st
            )
          );
        }
        setPhase('settling');
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        /* A NON-ZERO `imported`, because the completion screen branches on it (`#79`) and a dry run
           reporting 0 would rehearse the re-upload screen every time instead of the normal one.
           Obviously synthetic, per the rack's no-plausible-fixtures rule. */
        return { imported: 777, parsed: 777, accounts: ['DEMOACCT0000001'], warnings: [] };
      }

      /* ONE STEP PER TYPE, AND THE SERVER EMITS ONE EVENT PER TYPE TOO, not per file: `route.ts`
         parses every file of a type into one aggregate array before it ever reaches the reporting
         loop, so two Fills exports from different days (a supported upload) produce a single
         `fills` event covering both. An earlier version of this hook counted staged FILES and
         waited for that many events per type, which is the server's `stream.ts` contract as
         documented but not as built — the step for a duplicated type never received its second
         event and sat active forever. Matching what the server actually sends needs no counting
         at all: the one event that arrives for a type IS that type done. */
      let current = buildSteps(fileTypes);
      setSteps(current);
      setError(null);
      setFindings([]);
      setPhase('running');
      analytics.uploadStarted(files.length);

      /* When each step went active, so the floor knows how much longer to hold. `read` is active
         from the very start, so it is seeded here rather than on activation. */
      const activatedAt = new Map<string, number>([['read', Date.now()]]);
      const beat = beatFor(current.length);

      const apply = (next: Step[]) => {
        current = next;
        setSteps(next);
      };
      /** Returns whether a step actually matched, so a server event with no corresponding row
       *  cannot silently advance the list. */
      const mark = (id: string, patch: Partial<Step>): boolean => {
        if (!current.some((s) => s.id === id)) return false;
        apply(current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
        return true;
      };
      // Advance to the next pending step, so the live row is always the one actually being worked.
      const activateNext = () => {
        const next = current.find((s) => s.state === 'pending');
        if (next) {
          mark(next.id, { state: 'active' });
          activatedAt.set(next.id, Date.now());
        }
      };
      /** A no-op the moment a step's real work already took long enough to read on its own. This
       *  only ever ADDS a short wait, never removes real time. */
      const waitForMinVisible = async (id: string) => {
        const startedAt = activatedAt.get(id);
        if (startedAt == null) return;
        const remaining = beat - (Date.now() - startedAt);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      };
      /* The panel HOLDS on failure rather than teleporting back to the file picker. The trader
         needs to see which step broke, and anything that already landed keeps its tick — that is
         true, and it is what makes a retry obviously safe rather than a gamble. */
      const fail = (id: string, message: string, why: PreflightFinding[] = []) => {
        apply(current.map((s) => (s.id === id ? { ...s, state: 'failed', detail: message } : s)));
        setError(message);
        setFindings(why);
        setPhase('failed');
        analytics.uploadFailed(why[0]?.code ?? 'exception');
      };

      try {
        const form = new FormData();
        for (const f of files) form.append('file', f);

        const res = await fetch('/api/csv-import', { method: 'POST', body: form });

        // Pre-stream failures (auth, nothing recognised) still arrive as ordinary JSON errors.
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          fail('read', body?.error ?? 'Upload failed. Please try again.');
          return null;
        }

        await waitForMinVisible('read');
        mark('read', { state: 'done' });
        activateNext();

        let done: ImportOutcome | null = null;

        for await (const ev of readImportStream(res.body)) {
          if (ev.type === 'file') {
            const unit = UNIT[ev.fileType] ?? 'rows';
            /* The count is what the DATABASE took, not what the file held. On a re-upload that is
               legitimately 0, and saying so is the point. */
            const detail = ev.imported === 0 ? 'Already saved' : `${ev.imported.toLocaleString()} ${unit}`;
            await waitForMinVisible(ev.fileType);
            if (mark(ev.fileType, { state: 'done', detail })) activateNext();
          } else if (ev.type === 'done') {
            done = {
              imported: ev.imported,
              parsed: ev.parsed,
              accounts: ev.accounts,
              warnings: ev.warnings,
            };
            /* v2 filtered unreported rows out of the list here, because its client and server
               detected file types with two INDEPENDENT rule sets and could legitimately disagree
               about an optional export — leaving a row pulsing forever. Both sides now call
               `detectTradovateFileType`, so that disagreement is not reachable and the defence is
               gone with it. If a row ever does go unreported it stays visible and un-ticked, which
               is the honest rendering of "we did not process this". */
          } else {
            /* Mid-stream failure. Whatever already landed stays landed and stays ticked; retrying
               is a no-op for those files because of the dedupe key. */
            const live = current.find((s) => s.state === 'active');
            fail(live?.id ?? 'read', ev.message, ev.findings ?? []);
            return null;
          }
        }

        if (!done) {
          fail(
            current.find((s) => s.state === 'active')?.id ?? 'read',
            'The upload ended early. Please try again.'
          );
          return null;
        }

        /* Let the finished list land before handing off. Phase stays non-idle throughout, so the
           file picker cannot flash between the last tick and the completion screen. */
        setPhase('settling');
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        analytics.uploadCompleted(files.length, done.imported);
        return done;
      } catch (e) {
        const live = current.find((s) => s.state === 'active');
        fail(live?.id ?? 'read', e instanceof Error ? e.message : 'Upload failed. Please try again.');
        return null;
      }
    },
    [dryRun]
  );

  return { steps, error, findings, phase, start, reset };
}
