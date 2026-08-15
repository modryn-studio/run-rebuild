'use client';

/* The file-upload step, inside the Add account modal. Ported from `run-trading@v2` (2026-08-15,
 * S4e).
 *
 * The trader drops their Tradovate exports in ANY order and each file's type is detected from its
 * header, so nothing has to be labelled.
 *
 * ONE DETECTOR, SHARED WITH THE SERVER. v2 had a second copy here matching header PREFIXES while the
 * server matched header SETS, and its own comment admitted the cost: the two could legitimately
 * disagree about an optional export, leaving a row in the progress list pulsing forever. This build
 * calls `detectTradovateFileType` — the same function the route trusts — which is possible only
 * because `lib/csv/shared.ts` touches no database.
 *
 * FOUR REQUIRED, NOT THREE. Fills, Position History, Cash History and Orders (`spec.md` §S1). Cash
 * History because it is the only file carrying Tradovate's four fee lines and a prop account passes
 * or fails on P&L NET of fees; Orders because without it a bracket's protective leg auto-cancelling
 * when its target fills is indistinguishable from the trader pulling their own stop, and a read
 * that cannot tell reports it as a decision.
 */

import { useRef, useState, type DragEvent, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { detectTradovateFileType, type TradovateFileType } from '@/lib/csv/shared';
import { ModalHeader, RunMark, ImportComplete, SourceMark, type Source } from './shared';
import { ModalBody, ModalFooter, ModalActions } from './modal-shell';
import { ProgressPanel } from './progress-panel';
import { FindingList } from './finding-notice';
import { useImportRun, type ImportOutcome } from './use-import-run';

export type Picked = { file: File; type: TradovateFileType | undefined };

/** Header detection, from the file's first 512 bytes. Tradovate headers carry no embedded commas,
 *  so the first line alone identifies the export. */
async function readType(file: File): Promise<TradovateFileType | undefined> {
  const header = (await file.slice(0, 512).text()).split(/\r?\n/, 1)[0] ?? '';
  return detectTradovateFileType(header.split(',').map((h) => h.trim()));
}

const REQUIRED: { type: TradovateFileType; label: string }[] = [
  { type: 'fills', label: 'Fills' },
  { type: 'position_history', label: 'Position History' },
  { type: 'cash_history', label: 'Cash History' },
  { type: 'orders', label: 'Orders' },
];

/** What each detected type is called on a staged row. The optional fifth is here too, because a
 *  file the trader dropped should always be named back to them. */
const TYPE_LABELS: Record<string, string> = {
  fills: 'Fills',
  position_history: 'Position History',
  cash_history: 'Cash History',
  orders: 'Orders',
  account_balance: 'Account Balance',
  performance: 'Performance',
};

/** `files` is lifted to the parent modal so stepping back to the doors and returning does not wipe
 *  a staged selection. Closing the whole modal still discards it, which is the intended discard. */
export function FileUploadStep({
  source,
  onBack,
  onClose,
  onDone,
  onBusyChange,
  files,
  setFiles,
}: {
  source: Source;
  onBack: () => void;
  onClose: () => void;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
  files: Picked[];
  setFiles: Dispatch<SetStateAction<Picked[]>>;
}) {
  const [dragging, setDragging] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const run = useImportRun();
  /* Set once the whole run resolves, and this is what gates the handoff rather than the phase.
     A trader might tab away while an import runs; auto-advancing on a timer means if they are not
     looking at that exact instant they miss the one moment that proves the upload landed. Holding
     here means the confirmation is still waiting, however long they were gone. */
  const [readyOutcome, setReadyOutcome] = useState<ImportOutcome | null>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const all = [...list];
    const csvs = all.filter((f) => f.name.toLowerCase().endsWith('.csv'));
    // Non-CSV files used to be discarded in silence. Say so instead of doing nothing.
    setNotice(all.length > csvs.length ? 'Only CSV files are supported.' : null);
    const picked = await Promise.all(csvs.map(async (file) => ({ file, type: await readType(file) })));
    /* Dedupe on name + size: the exact same file re-dropped is ignored, but same-type files from
       different days (`Fills (1).csv`, `Fills (2).csv`) are distinct names and both kept. */
    setFiles((prev) => {
      const seen = new Set(prev.map((p) => p.file.name + p.file.size));
      return [...prev, ...picked.filter((p) => !seen.has(p.file.name + p.file.size))];
    });
  };

  const remove = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const staged = new Set(files.map((f) => f.type).filter(Boolean));
  const ready = REQUIRED.every((r) => staged.has(r.type));
  // `settling` still counts as busy: the handoff is imminent and an exit would drop a real outcome.
  const busy = run.phase === 'running' || run.phase === 'settling';

  async function submit() {
    /* A guard, not decoration: both Continue and the failure path's Try again call this, and a
       double-click lands two before React re-renders the button away. The writes would dedupe, but
       the two step-streams would interleave into one list and report nonsense. */
    if (busy) return;
    onBusyChange(true);
    const outcome = await run.start(
      files.map((f) => f.file),
      files.map((f) => f.type).filter((t): t is TradovateFileType => !!t)
    );
    if (outcome) {
      /* Stay busy THROUGH the completion screen. It released here unconditionally in v2, so a
         backdrop click during the completion screen unmounted the modal and threw away an outcome
         that lived only in this component's state. The only way out is the Done button below. */
      setReadyOutcome(outcome);
    } else {
      // Failure: nothing computed is at risk, so exits unblock and the retry controls take over.
      onBusyChange(false);
    }
  }

  /* While the import runs, and while it holds after finishing or failing, the modal body IS the
     panel. Not the file list with a spinner over it: the trader's job is done, and re-showing the
     picker invites fiddling with an upload already in flight. */
  if (run.phase !== 'idle') {
    if (readyOutcome) {
      return (
        <ImportComplete
          imported={readyOutcome.imported}
          onDone={() => {
            onBusyChange(false);
            onDone();
          }}
        />
      );
    }

    return (
      <>
        {/* No back arrow and no X while work is in flight. This screen has one exit and it goes
            forward. On failure the controls below take over. */}
        <ModalHeader title="Building your record" />
        <ProgressPanel
          from={<Icon name="files" size={26} className="text-muted" />}
          to={<RunMark size={26} />}
          steps={run.steps}
        />

        {run.phase === 'failed' && (
          <div className="mt-2 px-6 pb-2">
            {/* SAYS WHAT SURVIVED BEFORE WHAT TO DO NEXT. A partial import reads as total loss
                otherwise, and the trader needs to know a retry cannot double-count. */}
            {run.steps.some((st) => st.state === 'done' && st.id !== 'read') && (
              <p className="text-small text-muted mb-3">
                Everything ticked above is saved. Trying again will not duplicate it.
              </p>
            )}
            {/* THE THIRTEEN CODES REACH THE TRADER HERE, and this is the only place they do. With
                no confirm panel in the flow, a refusal has exactly one surface. */}
            {run.findings.length > 0 ? (
              <FindingList findings={run.findings} />
            ) : (
              run.error && <p className="text-small text-neg">{run.error}</p>
            )}
            <div className="mt-4">
              <ModalActions>
                <Button variant="secondary" size="sm" onClick={run.reset}>
                  Back to files
                </Button>
                <Button size="sm" onClick={submit}>
                  Try again
                </Button>
              </ModalActions>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <ModalHeader title="Upload your exports" onBack={onBack} onClose={onClose} />

      <ModalBody>
        {/* WHICH BROKER, STATED AS A FACT. A trader arriving with a TradeStation or Rithmic export
            has to learn that before they upload, not after: the parser detects the format and
            refuses what it cannot read, and a clear refusal is still a worse experience than never
            having tried. When a second rail lands, this line gains a broker step rather than a
            longer sentence. */}
        <div className="px-6 pt-5 pb-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <SourceMark source={source} size="h-6" />
          </div>
          <p className="text-body text-muted mt-2">
            From the Reports tab.{' '}
            <button onClick={() => setHowOpen((o) => !o)} className="text-link">
              How to export
            </button>
          </p>
          {howOpen && (
            <ol className="text-small text-muted mx-auto mt-3 max-w-sm list-decimal space-y-1 pl-5 text-left">
              <li>In Tradovate, open the account and click the settings gear.</li>
              <li>Download Fills, Position History, Cash History and Orders.</li>
              <li>Account Balance History is optional, and checks your net against the broker.</li>
            </ol>
          )}
        </div>

        <div className="px-6 pt-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload CSV files"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed p-8 text-center transition"
            style={
              dragging
                ? {
                    borderColor: 'var(--color-accent)',
                    background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)',
                  }
                : { borderColor: 'var(--color-border)' }
            }
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}
            >
              <Icon name="upload" size={16} />
            </span>
            <p className="text-body text-muted">Drop CSV files here, or browse</p>
          </div>

          {notice && <p className="text-caption text-neg mt-2 text-center">{notice}</p>}

          {files.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {files.map((f, i) => {
                const bad = !f.type;
                return (
                  <li
                    key={f.file.name + i}
                    className="border-border bg-surface flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2"
                  >
                    <Icon name="file" size={15} className="text-muted shrink-0" />
                    <span className="text-body text-text min-w-0 flex-1 truncate">{f.file.name}</span>
                    <span
                      className="text-caption shrink-0"
                      style={{ color: bad ? 'var(--color-neg)' : 'var(--color-muted)' }}
                    >
                      {f.type ? (TYPE_LABELS[f.type] ?? f.type) : 'Not recognised'}
                    </span>
                    <button
                      onClick={() => remove(i)}
                      aria-label={`Remove ${f.file.name}`}
                      className="text-muted hover:text-text shrink-0 transition"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* REQUIRED ONLY. Account Balance History is genuinely optional, so it is offered in the
              copy and accepted by the parser, but it never appears here as an unmet obligation: a
              checklist that lists optional things reads as a wall of things you are failing to
              provide. */}
          <div className="text-caption mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {REQUIRED.map((r) => (
              <Req key={r.type} label={r.label} met={staged.has(r.type)} />
            ))}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        {/* A failed import leaves the trader here with their files still staged, so fixing one
            export and retrying costs nothing. Anything that already landed is skipped on the second
            pass by the dedupe key, so a retry cannot double-count. */}
        <Button disabled={!ready} size="lg" className="w-full" onClick={submit}>
          Continue
        </Button>
      </ModalFooter>
    </>
  );
}

/** A required-file indicator: a check when present, a hollow dot when still missing. */
function Req({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className="flex items-center gap-1"
      style={{ color: met ? 'var(--color-accent)' : 'var(--color-muted)' }}
    >
      <Icon name={met ? 'check' : 'unmet'} size={13} />
      {label}
    </span>
  );
}
