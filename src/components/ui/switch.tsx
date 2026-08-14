'use client';

/* The one switch definition. A setting that is on or off, stated as a switch on the right of its
 * own row.
 *
 * WHY IT REPLACED A CHECKBOX (Luke, 2026-07-31). The visibility settings were a 16px tick box on the
 * LEFT of the row. Two things were wrong with that. A checkbox is a form control - it means "this
 * will be true when you submit" - and these read as settings you are operating, which is a switch.
 * And a tick on the left puts the CONTROL where the eye starts, so the row is read control-first,
 * label-second; a switch on the right lets the row be read as a sentence and answered at the end
 * of it.
 *
 * COLOUR IS THE ACCENT, and that settled a question rather than dodging one: Run has one accent, and
 * every "on" state in the product already means the same thing (you chose this). A second hue would
 * be a distinction with no difference behind it. The one case that will genuinely force a secondary
 * is Live - a red-zone-armed row that is ALSO selected - and it should be decided there against the
 * real pair, not invented here (github #64).
 *
 * `--switch-off` rather than a border or a muted mix: see the token's note in globals.css.
 *
 * 36x20 with a 16px thumb, a step up from the 32x16 measured on the reference. Every screen that
 * renders one of these is a modal a trader fills in on a phone, and the whole ROW is the target
 * anyway (min-h-11 below sm), but the switch itself still has to look pressable at arm's length.
 */

import { cn } from '@/lib/cn';
import { slotSurface } from './card';

export function Switch({
  on,
  onToggle,
  title,
  note,
  disabled,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  title: string;
  /** The one sentence that says what happens. Optional - some settings name themselves. */
  note?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    /* ONE BUTTON, NOT A ROW CONTAINING A BUTTON. The whole row is the control, so the note is part
       of the target rather than text beside it - which matters most on a phone, where the note is
       the widest thing on the row and therefore the easiest thing to hit.
       `aria-pressed` rather than role="switch": this IS a toggle button, and aria-pressed is the
       better-supported spelling of the same state. */
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      /* DISABLED IS AN INK SWAP, NOT AN OPACITY DROP. `disabled:opacity-50` took the whole row with
         it, and the note underneath is already `muted` — half of 4.21:1 composites to roughly 1.9:1
         against the page, which is not text any more. Button `secondary` had already arrived at the
         considered answer (a real colour change at opacity 1) and this follows it: the control keeps
         its edges crisp and every string stays legible. */
      aria-pressed={on}
      className={cn(
        cn(slotSurface, 'flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:[&_*]:text-muted max-sm:min-h-11'),
        className
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-body-lg text-text block">{title}</span>
        {note && <span className="text-body text-muted mt-0.5 block">{note}</span>}
      </span>
      <Track on={on} />
    </button>
  );
}

/* The switch on its own, for the rare row that is not a title/note pair. Exported so a caller never
 * hand-rolls a second track. */
export function Track({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative block h-5 w-9 shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--color-accent)' : 'var(--switch-off)' }}
    >
      {/* Positioned by `left` rather than translate so the travel is stated in the same units as
          the inset that defines the resting position - 2px in, 18px across, no arithmetic to keep
          in sync with the track width. `surface`, not white: the thumb has to read as the card's
          own material in both modes, and #fff on a dark card is a light bulb. */}
      <span
        className="absolute top-0.5 block size-4 rounded-full transition-[left] duration-200"
        style={{ left: on ? 18 : 2, background: 'var(--color-surface)' }}
      />
    </span>
  );
}
