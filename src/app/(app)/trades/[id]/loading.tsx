import { LoadingMark } from '@/components/ui/loading-mark';
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
 * /trades/[id] showed the loading mark ZERO times.
 *
 * A boundary on THIS segment is newly mounted by that navigation, so it displays immediately. Which
 * is what `CLAUDE.md` already prescribes: "a route needing a Suspense boundary declares its own."
 *
 * IT RENDERS THE SHEET, NOT A BARE MARK. The sheet is what the tap asked for, so it should be what
 * arrives - it slides up on the same curve at the same moment it always did, and the facts fill in
 * underneath. A centred spinner on the tape instead would answer a question nobody asked and then
 * be replaced by the thing they did.
 *
 * THE WORDMARK, NOT THE SPINNER, and `loading-mark.tsx` draws that line: a spinner says "a request
 * is in flight", which is a mechanical fact about the system; the wordmark says "Run is here, hold
 * on", which is what a whole surface arriving means. This is a surface.
 *
 * NO TITLE. The contract is the trade's, and it is not known until the trade is read. A placeholder
 * would be a label that changes into a different label.
 */
export default function Loading() {
  return (
    <TradeSheet>
      {/* `min-h-64` so the mark has somewhere to be centred. Without a height the sheet's scrollport
          collapses to nothing on the desktop page, where it is not a flex column. */}
      <div className="min-h-64">
        <LoadingMark />
      </div>
    </TradeSheet>
  );
}
