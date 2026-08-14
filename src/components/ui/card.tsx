import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/* The one card surface: radius + surface fill + the neutral lift. Before this existed the same
 * classes were retyped in six files and had already drifted (login p-6 vs the siblings' p-5).
 * Padding stays the caller's - a modal panel takes none, a content card takes p-6 - but the CHROME
 * lives here, so a new screen cannot invent its own.
 *
 * NO OUTER HAIRLINE SINCE 2026-07-31, and it is the change that finally answered what Luke kept
 * pointing at. He read the reference's cards as separating further from the page and first guessed a
 * lighter fill; measured, the fill was 1.071 against their 1.089. The fill was raised to match, and
 * it still was not the whole story - THEIR CARD HAS NO BORDER AT ALL, just `0 2px 4px` at 10%.
 * A drawn edge and a cast shadow are two different claims about the same object: the border says
 * "here is a box on the page", the shadow says "here is a sheet above it", and running both makes
 * the card read as the first while paying for the second. So the outer edge is now the ground
 * change plus the shadow, full stop.
 * The hairline is NOT gone from the product. It survives inside these objects - dividing rows,
 * underlining a card header, separating a modal footer from its scroll - which is where "flat +
 * hairline" was always doing the work. What it stopped doing is outlining the object itself.
 * brand.md and visual-rams.md carry the amendment. */
export const cardSurface = 'bg-surface rounded-[var(--radius)] shadow-[var(--shadow-card)]';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // The hover lift used by clickable cards. Pair it with a real <button>, not a div with onClick.
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    /* GROUND CHANGE, NOT A LIFT. This was `hover:shadow-md`, and `--shadow-md` does not exist in
       this system - so the class emitted Tailwind's STOCK shadow: pure black, both layers,
       identical in both modes, where every other shadow here is a per-mode literal in warm ink.
       Measured in dark, pointing at the card DROPPED its shadow alpha 0.32 -> 0.10, and
       globals.css already states that a 10% ink shadow on a near-value dark surface does not
       register at all. Hovering made the card sink.
       The elevation ramp has no rung above `--shadow-card` (sm -> card -> press), so an
       interactive card had nothing to lift to and the reach landed outside the system. A ground
       change is the house answer a clickable region already uses (`slotSurface`), and it needs no
       new token. If a lift is ever genuinely wanted it needs a real `--shadow-raised` with a dark
       literal, added to the system FIRST. */
    <div className={cn(cardSurface, interactive && 'hover:bg-hover transition', className)} {...props} />
  );
}

/* NOT adopted here, deliberately:
   - `ledger.tsx` rows and `import-method-modal.tsx`'s method tiles carry active/disabled states that
     replace the border and fill with an inline wash. Routing them through Card means immediately
     overriding two of its four classes, which is abstraction for its own sake. They are covered by
     the deliberate spacing/state pass in GitHub issue #18.
   - `index.tsx`'s preview frame (border-2 ink + mask fade, no shadow), `file-upload-step.tsx`'s
     dashed dropzone, and the login media slot (surface-2, no shadow) are NOT this surface. They
     share a radius, nothing else. Forcing them in would be the wrong kind of consistency. */

/* A SELECTABLE SLOT INSIDE A RAISED OBJECT - a choice in a modal, a settings row, a firm in a list.
 *
 * Its own definition rather than `cardSurface` in miniature, and the difference is a real one about
 * elevation: a card is a sheet ABOVE the page, and a slot is a recess IN that sheet. Every one of
 * these used to carry a border, a surface fill and `--shadow-card`, which put a raised card on top
 * of a raised card and read - Luke's word - "too bright" in dark.
 *
 * Measured on the reference: their equivalent row is a FILL AND NOTHING ELSE. Their
 * background.secondary (our `hover` token), border 0, no shadow, radius 12, hovering one step up
 * the ramp to their background.tertiary (our `surface-2`).
 *
 * Padding stays the caller's, exactly as it does for `cardSurface` - a firm row is px-4 py-2 and a
 * settings row is p-4, and that is content, not chrome. */
export const slotSurface =
  'bg-hover hover:bg-surface-2 rounded-[var(--radius)] transition-colors';
