import { Skeleton } from '@/components/ui/skeleton';
import { TradeSheet } from '@/components/views/trades/trade-sheet';

/* THIS ROUTE DECLARES ITS OWN BOUNDARY, and that is the whole reason it exists (2026-08-24, Luke:
 * "sometimes when i click on a trade row to open the trade details screen, it takes a little bit to
 * load ... if there is ever time a page is taking to load, we need a loading state").
 *
 * `(app)/loading.tsx` DID NOT COVER THIS, and not because it was written wrong. Its boundary wraps
 * the whole `(app)` segment and is therefore ALREADY MOUNTED whenever a trader is anywhere inside
 * the app. React deliberately does not re-show an existing boundary's fallback during a transition -
 * it keeps the current screen rather than flashing - so that fallback only ever fires on a cold
 * entry into the app, never when moving between pages inside it. Measured: navigating /trades ->
 * /trades/[id] showed the loading mark ZERO times. A boundary on THIS segment is newly mounted by
 * that navigation, so it displays. Which is what CLAUDE.md prescribes: "a route needing a Suspense
 * boundary declares its own."
 *
 * A SKELETON, NOT THE WORDMARK (2026-08-25, and this reverses yesterday's call). The wordmark shipped
 * here first on the reasoning that a whole surface was arriving. That test is not the right one, and
 * the rack has said so all along: "Use a skeleton when you know the SHAPE of what is coming, and a
 * spinner when you do not." The shape here is known exactly - a header block and a fact list, the
 * same one `TradeDetail` always renders. Guessing was never involved.
 * The research agrees and is more specific: a skeleton is perceived as up to 50% faster than a
 * spinner at identical real load times, precisely because it pre-states the layout. The wordmark
 * belongs to a COLD ENTRY into the app, where nothing about the destination is known yet.
 *
 * IT RENDERS INSIDE THE SHEET, so the tap gets what it asked for: the sheet slides up on the same
 * curve at the same moment it always did, and the facts fill into a frame that is already the right
 * shape. A centred mark on the tape instead would answer a question nobody asked and then be
 * replaced by the thing they did.
 *
 * NO TITLE. The contract is the trade's and is not known until it is read; a placeholder would be a
 * label that changes into a different label.
 */
export default function Loading() {
  return (
    <TradeSheet>
      {/* `.wait-reveal` HOLDS IT INVISIBLE FOR 300ms. Most of these navigations are prefetched and
          land inside that window, where a mark that appears and vanishes is a flicker added to a
          load that already felt instant. See globals.css for the measurement behind the number. */}
      <div className="wait-reveal pt-2">
        {/* THE SHAPE IS `TradeDetail`'S, ROW FOR ROW, and it has to be: a skeleton that does not
            match its content reflows the moment the content lands, which reads worse than the
            spinner it replaced. The rack's own intro says exactly that. */}
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="mt-4 h-7 w-56" />

        {/* Three sections of fact rows: Result, The trade, At the broker. */}
        {[4, 6, 3].map((rows, section) => (
          <div key={section} className="mt-8">
            <Skeleton className="h-3 w-24" />
            <div className="mt-3 flex flex-col gap-3">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TradeSheet>
  );
}
