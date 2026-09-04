'use client';

/* ONE TRADE ON THE PHONE: a full screen that arrives from the bottom, the same way `FilterSheet`
 * does (2026-08-24, Luke: "this page should pop up from the bottom of the screen just like the
 * filter screen ... you get this point. consistency").
 *
 * ─── IT IS CLIENT STATE NOW, AND THAT IS THE WHOLE FIX (2026-08-25) ───────────────────────────
 *
 * Luke: "i dont like the way it opens. it doesn't feel smooth like the filters page ... why does
 * that take time to load? prob because we are fetching it."
 *
 * It was fetching, and it did not need to. This screen used to BE the route: the sheet lived in
 * `[id]/layout.tsx`, so nothing could move until the navigation committed. Measured on localhost,
 * warm: 250ms before the sheet existed at all, 305ms before it began to travel. `FilterSheet`,
 * which is client state, starts moving in 34ms. Nine times the wait, on a machine with no network.
 *
 * And the thing being waited for was already in hand. `TradeDetail` takes a `TapeRow`; the tape is
 * holding the row that was tapped; `trade-drawer.tsx` has rendered the identical screen from that
 * same object, with no fetch, since the day it shipped. The phone was round-tripping a server for
 * an object already in memory - including the contract name, which the row it was tapped from is
 * rendering on screen at that moment.
 *
 * So there is NO LOADING STATE HERE, and its absence is the feature: the warm path has nothing to
 * wait for. `[id]/loading.tsx` and the title portal that fed this header are deleted rather than
 * improved, because a skeleton for data you already have is a skeleton for nothing.
 *
 * THE HEADER SWAPS, THE BODY TRAVELS (Luke: "the header should just change ... that header should
 * not pop up with the trade details page ... exactly like how we have it work with the Filters
 * page"). He is describing `FilterSheet`'s DRILL-IN, not its entrance - the drill-in changes its
 * header in place while only the new screen slides, and that is the model here. The header is
 * rendered on `open` and is not inside the travelling element, so it is simply THERE on the frame
 * of the tap and simply GONE on the frame of the back press.
 *
 * THE URL STILL CHANGES, so this stays shareable and survives a reload - `useOverlayBack` pushes
 * `/trades/<id>` with the native History API, which Next supports and which does NOT re-run the
 * router. Measured before it was relied on: all 60 tape rows stayed mounted and zero requests
 * fired. That is also what makes BACK instant, because there is no tape to rebuild. The route at
 * `/trades/[id]` still exists and still renders on its own; it is the cold-load path now, for a
 * pasted link or a refresh, rather than the way the tape opens a trade.
 *
 * THE PHONE ONLY. Above `md` a trader opening a trade is reading one against the tape behind it and
 * stepping through several, which is what `TradeDrawer` is for. `openTrade` in the tape picks the
 * container at the tap, so only one of the two is ever populated and `TradeDetail` is never in the
 * document twice.
 *
 * NO PREV/NEXT ARROWS, and that is unchanged rather than unconsidered - see the route's own note.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { useOverlayBack } from '@/lib/overlay-back';
import { tradeTitle } from '@/lib/trades/title';
import type { TapeRow } from '@/lib/trades/read';
import { SheetHeader, SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { TradeDetail } from './trade-detail';

export function TradeSheet({
  row,
  zone,
  onClose,
  className,
}: {
  /** The tapped row, straight off the tape. `null` is closed. */
  row: TapeRow | null;
  zone: string;
  onClose: () => void;
  /* WHERE THIS IS ALLOWED TO EXIST IS THE CALLER'S CALL, NOT THIS COMPONENT'S, and `filter-sheet.tsx`
     paid for the rule: `md:hidden` baked into the root made that sheet impossible to put in
     `/kitchen-sink`, because the rack runs at desktop width and the component erased itself there.
     CLAUDE.md requires a component in the rack in every state, and for a `fixed inset-0 z-[70]`
     panel the state that matters is the CLOSED one - which is exactly the state that broke in
     production. The tape passes `md:hidden`; the rack passes nothing. */
  className?: string;
}) {
  const open = row !== null;

  /* WHAT THE PANEL IS STILL SHOWING WHILE IT SLIDES BACK DOWN. `row` goes null the instant Back is
     pressed, because the header has to disappear on that frame - so without a second piece of
     state the panel would empty itself and then animate a blank screen away. The same split
     `FilterSheet` makes with `shown`, for the same reason. It is never cleared: off-screen content
     costs nothing, and the next open overwrites it. */
  const [shown, setShown] = useState<TapeRow | null>(row);
  useEffect(() => {
    if (row) setShown(row);
  }, [row]);

  /* THE URL COMES FROM `row`, NOT `shown`. `shown` trails by one commit, so on the frame the sheet
     opens it is still the PREVIOUS trade - and this hook pushes its entry on exactly that frame. */
  /* THE MARKER IS KEPT NOW, because this sheet has something inside it that navigates (2026-09-04):
     the account line in `TradeDetail` links to `/accounts/details/<id>`. Without it, this hook's
     cleanup runs `history.back()` in the same React commit as the router's push and unwrites it -
     the trader taps the account, the account page appears, and the phone bounces straight back to
     the tape. That is the identical race `overlay-back.ts` documents for the filter sheet's Apply,
     and the marker is the fix that already exists for it. */
  const markReplacing = useOverlayBack(open, onClose, row ? `/trades/${row.id}` : undefined);

  /* ESCAPE CLOSES, for the keyboard reaching this below `md` - a narrowed desktop window, or a
     phone with a keyboard attached. The device back button is handled by `useOverlayBack`; this is
     the other way out, and a full-screen panel owes both. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      /* MOUNTED WHETHER OR NOT IT IS OPEN, which is what lets it animate at all - and what lets it
         animate OUT. A panel conditionally rendered has nothing to transition from on the way in
         and is gone before it can travel on the way out.
         THREE ATTRIBUTES, THREE AUDIENCES, and the project has been bitten by treating them as one:
         `pointer-events-none` stops the pointer, `aria-hidden` stops the reader, and only `inert`
         takes a dismissed panel out of the TAB ORDER. */
      className={cn('fixed inset-0 z-[70]', !open && 'pointer-events-none', className)}
      aria-hidden={!open}
      inert={!open}
    >
      {/* RENDERED ON `open`, NOT ANIMATED. This is the swap the drill-in does: on the frame of the
          tap this header replaces the shell's, and on the frame of the back press it vanishes and
          the shell's "Trades" header is simply there underneath again. Painting it while closed
          would put an opaque bar over the tape's own header. */}
      {open && shown && (
        <div className="absolute inset-x-0 top-0 z-10">
          <SheetHeader
            title={tradeTitle(shown)}
            lead={
              /* A BUTTON, NOT A LINK, because this dismisses client state rather than navigating -
               there is no href that expresses "close". The route's own trail in the shell band
               stays a `<Link>`, where middle-click and copy-link-address are worth something. */
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to trades"
                className={ICON_BUTTON}
              >
                <Icon name="back" size={SHEET_CONTROL_ICON} />
              </button>
            }
          />
        </div>
      )}

      {/* THE BODY IS THE ONLY THING THAT TRAVELS.
          `inset-0` WITH `pt-16`, NOT `top-16`. `translate-y-full` is 100% of this element's OWN
          height, so a box inset from the top by the header would stop 64px short and leave a strip
          of the trade parked at the bottom of the screen. Full height, padded, and 100% is exactly
          the distance off.
          `.sheet-transition` and `scroll-thin` are unprefixed because a Tailwind VARIANT cannot
          modify a hand-written class - `max-md:sheet-transition` compiles to nothing at all, which
          this codebase has been caught by twice. Harmless here: the root is `md:hidden`. */}
      <div
        data-open={open}
        className={cn(
          'sheet-transition bg-bg scroll-thin absolute inset-0 overflow-y-auto px-4 pt-16 pb-8',
          !open && 'translate-y-full'
        )}
      >
        {/* `max-w-[560px]`, the drawer's own width, so the fact list has the same measure in both
            containers rather than stretching across a wide phone in landscape. */}
        <div className="mx-auto w-full max-w-[560px]">
          {shown && (
            <TradeDetail
              trade={shown}
              zone={zone}
              titleId="trade-sheet-title"
              showTitle={false}
              onLeave={markReplacing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
