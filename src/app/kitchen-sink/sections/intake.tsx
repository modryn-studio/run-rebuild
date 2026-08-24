'use client';

/* THE INTAKE FLOW'S FOUR SURFACES. Re-homed from the original rack (2026-08-20) with the fixtures,
 * the harnesses and their reasoning intact rather than rewritten.
 *
 * NO FIXTURE HERE COULD BE MISTAKEN FOR REAL DATA, which is the rack's standing rule. These render
 * day counts and file names, and a plausible one screenshotted would read as a real import.
 */

import { cn } from '@/lib/cn';
import { cardSurface } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Wordmark } from '@/components/ui/wordmark';
import { ProgressPanel, type Step } from '@/components/views/accounts/progress-panel';
import { FindingNotice } from '@/components/views/accounts/finding-notice';
import type { PreflightFinding } from '@/lib/intake/preflight';
import { Note, Row, Section } from '../_components/section';


const LONG_FILENAME =
  'Position History (9) copy final FINAL v3 exported 2026-08-15 from the reports tab.csv';

const PANEL_RUNNING: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  { id: 'position_history', label: 'Saving your trades', state: 'active' },
  { id: 'cash_history', label: 'Saving your fees', state: 'pending' },
  { id: 'orders', label: 'Saving your orders', state: 'pending' },
];

const PANEL_FAILED: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  {
    id: 'position_history',
    label: 'Saving your trades',
    state: 'failed',
    detail: 'Needs your Fills export too',
  },
  { id: 'cash_history', label: 'Saving your fees', state: 'pending' },
];

const PANEL_DONE: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  { id: 'position_history', label: 'Saving your trades', state: 'done' },
  { id: 'cash_history', label: 'Saving your fees', state: 'done' },
];

/* Every code, with a detail object shaped exactly like the real one — the copy reads numbers out of
 * these, so a fixture missing a field would render a sentence the real finding never produces. */
const RACK_FINDINGS: PreflightFinding[] = [
  { code: 'nothing_to_import', blocking: true, detail: { total: 0 } },
  { code: 'fills_empty', blocking: true, detail: { total: 77, otherRange: 'Mar 3 to Mar 7' } },
  {
    code: 'accounts_differ',
    blocking: true,
    detail: { fillAccounts: ['DEMOACCT0000001', 'DEMOACCT0000002'], total: 2 },
  },
  { code: 'rows_unnamed', blocking: true, detail: { blocked: 33, total: 777 } },
  {
    code: 'round_trips_unmatched',
    blocking: true,
    detail: { blocked: 7, total: 77, fillRange: 'Mar 3 to Mar 7', otherRange: 'Mar 3 to Mar 9' },
  },
  {
    code: 'fees_unmatched',
    blocking: true,
    detail: { total: 333, fillRange: 'Mar 3 to Mar 7', otherRange: 'Apr 1 to Apr 7' },
  },
  { code: 'fees_empty', blocking: true, detail: { total: 777, fillRange: 'Mar 3 to Mar 7' } },
  {
    code: 'fees_partial',
    blocking: true,
    detail: { blocked: 300, total: 777, fillRange: 'Mar 3 to Mar 5', otherRange: 'Mar 6 to Mar 7' },
  },
  { code: 'fees_implausible', blocking: true, detail: { perContractCents: 7_700, total: 333 } },
  {
    code: 'pnl_unreconciled',
    blocking: false,
    detail: { brokerCents: -70_000, ourCents: -69_700, diffCents: -300, comparedRoundTrips: 77 },
  },
  {
    code: 'statement_unreconciled',
    blocking: true,
    detail: {
      daysCompared: 7,
      absDiffCents: 60_000,
      days: [
        {
          accountName: null,
          sessionDate: '2026-03-03',
          brokerCents: -30_000,
          ourCents: 0,
          ourGrossCents: 0,
          ourFeeCents: 0,
          diffCents: -30_000,
          roundTrips: 0,
        },
        {
          accountName: null,
          sessionDate: '2026-03-04',
          brokerCents: 0,
          ourCents: 30_000,
          ourGrossCents: 30_000,
          ourFeeCents: 0,
          diffCents: -30_000,
          roundTrips: 7,
        },
      ],
    },
  },
  {
    code: 'statement_uncovered',
    blocking: false,
    detail: { uncoveredDays: ['2026-03-01', '2026-03-02'], uncoveredCents: -70_000, total: 7 },
  },
  { code: 'statement_unreadable', blocking: true, detail: { blocked: 3, total: 7 } },
];



export function IntakeSection() {
  return (
    <Section
      id="intake"
      title="Intake"
      intro="Everything between a dropped file and a row landing. The live panel arrives from the server's NDJSON stream as each file lands; nothing here advances on a timer, and nothing here is on one either."
    >
      <Row label="Progress panel" note="every state the real panel can be in">
        <div className="flex flex-wrap gap-4">
          <RackPanel steps={PANEL_RUNNING} />
          <RackPanel steps={PANEL_FAILED} />
          <RackPanel steps={PANEL_DONE} />
        </div>
        <Note>
          Running, failed and done, side by side. The failed step carries its own detail line rather
          than a generic message, because &ldquo;something went wrong&rdquo; on a four-file import
          leaves the trader with nothing to act on.
        </Note>
      </Row>

      <Row label="The thirteen refusals" note="every PreflightCode, with its real detail object">
        <div className="flex max-w-2xl flex-col gap-3">
          {RACK_FINDINGS.map((f) => (
            <FindingNotice key={f.code} finding={f} />
          ))}
        </div>
        <Note>
          This is the ONLY surface these ever reach: there is no confirm panel in the flow, so a
          refusal has exactly one place to be read. Each detail object is shaped exactly like the
          real one, because the copy reads numbers out of them and a fixture missing a field would
          render a sentence the real finding never produces.
        </Note>
      </Row>

      <Row label="Required-file checklist" note="four required, the optional fifth deliberately absent">
        <div className="flex flex-col gap-3">
          <RackReqs met={[]} />
          <RackReqs met={['fills', 'position_history']} />
          <RackReqs met={['fills', 'position_history', 'cash_history', 'orders']} />
        </div>
        <Note>
          A checklist that lists optional things reads as a wall of things you are failing to
          provide, so the optional fifth file is not on it at all.
        </Note>
      </Row>

      <Row label="Staged file rows" note="what a dropped file looks like once its header is read">
        <div className="flex max-w-lg flex-col gap-2">
          <RackFileRow name="Fills.csv" type="Fills" />
          <RackFileRow name="Cash History.csv" type="Cash History" />
          <RackFileRow name={LONG_FILENAME} type="Position History" />
          <RackFileRow name="Screenshot 2026-08-15.png" type={null} />
        </div>
        <Note>
          The unrecognised row is the one worth looking at: it is named back to the trader rather
          than silently dropped. The long filename is the other: a real export carries whatever the
          trader saved it as, so the row has to truncate rather than push the type label off its
          own edge. Type is read from the file&apos;s HEADER, never its name.
        </Note>
      </Row>
    </Section>
  );
}

function RackPanel({ steps }: { steps: Step[] }) {
  return (
    <div className={cn(cardSurface, 'w-full max-w-md overflow-hidden')}>
      <ProgressPanel
        from={<Icon name="files" size={26} className="text-muted" />}
        to={<Wordmark className="text-[13px]" />}
        steps={steps}
      />
    </div>
  );
}

/* The checklist, rebuilt here rather than imported, and that is a deliberate exception to the
   rack's usual rule. `Req` is a private helper inside `file-upload-step.tsx` — exporting it purely
   so this page could render it would widen that module's surface for the benefit of a review page,
   which is the tail wagging the dog. Four rows of two icons is not a component worth sharing. */
function RackReqs({ met }: { met: string[] }) {
  const REQS = [
    ['fills', 'Fills'],
    ['position_history', 'Position History'],
    ['cash_history', 'Cash History'],
    ['orders', 'Orders'],
  ] as const;
  return (
    <div className="text-caption flex flex-wrap items-center gap-x-3 gap-y-1">
      {REQS.map(([key, label]) => {
        const has = met.includes(key);
        return (
          <span
            key={key}
            className="flex items-center gap-1"
            style={{ color: has ? 'var(--color-accent)' : 'var(--color-muted)' }}
          >
            <Icon name={has ? 'check' : 'unmet'} size={13} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** A staged file row. Same reasoning as `RackReqs`: it is markup, not a component. */
function RackFileRow({ name, type }: { name: string; type: string | null }) {
  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2">
      <Icon name="file" size={15} className="text-muted shrink-0" />
      <span className="text-body text-text min-w-0 flex-1 truncate">{name}</span>
      <span
        className="text-caption shrink-0"
        style={{ color: type ? 'var(--color-muted)' : 'var(--color-neg)' }}
      >
        {type ?? 'Not recognised'}
      </span>
      <span className="text-muted shrink-0">
        <Icon name="close" size={14} />
      </span>
    </div>
  );
}
