'use client';

/* The intake progress panel: two marks with a connector, above a list of steps that tick off and
 * scroll. Ported from `run-trading@v2` (2026-08-15, S4e).
 *
 * EVERY STEP IS REAL. They arrive from the server's NDJSON stream as each file actually lands,
 * carrying counts the database actually accepted (`lib/intake/stream.ts`). Nothing advances on a
 * timer, which is the entire reason the import route streams rather than returning once.
 *
 * THE TRACK MOVES (Luke, 2026-07-22, restored after a cut and a correction): completed steps drift
 * up and fade, the live step holds the centre, pending work waits below. A progress bar says
 * "wait"; this says what is being done.
 *
 * THE SLIDE IS 260ms, NOT 500 (Luke, 2026-08-03: "the rotating messages in the modal fly by super
 * fast. i want it to feel smoother"). It was 500ms while the step cadence was ALSO 500ms, so a new
 * slide started the exact frame the last one finished and the list was never once still — which
 * reads as smearing past rather than stepping, no matter how much total time you add. Shortening
 * the motion is what buys the stillness; the beat that pairs with it is in `use-import-run.ts`.
 *
 * ROW COUNTS ARE NOT SHOWN (Luke, 2026-07-22, same day, next round): five labels each with a number
 * under them read as a busy list. The label plus the tick is enough — the trader does not need a
 * running tally, just to see each real step land. The counts are still computed server-side and
 * still carried on `Step.detail`; only the render was cut, and ONLY for success. A step's `detail`
 * on FAILURE is the diagnosis, not a tally, and stays: the trader needs to know which step broke
 * and why, not just that something did.
 *
 * Checks are the PINE accent, never green — green is reserved for money.
 *
 * The title lives in the modal header, not here.
 */

import { Icon } from '@/components/ui/icon';

export type StepState = 'pending' | 'active' | 'done' | 'failed';

export interface Step {
  id: string;
  label: string;
  /** Real once known: a row count on success (computed, no longer rendered — see the header), or
   *  the failure diagnosis on failure (rendered). Never a placeholder. */
  detail?: string;
  state: StepState;
}

/* Row geometry. Exported from here rather than eyeballed at the mask: the list shows the live row
   plus one either side, and a half row of bleed so the outgoing step is visibly leaving rather than
   vanishing at a hard edge. */
const ROW_H = 56;
const VISIBLE_ROWS = 3;

export function ProgressPanel({
  from,
  to,
  steps,
}: {
  from: React.ReactNode;
  to: React.ReactNode;
  steps: Step[];
}) {
  /* The list scrolls so the LIVE step sits in the middle slot. Once everything is done (or failed)
     there is no live step, so it settles on the last row rather than snapping back to the top — a
     finished list should hold still, not restart its own animation. */
  const liveIndex = steps.findIndex((s) => s.state === 'active' || s.state === 'failed');
  const index = liveIndex === -1 ? Math.max(0, steps.length - 1) : liveIndex;
  const offset = (VISIBLE_ROWS - 1) / 2;

  return (
    <div className="px-6 pt-7 pb-4">
      <div className="mb-7 flex items-center justify-center gap-4">
        <Mark>{from}</Mark>
        <Connector />
        <Mark>{to}</Mark>
      </div>

      {/* The mask fades rows INTO the edges instead of clipping them. Same gradient both ends, so a
          row leaving the top and one arriving at the bottom read as one continuous motion. Gentle
          ramp: neighbouring rows stay READABLE and merely recede — an aggressive ramp would wash out
          the tick on the row that just earned it, the one moment in the whole wait worth seeing. */}
      <div
        className="relative overflow-hidden"
        style={{
          height: ROW_H * VISIBLE_ROWS,
          maskImage: 'linear-gradient(to bottom, transparent 2%, #000 34%, #000 66%, transparent 98%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 2%, #000 34%, #000 66%, transparent 98%)',
        }}
      >
        {/* `aria-live="polite"`, not assertive: read after whatever the trader is already on, never
            interrupting. The panel holds the screen with every exit locked, and was previously
            silent to a screen reader.

            THE HORIZONTAL CENTRING LIVES ENTIRELY IN THE INLINE TRANSFORM, not split across a
            Tailwind `-translate-x-1/2` too. Tailwind v4's translate utilities set the standalone CSS
            `translate` property, which COMPOSES with (does not replace) `transform` — both applied a
            -50% shift, stacking to a full -100% (the row's whole width) instead of the intended
            -50%, and the list sat visibly left of centre. Caught by measuring: the list's centre
            landed 94px left of its wrapper's, exactly half the row width. */}
        <ul
          aria-live="polite"
          aria-busy={steps.some((s) => s.state === 'active')}
          className="steps-track absolute top-0 left-1/2 w-max max-w-full transition-[transform] duration-[260ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
          style={{ transform: `translate(-50%, ${(offset - index) * ROW_H}px)` }}
        >
          {steps.map((step) => (
            <Row key={step.id} step={step} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* The connector. Static, and a hairline rather than a dot field: the system's vocabulary is flat
 * and hairline, and `--color-border` is defined as the warm hairline. A field of travelling dots is
 * the generic SaaS syncing trope, and Run is specified as an instrument, not an app. Static because
 * an animation whose only content is "wait" is noise inside a panel whose premise is that the
 * trader is never merely told to wait — the list is already reporting real numbers as they land. */
function Connector() {
  return <span aria-hidden className="bg-border h-px w-12 shrink-0" />;
}

/** A mark slot. Fixed box so a logomark and a broker image cannot shift the row's centreline
 *  relative to each other. */
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface-2 border-border flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border">
      {children}
    </span>
  );
}

function Row({ step }: { step: Step }) {
  const live = step.state === 'active';
  const done = step.state === 'done';
  const failed = step.state === 'failed';

  return (
    <li className="flex items-center gap-3 px-2" style={{ height: ROW_H }}>
      <Bullet state={step.state} />
      <span className="min-w-0">
        <span
          /* `text-muted` for pending, NOT `text-faint`. v2 used a third ink tier and this build
             deleted `--color-faint` on 2026-08-14: a census found four call sites, every one of
             them `muted`'s job, and a token whose value equals another's is a second name for one
             thing. Hierarchy below body is carried by size and weight here. Ported blind, caught by
             the token lint rule — a class with no token behind it emits NOTHING, so this row would
             have rendered unstyled with no error and no type complaint. */
          className={`text-body-lg block truncate ${
            live || failed ? 'text-text font-medium' : done ? 'text-text' : 'text-muted'
          }`}
        >
          {step.label}
        </span>
        {step.detail && failed && <span className="text-small text-neg block truncate">{step.detail}</span>}
      </span>
    </li>
  );
}

function Bullet({ state }: { state: StepState }) {
  /* Failure is distinguished by SHAPE, not only colour. A tinted disc with a dot inside it is the
     active bullet recoloured, and terracotta against pine is precisely the confusable pair. A cross
     mirrors the tick exactly, so the two terminal states read as opposites at a glance. */
  if (state === 'failed') {
    return (
      <span className="bg-neg text-bg flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
        <Icon name="close" size={14} />
      </span>
    );
  }

  if (state === 'done') {
    /* The tick draws itself in rather than appearing: it is the one moment of reward in the wait.
       No accompanying scale bounce — that said nothing the draw did not, and `.select-pop`'s gesture
       belongs to confirming the TRADER's choice, not the system's work. */
    return (
      <span className="bg-accent text-accent-fg flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
        <Icon name="check" size={14} className="check-draw" />
      </span>
    );
  }

  /* Active and pending share a ring, so the row never shifts when a step starts; only the fill and
     the pulse change. The pulse is the one place movement belongs: attached to the specific thing
     that is live. */
  return (
    <span
      className={`border-border flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        state === 'active' ? 'soft-pulse' : ''
      }`}
    >
      {state === 'active' && <span className="bg-accent h-2 w-2 rounded-full" />}
    </span>
  );
}
