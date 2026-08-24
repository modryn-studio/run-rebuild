'use client';

/* THE DRAWER'S OWN PIECES: a section eyebrow, a fact row, and the copy control on the broker ids.
 * Ported from `run-trading@v2`'s `trade-drawer.tsx` (2026-08-20), geometry and reasoning intact.
 *
 * SPLIT OUT OF THE DRAWER rather than left at the bottom of it, because the drawer file is already
 * the longest surface in this folder and these three are the part most likely to be reused when a
 * second detail panel lands (an account, a product).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';

/* 12/600 uppercase, measured off the reference. The same eyebrow role every other grouped list in
 * the product uses, so the surfaces label a group the same way.
 *
 * A RULE BETWEEN GROUPS, NOT BETWEEN ROWS - the call the summary rail and the drawer both make. The
 * rows are ALREADY grouped, by a spaced uppercase label, so a hairline between each one is a second
 * answer to a question the label has already answered. */
export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="text-small text-muted font-semibold tracking-[0.1em] uppercase">{label}</p>
      {/* mt-3: measured 12px from the reference's section label to its first value, against our 8. */}
      <dl className="mt-3">{children}</dl>
    </div>
  );
}

export function Row({
  label,
  children,
  strong,
  copy,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
  /** Present on the broker ids, which are the only values here anyone retypes. */
  copy?: string;
}) {
  return (
    /* py-1.5 (6px), down from 2.5 (10px), because the rule between rows is gone and the space it
       occupied was doing two jobs: separating rows AND standing clear of a hairline. Without the
       line, 10px reads as a gap rather than as a list. The same figure the summary rail uses, so
       both label/value lists sit on one rhythm. */
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-body text-muted shrink-0">{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 items-center justify-end gap-2 text-right tabular-nums',
          strong ? 'text-body-lg text-text font-medium' : 'text-body text-text'
        )}
      >
        <span className="truncate">{children}</span>
        {copy && <CopyButton value={copy} />}
      </dd>
    </div>
  );
}

/* Copy, with the tick as its own confirmation. No toast: a toast for copying a twelve-digit id is a
 * notification about a keystroke. The glyph swapping for two seconds says it landed and then gets
 * out of the way. */
function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      aria-label={done ? 'Copied' : 'Copy'}
      onClick={() => {
        // Best effort: clipboard access can be refused (insecure origin, permissions), and there is
        // nothing useful to say about that on a control this small.
        void navigator.clipboard
          ?.writeText(value)
          .then(() => setDone(true))
          .catch(() => {});
      }}
      className={cn('shrink-0 transition-colors', done ? 'text-accent' : 'text-muted hover:text-text')}
    >
      <Icon name={done ? 'check' : 'copy'} size={14} />
    </button>
  );
}

/* TWO CIRCLES HANGING OFF THE DRAWER'S LEFT EDGE, previous and next. 48px, 16 apart, measured off
 * the reference.
 *
 * OVER THE LIST, NOT INSIDE THE PANEL, and that placement is the argument: they are controls for
 * the list BEHIND the drawer, so putting them over the list says so. Hidden below `sm`, where 96px
 * of furniture floating over a 390px screen would cover the thing it navigates.
 *
 * DISABLED RATHER THAN ABSENT, unlike most controls in this product. A stepper that disappears at
 * the end of the tape moves the other one, so the button under the pointer changes meaning mid-walk.
 * Holding position is worth more here than the usual "nothing there says there is nothing there". */
export function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      /* IT KEEPS ITS SHADOW, and that is not a violation of the no-drop-shadow rule: this floats
         over the PAGE with nothing behind it to bound against, which is the Card case rather than
         the button case. It is the one control in the product that is genuinely a sheet. */
      className="bg-surface border-border flex size-12 items-center justify-center rounded-full border shadow-[var(--shadow-card)] transition active:shadow-[var(--shadow-press)] disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
