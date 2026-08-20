import { cn } from '@/lib/cn';

// A loading placeholder. Size it at the call site (`h-4 w-24`) so it matches the shape of the
// content it stands in for — a skeleton that doesn't match causes a visible reflow on load,
// which is worse than a spinner.
//
// aria-hidden and not announced: a screen reader should hear the loading state from the
// container's aria-busy, not from a stack of empty boxes.
export function Skeleton({ className }: { className?: string }) {
  /* `bg-surface-2`, NOT `bg-surface` (2026-08-20). Ported verbatim from the boilerplate, where
     `surface` is the MIDDLE tier and a skeleton on an `elevated` card reads at 11 steps of
     separation. Run aliases `elevated` to `surface`, so the same class made a skeleton the exact
     colour of the card it sits in - zero separation, and `animate-pulse` only fades opacity toward
     that same ground, so it was invisible rather than subtle. It looked fine in the rack purely
     because the rack lays skeletons on the PAGE; the moment one is used where they are actually
     used, inside a Card, it disappeared. `surface-2` is Run's recessed tier, which is the role a
     placeholder wants: visible against both the card and the page, in both modes.

     A SHIMMER RATHER THAN `animate-pulse`, declared as `.skeleton` in globals.css. A sweep reads as
     shorter than an opacity pulse at the same real duration, and it cannot fade toward the ground
     the way a pulse can. See that rule for the curve and the timing. */
  return <div aria-hidden className={cn('skeleton rounded-sm', className)} />;
}
