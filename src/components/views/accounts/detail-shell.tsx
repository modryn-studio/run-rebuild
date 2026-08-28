'use client';

/* THE SEGMENT'S PHONE CHROME, MOUNTED ONCE — panel, bar, band, and the one box that travels.
 *
 * It is a client component because it reads `useSelectedLayoutSegment()`: the bar and the body's key
 * both depend on WHICH child route is showing, and a Server Component cannot know that without the
 * route telling it, which is the prop-drilling this replaces.
 *
 * THE KEY IS THE WHOLE TRICK. `DetailPanelBody` enters from the bottom on mount, so what it is keyed
 * on decides when the screen slides:
 *
 *   details -> trades   the segment changes, so the body REMOUNTS and slides. The bar renames at the
 *                       same moment and does not move, which is the rule: "the header changes, so
 *                       the page slides".
 *   loading -> page     the segment does not change, so the body stays mounted and its CONTENT
 *                       swaps. The skeleton does not slide out and the page does not slide in; the
 *                       same screen finished arriving. This is the "entrance runs twice" failure
 *                       `design-system.md` §7 names, avoided by structure rather than by a flag.
 *
 * THE BAND IS OUTSIDE THE SCROLLER, and only exists on the trades child. `TradesSearchPill` portals
 * into it - a row that does not scroll does not belong to the thing that scrolls, which is the same
 * correction `/trades` made when that row moved out of the page body and into the shell's band.
 */

import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccountModalsProvider } from './account-modals';
import { DetailPanel, DetailPanelBody } from './detail-panel';
import { DetailPanelHeader, ACCOUNT_TRADES_BAND_HOST } from './detail-panel-header';
import type { RosterAccount } from '@/lib/accounts/read';

export function DetailShell({
  account,
  title,
  siblingCount,
  children,
}: {
  account: RosterAccount;
  title: string;
  /* A NUMBER, NOT THE CALLBACK THE PROVIDER TAKES, and that is a boundary rule rather than taste.
     The provider's `siblingsFor` is a function, and a SERVER Component may not hand a function to a
     client one - "Functions cannot be passed directly to Client Components", which is exactly what
     the segment layout got when it tried. This page knows one account, so the callback has one
     answer and it is cheaper to send the answer. The roster page still passes the callback, because
     it is a Client Component and it counts from a roster it already holds. */
  siblingCount: number;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const onTrades = segment === 'trades';

  return (
    /* THE MODAL PROVIDER IS HERE rather than in the layout, for the same boundary reason - and it
       has to be above the bar, whose Edit control opens the label editor. */
    <AccountModalsProvider siblingsFor={() => siblingCount}>
      <DetailPanel>
        <DetailPanelHeader account={account} title={title} onTrades={onTrades} />
        {onTrades && <div id={ACCOUNT_TRADES_BAND_HOST} className="shrink-0 md:hidden" />}
        <DetailPanelBody key={segment ?? 'details'}>{children}</DetailPanelBody>
      </DetailPanel>
    </AccountModalsProvider>
  );
}
