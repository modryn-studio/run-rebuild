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
 * It is still an accessible focus indicator - the border goes from #e4dfd3 to pine #1f6b57, a colour
 * change well past the 3:1 that WCAG 2.4.11 asks of a focus indicator against its adjacent colours,
 * and it surrounds the whole control. What it is not is a SECOND indicator on top of the first.
 * The exception is scoped to text inputs; every button, link and card keeps the global outline,
 * because none of them have a border that changes.
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
