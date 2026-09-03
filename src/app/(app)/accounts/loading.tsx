import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { RosterSkeleton } from '@/components/views/accounts/roster-skeleton';

/* THE ROSTER, BEFORE ITS FIGURES ARRIVE - and this file exists because `/accounts` was the one tab
 * in the app still waiting behind the WORDMARK (2026-09-03, Luke: *"look at all the different
 * places we use loading state as well. look at the /accounts page also. do a full review on this.
 * also look at consistency."*).
 *
 * WHY IT IS A SKELETON, what the audit found, and how the shape is measured all live in
 * `views/accounts/roster-skeleton.tsx`, beside the component - because that is the file
 * `/kitchen-sink` can render and a route's default export is not. The audit itself is
 * `design-system.md` §7.
 *
 * ─── `.wait-reveal` ON THE WHOLE BODY ──────────────────────────────────────────────────────────
 *
 * It can go on the root because this file holds no chrome: the header band's controls belong to
 * `AccountsHeader`, which the PAGE portals, so nothing in this subtree is drawn-before-the-data the
 * way `/trades`' search field is. 300ms invisible, then a 200ms fade - most navigations here are
 * prefetched and land inside that window, where a mark that appears and vanishes adds a flicker to
 * a load that already felt instant.
 *
 * IT STAYS ON THE BOUNDARY AND NOT INSIDE THE COMPONENT, which is what lets the component be
 * racked: `.wait-reveal` holds its subject invisible for 300ms, so a specimen carrying it would
 * rack a blank box. The boundary is the thing that knows a wait is happening.
 *
 * ─── IT OCCUPIES THE PAGE'S OWN BOXES, GUTTER INCLUDED ─────────────────────────────────────────
 *
 * `PAGE_COLUMN` here rather than inside `RosterSkeleton`, because a boundary is not inside the
 * page's wrapper and the gutter has to be declared again - `/trades`' boundary shipped without it
 * and Luke caught it: *"the skeleton takes up the full width of the screen. it has no right and
 * left side padding."* Keeping it out of the component is also what lets the rack lay the specimen
 * out in its own column instead of inheriting the app's.
 */
export default function Loading() {
  return (
    <div className={cn(PAGE_COLUMN, 'wait-reveal pb-8')}>
      <RosterSkeleton />
    </div>
  );
}
