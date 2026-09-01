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
 * ─── 36px OF PILL, 44px OF TARGET (2026-08-27, Luke: "their active chip pill is more of an oval.
 * less tall than Run's. helps save vertical space") ─────────────────────────────────────────────
 *
 * It was `min-h-11`, which put the 44px tap floor into the VISIBLE box - so on a 390px screen the
 * selected chip came out nearly square, and two chip rows spent 88px of height on two words. The
 * floor is a fact about fingers, not about ink, and `.hit-44` is the class this codebase already has
 * for exactly that split: an invisible expander computed from the control's own size, so a 36px pill
 * still answers a 44px press. Nothing about the target changed; only what you can see did.
 *
 * `text-small` (12px) AND THE RULE IT BENDS. `design-system.md` §2a says chrome is never smaller
 * than the content it controls, and at 12px these sit under the 14px rows they narrow. The carve-out
 * is narrow and it is about what KIND of control this is: a segment SELECTS a view, it does not
 * perform an action, and the row it belongs to is read once and then ignored. An action - a button,
 * a menu item, anything that changes the record - still floors at 14px at every width.
 *
 * **THE CLASS SAID `text-caption` (11px) UNTIL 2026-09-01**, so the paragraph above described a
 * carve-out the code was not taking - it was taking a bigger one, a full step further down, on the
 * tier `design-system.md` reserves for disclosure. Nobody chose 11; it drifted. The code now says
 * what the comment always claimed, which is also what makes every pill in the product one size:
 * the recap's reason chips had been pushed to 14 at their call site precisely because 11 was
 * indefensible beside a 14px note, and at 12 they need no override at all.
 *
 * ─── 32px, NOT 36 (2026-09-01, Luke: "i feel like the pills are too big or at least too much
 * padding inside... i want all pills to be consistent") ────────────────────────────────────────
 *
 * `h-8` and `px-3`, down from `h-9` and `px-3.5`. `.hit-44` is computed from the control's own box,
 * so the target is still 44px and nothing about the press changed - only what you can see. This is
 * the second time this row has come down (`min-h-11` -> 36 on 2026-08-27) and for the same reason
 * both times: the tap floor is a fact about fingers, not about ink.
 *
 * ─── THE PRESS IS THE HOUSE PRESS, AND THE SCALE LASTED ONE COMMIT ────────────────────────────
 *
 * This shipped as `active:scale-95` on 2026-09-01 with an argument for why a segment was the one
 * control a shrink was honest on: `globals.css` removed `active:scale-[0.98]` from buttons for
 * being "a SHRINK, not a push - the object gets smaller and stays flat", and that reasoning leans
 * on the object HAVING a ground to be pushed into, which an unselected segment does not.
 *
 * Luke reversed it the same day - *"instead of doing the scale on the pills, we use the pressed in
 * shadow look like all the other buttons use. do that for consistency"* - and the reversal is the
 * better call for a reason the original argument stepped around: the press does not have to find a
 * ground, it can BRING one. `active:bg-[var(--pressed-bg)] active:shadow-[var(--shadow-press)]` is
 * exactly what `Button`'s secondary and ghost variants carry, so a pill now pushes in with the same
 * gesture as every other control in the product, and the unselected state gains its ground only
 * while it is held. One press language, no carve-out to remember.
 *
 * `transition-[color,background-color,box-shadow]` rather than `transition-colors`, or the ground
 * arrives instantly while the colour eases and the two halves of one gesture disagree.
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
        'hit-44 text-small inline-flex h-8 items-center justify-center rounded-full px-3 font-medium whitespace-nowrap transition-[color,background-color,box-shadow] active:bg-[var(--pressed-bg)] active:shadow-[var(--shadow-press)]',
        /* `select-pop` IS THE APP'S OWN PICKED-THING TREATMENT, so a segment reads as chosen in the
           same language as every menu row and filter chip rather than in a private one. */
        selected ? 'bg-surface-2 text-text select-pop' : 'text-muted',
        className
      )}
    />
  );
}
