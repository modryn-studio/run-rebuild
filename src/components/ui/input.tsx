import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/* The one text-input definition. Repaired 2026-07-21: it previously shipped with no radius (square
 * corners in an app where every surface is --radius/--radius-sm) and a hand-picked `text-sm` instead
 * of a scale role. Height matches Button size="lg" (48px) so a stacked input + CTA agree.
 *
 * `h-12`, NOT `min-h-12`. The pairing above is stated as a guarantee and was not one: content plus
 * padding plus border computes to 49.33px, so the minimum never bound and the input sat 1.3px
 * taller than the button it claims to match. A stated height binds; a minimum only hopes.
 *
 * ONE ACTIVE STATE FOR EVERY FIELD IN THE APP (Luke, 2026-07-31 - he caught the Edit modal's Name
 * field lighting differently from the firm search box two screens earlier).
 *
 * THE BORDER IS THE WHOLE INDICATOR. `focus:outline-none` suppresses the global `:focus-visible`
 * outline for text fields ONLY, and that is a deliberate exception rather than a slip: the global
 * rule draws a 2px accent ring at 2px offset, so a field that ALSO lights its border was wearing two
 * rings, one inside the other, which is exactly what Luke pointed at ("i dont like it when a border
 * is added to the box when clicked on. just make the border pine like you did with the 'search or
 * type your firm' box").
 *
 * It is still an accessible focus indicator - the border goes to pine #1f6b57, a colour change well
 * past the 3:1 that WCAG 2.4.11 asks of a focus indicator against its adjacent colours, and it
 * surrounds the whole control. What it is not is a SECOND indicator on top of the first.
 * The exception is scoped to text inputs; every button, link and card keeps the global outline,
 * because none of them have a border that changes.
 *
 * THE REST EDGE IS THE QUIET ONE, AND THE GESTURE IS THE POINT (Luke, 2026-08-14: "the border
 * should be subtle and more pronounced on click, active state"). Rest is `border` at 1.30:1 and
 * focus is pine at 6.37:1 - a 4.9x jump, which is what makes clicking into a field feel like
 * something happened. A pass earlier that day moved rest to `field` (3.83:1) for SC 1.4.11, and the
 * cost was exactly this: from an already-firm edge, lighting it pine is a colour change rather than
 * an arrival. Reverted to the pair v2 ships.
 *
 * WHAT THAT TRADES, STATED PLAINLY BECAUSE IT IS A REAL TRADE. 1.4.11 asks 3:1 of the information
 * required to identify a control, and for an empty text field the outline is a serious candidate for
 * being that information. Two things carry it instead here: every field in this product is placed
 * with a visible placeholder or label, which is content saying "type here" that a code box does not
 * have; and the focus state is unambiguous. `CodeInput` keeps `--color-field` for the opposite
 * reason - six empty boxes with nothing inside them, which is the case Luke reported in the first
 * place ("the outline of the code boxes on the login screen are hard to see").
 * So the split is not by component type, it is by whether anything INSIDE the control identifies it.
 *
 * NO HOVER. v2 has none on a field and neither does this. A hover is unreachable by keyboard and by
 * touch, so it can only ever be a second cue for a mouse; the two states worth having are resting
 * and active. `hover:border-muted` was added here for twenty minutes on a misreading of the note
 * above and removed the moment it was read back correctly.
 *
 * `:focus`, not `:focus-visible` - a text field is active when it has the caret, however you got
 * there. That is the opposite call from a button, where a mouse press should not leave a ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'border-border bg-surface text-text placeholder:text-faint focus:border-accent aria-invalid:border-neg h-12 w-full rounded-[var(--radius-sm)] border px-4 py-3 text-body-lg transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
