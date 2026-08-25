'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TRADE_SHEET_TITLE_SLOT_ID } from '@/components/views/trades/trade-sheet';

/* THE CONTRACT NAME, INTO THE SHEET'S HEADER FROM THE PAGE THAT KNOWS IT.
 *
 * The sheet is rendered by the segment's LAYOUT so that it animates once rather than twice (see
 * `layout.tsx`), and a layout that fetched the trade would suspend the sheet along with it. So the
 * chrome is the layout's and this one fact is the page's, which is the same split `HeaderSlot`
 * already makes for the shell's own band.
 *
 * PHONE ONLY IN PRACTICE. Above `md` the sheet's header is `md:hidden` and the shell's band carries
 * the trail instead, so this portals into an element that is not on screen - harmless, and cheaper
 * than a second breakpoint check that would have to agree with the sheet's.
 */
export function TradeSheetTitle({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  // On mount only: the host belongs to the layout, which outlives every page under it.
  useEffect(() => setHost(document.getElementById(TRADE_SHEET_TITLE_SLOT_ID)), []);

  return host ? createPortal(children, host) : null;
}
