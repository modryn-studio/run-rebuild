import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      /* THE SAME DECLARATION AS `Input`, minus the height and plus `resize-none`, and it is
       * deliberately a copy of that string rather than a variation on it. A text field and a
       * text area are the same object at two heights; a trader who has seen one has learned the
       * other, and two fields that disagree about their border or their focus state read as two
       * different systems on one form.
       *
       * IT HAD DRIFTED THREE WAYS, all invisible until they sat side by side in the rack:
       *   bg-transparent           against Input's `bg-surface`, so it vanished on a card
       *   placeholder:text-muted   against Input's `text-faint` (that token was retired 2026-08-14;
       *                            both are `muted` now, which is what `faint` always resolved to)
       *   focus ring + no border   against Input's border-only focus
       *
       * And `text-sm`, which is TAILWIND'S DEFAULT SCALE, not a token in this system. The lint
       * rule cannot catch that one — `text-sm` is valid Tailwind, so it passes `no-custom-classname`
       * while still being a size nothing in the type ramp declares. The rack caught it instead,
       * which is the argument for the rack.
       *
       * THE EDGE PAIR IS `border` -> `focus:accent`, and it moves in lockstep with `Input` for the
       * reason stated above: these two are one object at two heights. It went to `field` at rest for
       * half a day on a 1.4.11 reading and came back; the argument, and what the revert trades, is
       * recorded in that file rather than duplicated here. No hover, same as Input and same as v2.
       */
      className={cn(
        'border-border bg-surface text-text placeholder:text-muted focus:border-accent aria-invalid:border-neg min-h-24 w-full resize-none rounded-[var(--radius-sm)] border px-4 py-3 text-body-lg transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
