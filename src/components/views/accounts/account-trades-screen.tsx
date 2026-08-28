'use client';

/* ONE ACCOUNT'S WHOLE TAPE, ON A PHONE — what "View all trades" opens (2026-08-28).
 *
 * Luke: "the header changes to a back arrow in the left side, a summary icon toggle on the right
 * side (ported from /trades page on mobile), and the title will read the accounts name and the
 * header will now have the search and filter included. port the /trades page."
 *
 * THE BAR AND THE PANEL ARE THE SEGMENT LAYOUT'S, not this component's. That is what keeps the
 * header still while the body slides in from the bottom, and it is why this file is now only the
 * summary rail's wiring and one redirect - see `detail-panel.tsx` for the whole arrangement.
 *
 * ─── IT IS A ROUTE, AND THE FILTER IS WHY ────────────────────────────────────────────────────────
 *
 * The alternative was a client-state layer over the details page, which would slide instantly
 * because that page already holds the first tape page and every id. It was refused for one reason:
 * search and the filter sheet WRITE TO THE URL. As a layer they would write to the details route's
 * own address, so backing out would leave that page silently narrowed with no Filters control left
 * to clear it - the exact trap `account-detail-header.tsx` removes the control to avoid. As its own
 * route the params belong to the screen that owns the controls, and leaving takes them with it.
 *
 * ─── WHAT IS PORTED AND WHAT IS NOT ──────────────────────────────────────────────────────────────
 *
 * PORTED WHOLE: the search-and-filter row (`TradesSearchPill`, the same component, pointed at the
 * layout's band instead of the shell's), the tape, and the summary drawer with its toggle.
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
import { ACCOUNT_TRADES_BAR_HOST } from './detail-panel-header';

export function AccountTradesScreen({
  accountId,
  rail,
  children,
}: {
  accountId: string;
  /** The digest, rendered by the route because only the route knows the filtered set. */
  rail: ReactNode;
  children: ReactNode;
}) {
  const phone = usePhone();
  const router = useRouter();
  const back = `/accounts/details/${accountId}`;

  /* THE DESKTOP REDIRECT, and it has to be a CLIENT effect because a Server Component cannot know
     the viewport. `replace`, not `push`: this address must not become a step of Back that lands the
     trader here again.
     IT RENDERS AT EVERY WIDTH rather than returning null above `md`. An earlier version returned
     null to save the work and cost the phone its server-rendered HTML: `usePhone` answers false on
     the server, so the whole screen came back empty and the tape was built client-side only. */
  useEffect(() => {
    if (!phone) router.replace(back);
  }, [phone, router, back]);

  return (
    <WithSummaryRail rail={rail} toggleHostId={ACCOUNT_TRADES_BAR_HOST} overPanel>
      {children}
    </WithSummaryRail>
  );
}
