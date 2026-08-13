import { cn } from '@/lib/cn';

/* The wordmark. One component, so the four placements cannot drift the way the two connect-flow
 * headers already did once (see the note at views/accounts/shared.tsx).
 *
 * `Run.` — the name plus a full stop. Settled 2026-07-21 by Jobs (identity) and Rams (letterform)
 * after Luke proposed copying character.ai's `(character.ai)` mark. That was killed on four counts,
 * the decisive one being that PARENTHESES ARE LOSS NOTATION: `(1,250)` is a negative on every P&L
 * and payout statement this audience reads daily, so setting the brand in parens renders it in the
 * accounting convention for a loss, inside a product about not blowing accounts.
 *
 * The real problem it exposed was not the name. The wordmark was `Run` in Newsreader 32/400 sitting
 * 40px above the same face at 56/300 — the headline again, smaller, which is why nothing about it
 * read as decided. brand.md line ~106 had it flagged as "TBD, Rams required" the whole time.
 *
 * Why the period earns its place (it is punctuation here, not the 2010s heavy-caps-sans swagger):
 *   1. It resolves the verb/noun ambiguity structurally. `Run` alone can be read as an imperative;
 *      `Run.` is a completed statement and cannot be read as an instruction. That matters because
 *      the product explicitly never touches execution.
 *   2. It matches the voice, which brand.md defines as declarative, never command.
 *   3. The product is about the line you stop at. The mark ends.
 *
 * The period is INK, not the pine accent (Rams overruling Jobs on this): colouring it would
 * announce that a brand accent exists, and the accent's defined job is interactive moments. A
 * wordmark is not interactive, so a coloured stop breaks colour-is-information for nothing.
 *
 * 20px/500 is a deliberate per-size decision rather than a reused heading step. The masthead H1 is
 * light and large; the mark is small and set, so the two can no longer be mistaken for each other.
 * It is ONE size at every placement - a mark that resizes by context is not a mark. Only position
 * varies (left in the app header, centred in the bounded connect flow).
 */

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // Not `text-display` + `tracking-tight`: those are the heading steps this is deliberately
        // no longer borrowing. Explicit values because this is a single-use mark, not a scale step.
        'serif text-[20px] leading-none font-medium tracking-[-0.01em]',
        className
      )}
    >
      Run.
    </span>
  );
}
