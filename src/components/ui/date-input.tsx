'use client';

/* ONE DATE FIELD FOR THE WHOLE APP, and the only reason it is a component rather than an `<input
 * type="date">` at each call site is the EMPTY STATE.
 *
 * A native date input has no placeholder and will not take one — the spec gives it a value or a
 * localised edit mask, and `placeholder` is ignored outright. So an unset end of a window reads
 * `mm/dd/yyyy`, which is a format hint where the reference (and Luke, 2026-08-21) wants a word for
 * what the absence MEANS: "Earliest", "Latest". Those are not the same statement. `mm/dd/yyyy` says
 * "type a date here"; "Latest" says "this window has no end", which is the true reading of a
 * one-ended range and the thing a trader is actually choosing between.
 *
 * THE PICKER STAYS NATIVE, DELIBERATELY. What is custom here is the PRESENTATION of an empty field,
 * not the calendar: the input keeps `type="date"`, so iOS gets its wheel, Android gets its dialog,
 * the desktop gets Chrome's calendar, and every one of them arrives already localised, keyboard
 * operable and correct about leap years. A hand-drawn calendar would have to re-earn all of that,
 * and would then need its own rack entry, its own dark mode and its own focus management to be no
 * better at the one job being asked of it.
 *
 * HOW THE EMPTY STATE IS DRAWN: the input's own text goes transparent while the value is empty, so
 * the UA's edit mask stops painting, and a span underneath supplies the word. `::-webkit-calendar-
 * picker-indicator` is NOT text, so it keeps its own colour and the affordance survives — which is
 * why the overlay must not cover it (`inset-y-0 left-*`, never `inset-0`).
 *
 * The transparency is conditional on emptiness and nothing else. A field with a value paints its
 * value, in ink, exactly as the UA intended.
 */

import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md';

/* `sm` is the desktop popover's compact field (the app's 36px control height, `Button md`);
 * `md` matches `Input` — 48px and `text-body-lg`, which is also the iOS no-zoom floor and therefore
 * the only size a phone may use.
 *
 * Three parts rather than one string, because the overlay needs the TYPE and the PADDING but must
 * not take the height — a placeholder carrying `h-9` would stop centring the moment the box grew. */
const SIZES: Record<Size, { h: string; font: string; pad: string }> = {
  sm: { h: 'h-9', font: 'text-body', pad: 'px-3' },
  md: { h: 'h-12', font: 'text-body-lg', pad: 'px-4' },
};

export function DateInput({
  value,
  onChange,
  /** What the field says while it holds no date. The MEANING of the absence, never a format hint. */
  placeholder,
  min,
  max,
  size = 'md',
  className,
  ...rest
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  /** The other end of the window, so the two ends cannot cross. */
  min?: string | null;
  max?: string | null;
  size?: Size;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'placeholder' | 'min' | 'max' | 'size' | 'type'
>) {
  const ref = useRef<HTMLInputElement>(null);
  const { h, font, pad } = SIZES[size];
  /* FOCUS HAS TO BE STATE, because the placeholder and the UA's edit mask cannot both be visible.
     `color: transparent` hides the mask while the field is empty - that is the whole trick this
     component turns - but it does NOT hide the ACTIVE segment: Chrome paints that one with its own
     background and foreground, ignoring the transparent colour. So focusing an empty field drew
     `mm` on top of `Earliest` and the field read "mmiest" (2026-08-24, seen on /trades).
     A CSS `:focus-within` variant cannot fix it, because the thing that must change is whether the
     placeholder RENDERS, not how it looks. */
  const [focused, setFocused] = useState(false);
  const masked = !value && !focused;

  /* `className` REACHES THE INPUT, not the wrapper, because every override a call site has wanted
     so far is a property of the field itself — the desktop popover sits on `surface` and needs its
     field on `bg`, which is the opposite of the default and impossible to say from outside if this
     prop lands on a positioning box. `cn` is tailwind-merge, so the later class wins cleanly. */
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        min={min ?? undefined}
        max={max ?? undefined}
        onChange={(e) => onChange(e.target.value || null)}
        /* THE WHOLE FIELD OPENS THE PICKER, not just the 20px indicator at its right edge. On a
           phone that indicator is often not drawn at all, so without this the control's only way in
           is the edit mask — which this component has just made invisible.
           Guarded because `showPicker` is newer than the input itself and throws rather than no-ops
           when the browser will not honour it (no transient activation, already open). A throw here
           would take the click handler down with it. */
        onClick={() => {
          try {
            ref.current?.showPicker?.();
          } catch {
            // The native indicator is still there on the platforms that draw one.
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        /* `focus:outline-none` for the same reason `Input` carries it: the border going pine IS the
           focus indicator, and the global ring would draw a second one around the first. */
        className={cn(
          'border-border bg-surface text-text focus:border-accent w-full rounded-[var(--radius-sm)] border transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          h,
          font,
          pad,
          // The UA's edit mask paints in `color`, so hiding it is hiding the colour. Once focused
          // the mask has to come back: it is the format hint you type against, and its active
          // segment is drawn by the UA in spite of this anyway.
          masked && 'text-transparent',
          className
        )}
        {...rest}
      />

      {/* NOT `inset-0`: the calendar indicator lives at the right edge and this must not sit over
          it, or the one remaining click target for the native picker is swallowed. */}
      {masked && (
        <span
          aria-hidden
          className={cn(
            'text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center',
            font,
            pad
          )}
        >
          {placeholder}
        </span>
      )}
    </div>
  );
}
