import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireTrader } from '@/lib/trader';
import { getTradesByIds } from '@/lib/trades/read';
import { TradeDetail } from '@/components/views/trades/trade-detail';
import { SheetHeader } from '@/components/ui/sheet-header';
import { tradeTitle } from '@/lib/trades/title';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { HeaderSlot } from '@/components/shell/header-slot';

/* ONE TRADE, AS A ROUTE — AND SINCE 2026-08-25, THE COLD PATH ONLY.
 *
 * WHAT CHANGED. This used to be how the tape opened a trade, and that made every tap wait on a
 * navigation: the sheet lived in this segment's layout, so nothing could move until the route
 * committed. Measured warm on localhost, 250ms before the panel existed and 305ms before it
 * travelled, against `FilterSheet`'s 34ms. The tape now opens `TradeSheet` from client state and
 * changes the URL underneath it with the History API, so the row it already holds is the whole
 * transaction. See `trade-sheet.tsx` for the measurements and the reasoning.
 *
 * WHAT THIS IS FOR NOW: a pasted link, a bookmark, a refresh, and any desktop that reaches the URL.
 * That is why it still exists and why it still renders the complete screen on its own — the sheet's
 * `pushState` writes a URL, and a URL that only works if you arrived by tapping is a broken URL.
 *
 * NOTHING HERE ANIMATES, and that is correct rather than a regression. An entrance says "this
 * arrived over what you were looking at"; someone opening this address cold was not looking at
 * anything. The sheet's travel belongs to the tape's tap, not to the address.
 *
 * ONE `TradeDetail`, IN A RESPONSIVE CONTAINER. Rendering a phone version and a desktop version
 * would put the facts in the document twice and give two elements the same `id`. So the container
 * switches at `md` instead: below it a full-screen panel that covers the shell, from it an ordinary
 * page column.
 *
 * ─── WHAT THIS DOES NOT DO YET ────────────────────────────────────────────────────────────────
 *
 * NO PREV/NEXT. The drawer's steppers walk the tape because the tape is loaded beside them; here
 * the neighbours are whatever the trader's CURRENT FILTER says they are, which this route cannot
 * know without re-running the query and the filter that produced it. Doing it properly means
 * carrying the filter in the URL and reading a window around this id. Recorded in `build-plan.md`
 * rather than half-built.
 *
 * THE AMOUNT IS NOT CENTRED the way the reference's detail screen has it. `TradeDetail` puts the
 * mark left and the figure top-right, which is `run-trading@v2`'s measured layout and was ported
 * "exactly" at Luke's request. Changing it here would fork the one body every container shares.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const trader = await requireTrader();
  const [t] = await getTradesByIds(trader.id, [id]);
  if (!t) return { title: 'Trade' };
  return { title: tradeTitle(t) };
}

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  /* SCOPED BY `trader_id` FROM THE SESSION, never from the request — `getTradesByIds` takes the
     trader and filters on it in SQL. Without that this route is an id-guessing oracle over somebody
     else's trading history. */
  const trader = await requireTrader();
  const [t] = await getTradesByIds(trader.id, [id]);

  /* A 404, NOT AN EMPTY SCREEN. An id that resolves to nothing is either a typo or a trade that
     belongs to another trader, and both should read the same from out here — an "excluded" or
     "not found" message that only appears for real ids would confirm which ids exist. */
  if (!t) notFound();

  const title = tradeTitle(t);

  return (
    <>
      {/* THE TRAIL GOES IN THE SHELL'S OWN BAND, not in a second one underneath it (`S5d`,
          2026-08-20). This first shipped as a `sticky top-0` bar inside the page, which put the
          shell's title at y=0 and this one at y=84 — two stacked title bars, and exactly the bug
          `header-slot.tsx` exists to prevent. Above `md` this is the only trail; below it the panel
          covers the shell entirely and carries its own.
          A LINK, NOT `router.back()`. Back depends on how the trader ARRIVED, and this route now
          exists precisely for the traders who did NOT arrive from the tape — a shared link or a
          bookmark would send them wherever they were before Run. `/trades` is where this screen
          belongs regardless, and the phone's own back gesture still does the history thing. */}
      <HeaderSlot slot="title">
        {/* A LINK WEARING THE ICON BUTTON, not an `IconButton` with an onClick: this NAVIGATES, so
            it owes middle-click, cmd-click and "copy link address", none of which a button gives.
            `ICON_BUTTON` is exported for exactly this — same circle, same mechanic, one definition. */}
        <Link href="/trades" aria-label="Back to trades" className={ICON_BUTTON}>
          <Icon name="back" size={18} />
        </Link>
        <h1 className="text-title text-text ml-1 min-w-0 truncate font-medium">{title}</h1>
      </HeaderSlot>

      {/* `md:px-4`, NOT `PAGE_COLUMN` VERBATIM (2026-08-24, Luke: "we are not using the full width
          of the screen"). `PAGE_COLUMN` is `mx-auto w-full px-4`, and that `px-4` applied at every
          width — on top of the scrollport's own below `md`. Measured at 390: content began at x=32
          in a 358px box, against the tape rows it was drilled from at x=16.
          A phone screen is FULL BLEED and its children own their insets. The column and its gutter
          belong to the desktop page only. */}
      <div className="bg-bg mx-auto w-full max-md:fixed max-md:inset-0 max-md:z-[70] max-md:flex max-md:flex-col md:px-4 md:pb-8">
        <SheetHeader
          className="md:hidden"
          title={title}
          lead={
            <Link href="/trades" aria-label="Back to trades" className={ICON_BUTTON}>
              <Icon name="back" size={22} />
            </Link>
          }
        />
        {/* `min-h-0` is what lets a flex child actually shrink and scroll; without it this grows to
            its content and the header above scrolls away with the body.
            `scroll-thin` UNPREFIXED, because a Tailwind VARIANT cannot modify a hand-written class:
            `max-md:scroll-thin` compiles to nothing at all, silently. Harmless above `md`, where
            this element has no overflow and therefore no bar to thin. */}
        <div className="scroll-thin max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:px-4 max-md:pb-8">
          {/* `max-w-[560px]`, the drawer's own width, so the fact list has the same measure at every
              viewport rather than stretching a label/value pair across a 1600px monitor. */}
          <div className="mx-auto w-full max-w-[560px]">
            <TradeDetail
              trade={t}
              zone={trader.displayTimezone}
              titleId="trade-title"
              showTitle={false}
            />
          </div>
        </div>
      </div>
    </>
  );
}
