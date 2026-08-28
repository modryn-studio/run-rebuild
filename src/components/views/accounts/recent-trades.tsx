'use client';

/* THE PHONE'S TRADE TABLE ON AN ACCOUNT PAGE: four rows and a way to the rest (2026-08-28).
 *
 * Luke, walking Monarch's own account screen: "remove the trades table and replace it with a new
 * table called Recent Trades ... this header row will say 'Recent Trades'. then we can display the
 * four most recent trades."
 *
 * ─── WHY IT REPLACES THE TAPE RATHER THAN SHRINKING IT ───────────────────────────────────────────
 *
 * The desktop details page is a chart, the whole tape and a rail of facts, side by side. A phone has
 * one column, so those three become a scroll - and a full tape in the middle of it means the facts
 * about the account are a thousand rows down. Monarch's answer is the one being copied: the account
 * screen shows a handful and hands off to a screen that is only the list.
 *
 * IT USES THE TAPE'S OWN ROW (`TradeRow`), exported for this. A lookalike would drift within a week,
 * and that row carries a dozen measured decisions - the 45px mark inset taken off the reference as a
 * ratio of screen width, the 14px phone step it shares with the roster row, which columns drop below
 * `sm`, where the net figure pins its right edge. What differs here is the HEADER and the LENGTH,
 * which is all that should.
 *
 * THE HEADER ROW IS SIZED LIKE A TRADE ROW, NOT LIKE THE TAPE'S HEADER (Luke: "a header row the same
 * size and bg color as the trade row"). The tape's own header is `min-h-15`, sticky, and carries the
 * count, the account selector and the Columns menu - it is a toolbar. This is a caption. `min-h-13`
 * and the row's own gutter is what makes the two read as one table rather than as a widget with a
 * list under it.
 *
 * THE CTA IS AN INSET PILL BELOW THE LAST ROW, which is Monarch's shape and Luke's pick. It was
 * offered as a row-height last line inside the table; he took the pill. The distinction it buys is
 * real - the table ends, and then there is a thing to press.
 *
 * TAPPING A ROW OPENS THE SHEET, NOT THE ROUTE. The row is already in hand, which is the whole
 * reason `TradeSheet` exists as client state: the phone once round-tripped the server for a row the
 * list it was tapped from was rendering, 305ms before anything moved. Four rows in memory is exactly
 * that case.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { TradeRow } from '@/components/views/trades/trades-tape';
import { TradeSheet } from '@/components/views/trades/trade-sheet';
import type { TapeRow } from '@/lib/trades/read';

/** Four, which is Monarch's count on the same screen and fits above the fold beside the chart. */
const SHOWN = 4;

export function RecentTrades({
  trades,
  zone,
  allHref,
}: {
  /** The tape's first page, already ordered. Only the head of it is drawn. */
  trades: TapeRow[];
  zone: string;
  /** `/accounts/details/<id>/trades`. The screen that is only the list. */
  allHref: string;
}) {
  const [open, setOpen] = useState<TapeRow | null>(null);
  const shown = trades.slice(0, SHOWN);

  return (
    <>
      {/* FULL BLEED, cancelling the page column's gutter, exactly as the tape card does at this
          width. Three surfaces that each begin at a different x is what makes a column read as
          loose rather than as a list. */}
      <Card className="mt-4 overflow-clip max-md:-mx-4 max-md:rounded-none max-md:shadow-none">
        <div className="border-rule text-body-lg text-text flex min-h-13 items-center border-b px-5 font-medium max-md:px-4">
          Recent Trades
        </div>

        {shown.length === 0 ? (
          /* THE EMPTY CASE IS THE ACCOUNT'S FIRST DAY, and it says so rather than drawing an empty
             table with a button under it. No "filtered" variant: this page's four rows are never
             narrowed - the filter lives on the screen the button leads to. */
          <p className="text-body text-muted px-5 py-8 text-center max-md:px-4">
            No trades imported for this account yet.
          </p>
        ) : (
          <>
            <div className="divide-rule divide-y">
              {shown.map((t) => (
                <TradeRow
                  key={t.id}
                  trade={t}
                  zone={zone}
                  onOpen={() => setOpen(t)}
                  /* ACCOUNT IS OFF because every row belongs to the account this page IS, which is
                     the same call the desktop tape makes here with `fixedColumns`. Time is left on:
                     it is hidden below `sm` by the row itself, so naming it here would be stating a
                     breakpoint twice. */
                  hidden={['account']}
                />
              ))}
            </div>

            {/* MONARCH'S SHAPE: a gap, then a full-width button inside the card's gutter. `lg` is
                the app's full-width CTA height and the one the modals' own footers use, so this is
                the same object a trader has already pressed elsewhere rather than a new size
                invented for one table. */}
            <div className="px-4 py-3">
              <Link href={allHref} className={buttonClasses('secondary', 'lg', 'w-full')}>
                View all trades
              </Link>
            </div>
          </>
        )}
      </Card>

      {/* OUTSIDE THE CARD. It is `fixed inset-0 z-[70]` and the card is `overflow-clip`, which would
          be a clipping context for a positioned descendant the moment anything on the card grows a
          transform. Same reason the filter sheet was moved out of the search row's box. */}
      <TradeSheet
        className="md:hidden"
        row={open}
        zone={zone}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
