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
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

export function RefreshRoster() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="md"
      disabled={pending}
      /* THE NAME IS UNCONDITIONAL even though the label hides below `sm` - a control whose name
         disappears at one width is nameless to a screen reader at that width. */
      aria-label="Refresh"
      onClick={() => start(() => router.refresh())}
    >
      <Icon name="refresh" className={cn(pending && 'animate-spin')} />
      <span className="max-sm:hidden">Refresh</span>
    </Button>
  );
}
