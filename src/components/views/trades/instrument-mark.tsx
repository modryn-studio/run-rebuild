/* THE PRODUCT'S MARK. A hue per root, so a scan down the tape can tell one instrument from another
 * without reading - and a micro never shares a hue with its full-size sibling, which is the one
 * assignment here that is about risk rather than looks.
 *
 * LIFTED OUT OF `trades-tape.tsx` (2026-08-20) because the drawer needs the same mark at a
 * different size. It was private to the tape, and the drawer's 64px header mark would have been a
 * second copy of the hue lookup and the tint arithmetic - which is exactly how two surfaces end up
 * disagreeing about what colour an instrument is.
 *
 * SIZE IS A PROP, THE HUE AND THE TINT ARE NOT. A context legitimately changes how big a mark is;
 * nothing may change which hue a root gets, or the wash it sits on.
 */

import { cn } from '@/lib/cn';
import { markHue, productRoot } from '@/lib/instruments';

export function InstrumentMark({ symbol, className }: { symbol: string; className?: string }) {
  const root = productRoot(symbol);
  const hue = markHue(root);
  return (
    <span
      aria-hidden
      /* MIXED WITH `surface`, NOT `transparent`. The tint is a wash of the hue over the ground it
         sits on, and mixing into transparency makes it translucent instead - which lets the row's
         hover ground show through and changes the mark's colour when the pointer arrives. */
      className={cn(
        'text-caption grid size-7 shrink-0 place-items-center rounded-full font-medium tabular-nums tracking-[-0.01em]',
        className
      )}
      style={{
        color: `var(--mark-${hue})`,
        background: `color-mix(in srgb, var(--mark-${hue}) var(--mark-tint), var(--color-surface))`,
      }}
    >
      {root.slice(0, 3)}
    </span>
  );
}
