'use client';

/* RE-READ THE RECORD. One button, and unlike v2's it actually does something.
 *
 * v2 SHIPS THIS CONTROL INERT, tracked there as #57, and its own header comment names the cost:
 * "It was a placeholder for weeks, which is worse than absent: an inert control standing beside two
 * working ones teaches that buttons in this app might not do anything." This build left it out for
 * exactly that reason - and that reasoning was right about v2 and wrong about here.
 *
 * WHAT MAKES IT REAL IS THE ARCHITECTURE, not a broker socket. `/accounts` is a Server Component
 * reading `getRoster`, `getFreshness` and `getDailySeries` on every render, so `router.refresh()`
 * re-runs all three against Postgres and streams a new payload into the same DOM. That is a genuine
 * re-read of the record: an import committed in another tab, a label changed on a detail page, a
 * projection rebuilt by a script - all of it lands here. v2 could not say that because it had
 * nothing behind the button; this does.
 *
 * IT SAYS WHEN IT IS WORKING. `useTransition`'s pending flag spins the mark and disables the press,
 * because a re-read that finishes in 200ms with no visible change is indistinguishable from a
 * button that ignored you - which is the same lesson v2's placeholder taught, arrived at from the
 * other direction.
 *
 * `animate-spin` IS `linear`, WHICH IS THE ONE CASE THE HOUSE RULE ALLOWS IT: "linear only for
 * constant motion". A spinner has no start and no end to ease against.
 *
 * A DISC ON A PHONE, A LABELLED BUTTON ON A DESKTOP (2026-08-27, Luke: "we dont use buttons in the
 * mobile header. we use icons ... match the sizing of the other header icons for consistency").
 * The shell's own mobile band is icon-only by construction - hamburger, bell, and `/trades`' summary
 * toggle are all `IconButton` carrying a 22px mark - so a bordered secondary button standing beside
 * them was this page announcing itself as a different KIND of header. It is not one.
 *
 * TWO ELEMENTS, NOT ONE THAT RESHAPES. They are different components with different geometry (a
 * 36px disc against a bordered `h-9` box with a label), and the switch has to resolve on the FIRST
 * paint from a media query rather than from a width read after hydration. The cost is one extra
 * inert node in the document at each width, which is what `summary-rail.tsx` already pays for the
 * same reason. The state is shared, so the two can never disagree about whether a refresh is in
 * flight.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

export function RefreshRoster() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = () => start(() => router.refresh());

  return (
    <>
      {/* `size={22}`, WHICH IS THE MOBILE BAND'S OWN SCALE and not this control's preference: the
          hamburger, the bell and `/trades`' summary toggle all carry 22 below `md` and 18 above it.
          A 16px mark here would read as a smaller control rather than as the same one. */}
      <IconButton
        className="md:hidden"
        disabled={pending}
        aria-label="Refresh"
        onClick={refresh}
      >
        <Icon name="refresh" size={22} className={cn(pending && 'animate-spin')} />
      </IconButton>

      <Button
        variant="secondary"
        size="md"
        className="max-md:hidden"
        disabled={pending}
        /* THE NAME IS UNCONDITIONAL even though the label hides below `sm` - a control whose name
           disappears at one width is nameless to a screen reader at that width. */
        aria-label="Refresh"
        onClick={refresh}
      >
        <Icon name="refresh" className={cn(pending && 'animate-spin')} />
        <span className="max-sm:hidden">Refresh</span>
      </Button>
    </>
  );
}
