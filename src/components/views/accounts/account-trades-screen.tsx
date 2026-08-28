'use client';

/* ONE ACCOUNT'S WHOLE TAPE, ON A PHONE — what "View all trades" opens (2026-08-28).
 *
 * Luke: "the header changes to a back arrow in the left side, a summary icon toggle on the right
 * side (ported from /trades page on mobile), and the title will read the accounts name and the
 * header will now have the search and filter included. port the /trades page."
 *
 * ─── IT IS A ROUTE, AND THE FILTER IS WHY ────────────────────────────────────────────────────────
 *
 * The alternative was a client-state layer over the details page, which would slide instantly
 * because that page already holds the first tape page and every id. It was refused for one reason:
 * search and the filter sheet WRITE TO THE URL. As a layer they would write to the details route's
 * own address, so backing out would leave that page silently narrowed with no Filters control left
 * to clear it - the exact trap `account-detail-header.tsx` removes the control to avoid.
 * As its own route the params belong to the screen that owns the controls, and leaving takes them
 * with it.
 *
 * ─── WHAT IS PORTED AND WHAT IS NOT ──────────────────────────────────────────────────────────────
 *
 * PORTED WHOLE: the search-and-filter row (`TradesSearchPill`, the same component, pointed at this
 * panel's own band instead of the shell's), the tape, and the summary drawer with its toggle.
 * NOT PORTED: the account selector and the Columns menu, for the reason the details page already
 * gives - every row here belongs to the one account, so a control that switches accounts and a
 * control that toggles the account column both have no job.
 *
 * THE SUMMARY IS THE DIGEST, NOT THE ACCOUNT'S FACTS. Sessions, win rate, average and best and worst
 * session, average win and loss - figures about the SET currently on screen, which is what a screen
 * with a filter on it needs and what the details page underneath deliberately does not carry.
 * Identity and provenance stay there, on the page that is about the account rather than about its
 * trades. Two summaries, two questions, neither repeated.
 *
 * ABOVE `md` THIS ROUTE REDIRECTS to the details page, which already shows the whole tape beside its
 * rail. Nobody navigates here on a desktop - the button that leads here is `md:hidden` - so what
 * this covers is a pasted link, and sending it to the page that answers the same question is better
 * than building a second desktop layout nobody asked for.
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePhone } from '@/lib/use-phone';
import { WithSummaryRail } from '@/components/shell/summary-rail';
import { DetailPanel } from './detail-panel';
import { DetailPanelHeader } from './detail-panel-header';
import type { RosterAccount } from '@/lib/accounts/read';

/* THE PANEL'S OWN BAR AND BAND, published as portal hosts. Ids rather than refs, matching
 * `header-slot.tsx`: the controls stay in the page's tree and only their paint moves.
 *
 * EXPORTED, because the route has to name the band when it builds the search row - and it cannot be
 * handed a function to build it with. A Server Component may pass finished JSX to a Client
 * Component and may not pass a callback: this file shipped a `searchPill: (hostId) => ReactNode`
 * render prop for about ten minutes and the browser said so in as many words, "Functions cannot be
 * passed directly to Client Components". A shared constant is what a render prop was standing in
 * for, and it is one line shorter. */
export const ACCOUNT_TRADES_BAND_HOST = 'account-trades-band';
const BAR_HOST = 'account-trades-bar';
const BAND_HOST = ACCOUNT_TRADES_BAND_HOST;

export function AccountTradesScreen({
  account,
  title,
  rail,
  searchPill,
  children,
}: {
  account: RosterAccount;
  title: string;
  /** The digest, rendered by the route because only the route knows the filtered set. */
  rail: ReactNode;
  /* `TradesSearchPill` pointed at `ACCOUNT_TRADES_BAND_HOST`. Built by the route so it keeps the
     route's own facets, and finished JSX rather than a builder - see the host constants above. */
  searchPill: ReactNode;
  children: ReactNode;
}) {
  const phone = usePhone();
  const router = useRouter();
  const back = `/accounts/details/${account.id}`;

  /* THE DESKTOP REDIRECT, and it has to be a CLIENT effect because a Server Component cannot know
     the viewport. `replace`, not `push`: this address must not become a step of Back that lands the
     trader here again. */
  useEffect(() => {
    if (!phone) router.replace(back);
  }, [phone, router, back]);

  /* IT RENDERS AT EVERY WIDTH, and an earlier version returned `null` above `md` to save the work.
     That cost the phone its server-rendered HTML: `usePhone` answers false on the server, so the
     whole screen came back empty and the tape was built client-side only. Above `md` the panel's
     classes are all `max-md:` gated, so what a desktop paints for the frame before the redirect is
     an ordinary column - not a broken one. */
  return (
    <DetailPanel>
      <DetailPanelHeader
        account={account}
        title={title}
        backHref={back}
        backLabel="Back to the account"
        /* THE TOGGLE PORTALS INTO HERE. `WithSummaryRail` owns the control, its `]` shortcut, its
           stored preference and its two icons; this only says where it paints. A second toggle
           defined locally would be the same job twice, and they would drift on the first change. */
        trail={<div id={BAR_HOST} className="flex items-center" />}
      />

      {/* THE SEARCH ROW, DIRECTLY UNDER THE BAR AND OUTSIDE THE SCROLLER. It does not scroll, so it
          does not belong to the thing that scrolls - the same correction `/trades` made when this
          row moved out of the page body and into the shell's band. */}
      <div id={BAND_HOST} className="shrink-0" />
      {searchPill}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <WithSummaryRail rail={rail} toggleHostId={BAR_HOST} overPanel>
          {children}
        </WithSummaryRail>
      </div>
    </DetailPanel>
  );
}
