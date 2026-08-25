import { TradeSheet } from '@/components/views/trades/trade-sheet';

/* THE SHEET LIVES HERE SO IT ANIMATES ONCE (2026-08-25).
 *
 * A layout does NOT re-render when a child segment resolves - that is its defining property in the
 * App Router, and it is the whole reason this file exists. With the sheet in `page.tsx` and a copy
 * in `loading.tsx`, the swap from one to the other unmounted an element and mounted a different
 * one, and both ran their entrance: the panel slid up with the skeleton, then slid up AGAIN with the
 * facts. Luke saw it immediately - "like a hiccup or a double screen".
 *
 * Here it mounts once. `loading.tsx` and `page.tsx` are now only its CHILDREN, so the skeleton is
 * replaced by the facts inside a panel that never moves.
 *
 * NOTHING IS FETCHED IN THIS FILE, deliberately. A layout that awaits the trade would suspend the
 * sheet along with it, and a sheet that arrives instantly is the behaviour being restored. The
 * header's title comes from the page by portal instead - see `TRADE_SHEET_TITLE_SLOT_ID`.
 */
export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <TradeSheet>{children}</TradeSheet>;
}
