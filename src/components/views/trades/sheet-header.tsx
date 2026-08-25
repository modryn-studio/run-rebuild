/* THE PHONE'S SHEET HEADER: `h-16`, one control at the far left, the title centred, no bottom
 * border. `FilterSheet` set this shape and the trade screens follow it, so the header is the one
 * thing that does NOT change as a trader moves between the two.
 *
 * IT IS SHARED BECAUSE IT IS RENDERED TWICE, and the two are genuinely different objects: the tape
 * opens a trade as an OVERLAY whose control is a `<button>` (it dismisses client state, and there
 * is no href that expresses "close"), while `/trades/[id]` opened cold renders the same bar
 * server-side with a `<Link>` (it navigates, so it owes middle-click and copy-link-address). One
 * markup, two controls, passed in as `lead`.
 *
 * IT DOES NOT POSITION ITSELF, deliberately. The overlay has to hang it absolutely over a body that
 * travels the full height of the screen; the cold-load route wants it in ordinary flow at the top
 * of a column. A component that picked one would be wrong at the other call site, and this is the
 * same "the class owns the look, the call site owns the position" split `.sheet-transition` had to
 * learn the hard way.
 *
 * NOR DOES IT PICK ITS OWN BREAKPOINT. Both call sites hide it above `md` - from there the shell's
 * band carries the trail (`header-slot.tsx`) and a second title bar underneath it is the
 * stacked-headers bug that slot exists to prevent - but the cold-load route says so on the header
 * while the overlay says it once on the whole panel. Baking `md:hidden` in here would erase the
 * specimen in `/kitchen-sink`, which runs at desktop width; that is the exact trap `filter-sheet.tsx`
 * fell into and had to be dug out of.
 */

import { cn } from '@/lib/cn';

export function SheetHeader({
  title,
  lead,
  className,
}: {
  title: string;
  lead: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-bg relative flex h-16 shrink-0 items-center justify-center px-2',
        className
      )}
    >
      {/* THE WRAPPER IS POSITIONED, NOT THE CONTROL, and `icon-button.tsx` documents why in its own
          header: `.lift-press` sets `position: relative` UNLAYERED to anchor its 44px hit expander,
          so an `absolute` passed through `className` silently resolves to relative. It did exactly
          that on `FilterSheet`'s back arrow, which rendered inline beside the centred title instead
          of at the far left. */}
      <div className="absolute left-2">{lead}</div>
      {/* `px-12` keeps the centred text clear of the control at either end. */}
      <h2 className="text-h3 text-text min-w-0 truncate px-12 font-medium">{title}</h2>
    </div>
  );
}
