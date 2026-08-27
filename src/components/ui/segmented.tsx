/* ONE CHOICE OUT OF A ROW OF THEM, and the picked one takes a PILL.
 *
 * TWO ROWS ON `/accounts` WERE TWO COPIES OF THIS (2026-08-27). The scope chips above the chart and
 * the range chips below it had the same job, the same states and hand-typed variants of the same
 * class string - down to one saying `font-semibold` and the other `font-medium`, which nobody chose.
 * Two copies of one control is how two rows drift, so the treatment lives here and the call sites
 * own only their LAYOUT: the scope row scrolls at `w-max`, the range row divides the width with
 * `flex-1`. Same rule `header-slot.tsx` follows for the band, and `icon-button.tsx` for the disc.
 *
 * ─── WHY A PILL, WHEN THE HOUSE RULE SAYS A LABELLED CONTROL IS A `--radius-sm` RECTANGLE ────────
 *
 * (2026-08-27, Luke: "match the way monarch highlights the active state on chips. they use a
 * rounded state. like a true pill shape.")
 *
 * The rule this bends is real and it is `icon-button.tsx`'s: shape follows the control's CONTENT -
 * an icon-only control is a disc, a labelled one is an 8px rectangle - with `design-rules.md`'s hard
 * ban #6 on pill-everything behind it. Neither is broken here, because a SEGMENT IS NOT A BUTTON.
 * A button is a thing you press to make something happen and it is drawn whether or not you have
 * pressed it. A segment is one of N mutually exclusive states of a row, and the pill is not the
 * control's shape at all - it is the SELECTION MARKER moving along it. The unselected segments have
 * no shape: no ground, no border, no radius that anything can see.
 *
 * That is why this cannot spread. The moment a pill appears on something that is drawn at rest, it
 * is a button wearing a marker's shape, and hard ban #6 applies again with nothing to answer it.
 * `design-system.md` §4 carries the same paragraph beside the radius table.
 *
 * `min-h-11` (44px) IS THE TAP FLOOR, not a size choice. Both rows are phone-first controls with a
 * thumb-only operator; v2 shipped its range chips at 28px until a postcheck caught it.
 */

import { cn } from '@/lib/cn';

export function SegmentedItem({
  selected,
  className,
  ...props
}: { selected: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      /* `aria-pressed`, NOT `role="tab"`. Tabs own a tabpanel and take arrow-key navigation with
         them; these narrow what is already on screen. A pressed toggle is the honest role, and it is
         what the rest of this app's picked things already use. */
      aria-pressed={selected}
      {...props}
      className={cn(
        'text-body inline-flex min-h-11 items-center justify-center rounded-full px-3 font-medium whitespace-nowrap transition-colors',
        /* `select-pop` IS THE APP'S OWN PICKED-THING TREATMENT, so a segment reads as chosen in the
           same language as every menu row and filter chip rather than in a private one. */
        selected ? 'bg-surface-2 text-text select-pop' : 'text-muted',
        className
      )}
    />
  );
}
