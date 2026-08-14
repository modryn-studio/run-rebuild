'use client';

/* A button that opens a short list of choices, and closes when you pick one.
 *
 * NOT A <select>. The native control is right for a form field being submitted; this is a VIEW
 * control - it changes what a card is showing, and its resting state has to read as a peer of the
 * page's other header buttons rather than as an input. The geometry below is deliberately
 * HeaderControl's (h-9, hairline, --radius-sm, text-small/500): every control on /accounts belongs
 * to one family, and a card control that sat 4px taller than the band controls above it would read
 * as a different class of thing for no reason.
 *
 * WHY IT IS HAND-ROLLED at this size. It needs a trigger, a popover, outside-dismiss, Escape, and
 * roving arrow keys - that is the whole component, and all of it is below. A headless menu library
 * earns its place when there are submenus, typeahead, or a dozen call sites; here it would be a
 * dependency to render six words.
 *
 * KEYBOARD IS NOT OPTIONAL. Arrow keys move, Enter/Space picks, Escape closes and returns focus to
 * the trigger, Tab closes. A control that can only be operated by mouse is not finished.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';

export type MenuOption<T extends string> = { value: T; label: string };

export function Menu<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly MenuOption<T>[];
  onChange: (value: T) => void;
  /** Names the control for screen readers; the visible text is always the current choice. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Which row the arrow keys are on. Opens on the current choice, so the first Down moves from
  // where you already are rather than from the top of a list you did not ask to re-read.
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    // pointerdown, not click: a click fires after the press completes, so a drag that starts inside
    // the menu and ends outside would dismiss on mouseup. Same reasoning as modal-shell's scrim.
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Focus follows the cursor so the browser's own focus ring is the highlight - no second
  // "active row" style to keep in sync with where focus actually is.
  useEffect(() => {
    if (open) items.current[cursor]?.focus();
  }, [open, cursor]);

  const openAt = () => {
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key === 'Tab') return setOpen(false);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setCursor((c) => (c + step + options.length) % options.length);
    }
  };

  return (
    <div ref={root} className={cn('relative shrink-0', className)} onKeyDown={onKeyDown}>
      {/* THE TRIGGER IS AS WIDE AS ITS LONGEST OPTION, NOT AS ITS CURRENT ONE (Luke, 2026-07-30 -
          he noticed a reference product does this and asked for the reasoning before the copy).
          Measured there: a 230px box around 95px of text, and a 160px box around 57px. Deliberate,
          and the reason is what a view control IS.

          Its label is not a name, it is the current VALUE, so it changes every time it is used -
          "Cumulative" to "Daily", "1 month" to "Year to date". A shrink-to-fit button therefore
          resizes on every pick, and because these sit in a row anchored right, resizing one SHIFTS
          THE OTHER: choose a shorter period and the chart-type control slides sideways under your
          cursor. Reserving the width means the controls never move, so the only thing that changes
          when you pick is the thing you picked.

          Sized by RENDERING every option and hiding all but the current one, rather than measuring
          text in JS. One grid cell holds them all stacked, so the intrinsic width is the longest
          label's - correct at any font, any zoom, any locale, with no effect and no reflow. The
          visible label is the one without `invisible`; `col-start-1 row-start-1` stacks them.

          `justify-between` then puts the chevron hard right against that reserved width, which is
          what makes a wide box read as a control rather than as a mis-sized button. */}
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Held pushed in for as long as the panel is up - the state `lift-press` already defines and
        // the Filters button already uses. Without it the trigger sprang back the instant the
        // pointer left and nothing on screen said which control the list belonged to.
        data-active={open ? 'true' : undefined}
        onClick={() => (open ? setOpen(false) : openAt())}
        className="lift-press lift-rest text-small text-text flex h-9 items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 font-medium"
      >
        <span className="grid">
          {options.map((o) => (
            <span
              key={o.value}
              aria-hidden={o.value !== value}
              className={cn(
                'col-start-1 row-start-1 text-left whitespace-nowrap',
                o.value !== value && 'invisible'
              )}
            >
              {o.label}
            </span>
          ))}
        </span>
        {/* Chevron is drawn pointing down, so the resting state needs no rotation; flipping it while
            open is the one bit of state the trigger shows about itself. */}
        <Icon
          name="chevron"
          size={14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        /* Right-anchored: these sit at the right edge of a card, so a left-anchored panel would hang
           off it. `min-w-full` keeps the panel at least as wide as its trigger - a menu narrower
           than the button that opened it reads as a different object. */
        <div
          role="listbox"
          aria-label={label}
          className="pop-in border-border bg-surface absolute top-full right-0 z-50 mt-1.5 min-w-full rounded-[var(--radius)] border p-1 shadow-[var(--shadow-card)]"
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={o.value === value}
              tabIndex={-1}
              onClick={() => pick(o.value)}
              className="text-body text-text hover:bg-hover flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 text-left whitespace-nowrap transition-colors"
            >
              {/* The check occupies its slot whether or not it is drawn, so picking a different row
                  does not shift every label sideways. */}
              <span className="text-accent flex w-4 shrink-0 justify-center">
                {o.value === value && <Icon name="check" size={13} />}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
