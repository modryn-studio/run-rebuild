import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireTrader } from '@/lib/trader';
import { getTradesByIds } from '@/lib/trades/read';
import { productName } from '@/lib/instruments';
import { TradeDetail } from '@/components/views/trades/trade-detail';
import { ICON_BUTTON } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { HeaderSlot } from '@/components/shell/header-slot';
import { TradeSheetTitle } from '@/components/views/trades/trade-sheet-title';

/* ONE TRADE, AS A ROUTE (`S5d`, 2026-08-20) THAT PRESENTS AS A SHEET (2026-08-24).
 *
 * WHY A ROUTE AND NOT THE DRAWER (Luke's call). On a phone the reference opens a transaction as a
 * full screen that animates up, and the phone's BACK GESTURE has to answer it. An overlay would
 * need history interception to do that, and getting it wrong strands someone on a screen they
 * cannot leave. A route gets back, back-swipe, a shareable URL and survives a reload for free.
 *
 * AND IT NOW ARRIVES LIKE ONE (Luke: "this page should pop up from the bottom of the screen just
 * like the filter screen ... you get this point. consistency"). `TradeSheet` gives it the filter
 * sheet's entrance, header and scrollport below `md` while leaving the mechanism alone - the
 * presentation changed, the router did not.
 *
 * THE DESKTOP KEEPS THE DRAWER. Above `sm` a trader opening a trade is reading one against the tape
 * behind it and stepping through several — that is what a drawer is for, and `trade-drawer.tsx`
 * says so at length. This route is the phone's answer to the same question, not a replacement.
 * Both render `TradeDetail`; neither owns a copy of the facts.
 *
 * IT IS REACHABLE ON A DESKTOP TOO, deliberately. A URL that only works at one viewport is a URL
 * somebody will paste and someone else will open on a laptop. It renders the same screen there.
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
 * "exactly" at Luke's request. Changing it here would fork the one body both containers share — the
 * whole reason this file renders a shared component. Worth deciding as its own change.
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
  const contract = t.contract ?? t.symbolRoot;
  return { title: productName(contract) ?? contract };
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

  const contract = t.contract ?? t.symbolRoot;

  const title = productName(contract) ?? contract;

  return (
    <>
      {/* THE SHEET IS THE LAYOUT'S NOW, so it animates once instead of twice - see `layout.tsx`.
          This page is its child, and hands it the one fact the layout could not know without
          suspending the very panel that has to arrive instantly. */}
      <TradeSheetTitle>{title}</TradeSheetTitle>
      {/* THE TRAIL GOES IN THE SHELL'S OWN BAND, not in a second one underneath it (`S5d`,
          2026-08-20). This first shipped as a `sticky top-0` bar inside the page, which put the
          shell's title at y=0 and this one at y=84 — two stacked title bars, and exactly the bug
          `header-slot.tsx` exists to prevent. `HEADER_TITLE_SLOT_ID` is the slot written for this
          case, and its own note names it: "what belongs there is usually not a title anyway but a
          TRAIL — the way back plus which row you drilled into".
          `routeTitle` now yields for any route below a NAV href, so the band's left is empty and
          this fills it.
          A LINK, NOT `router.back()`. Back depends on how the trader ARRIVED — opening this URL
          cold, or landing here from a shared link, would send them wherever they were before Run.
          `/trades` is where this screen belongs regardless, and the phone's own back gesture still
          does the history thing for anyone who wants it. */}
      <HeaderSlot slot="title">
        {/* A LINK WEARING THE ICON BUTTON, not an `IconButton` with an onClick: this NAVIGATES, so
            it owes middle-click, cmd-click and "copy link address", none of which a button gives.
            `ICON_BUTTON` is exported for exactly this — same circle, same mechanic, one definition. */}
        <Link href="/trades" aria-label="Back to trades" className={ICON_BUTTON}>
          <Icon name="back" size={18} />
        </Link>
        <h1 className="text-title text-text ml-1 min-w-0 truncate font-medium">{title}</h1>
      </HeaderSlot>

      <TradeDetail trade={t} zone={trader.displayTimezone} titleId="trade-title" showTitle={false} />
    </>
  );
}
