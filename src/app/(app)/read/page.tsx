import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Read' };

/* READ — a placeholder, and the nav row above it is why this file exists (2026-09-03).
 *
 * THE ROW HAS BEEN IN `NAV` SINCE `S3b` AND THE ROUTE HAS NOT EXISTED SINCE. Luke's call on
 * 2026-08-31 was "dont delete /read from the left sidebar. just keep it as a 404 for now", which was
 * right while the read was days from shipping. It stopped being right when the read left the beta
 * (2026-09-03, Luke: "do not implement the nightly job wired to the reading ... we are not shipping
 * that in the beta version right now"), because a 404 you reach from your own navigation reads as a
 * broken app rather than as an unfinished one - and a beta's first job is to be trusted.
 *
 * SO IT SAYS WHAT IS TRUE. Not "coming soon" as a slogan on an empty page: `EmptyState` is the
 * primitive this product already uses for "there is nothing here", and its own note says an empty
 * state with no next action is a dead end. The action here is the honest one - there is nothing to
 * press yet, so it takes none, and the description carries the work instead.
 *
 * NO CTA, AND THAT IS THE ONE PLACE THIS DEPARTS FROM THE PRIMITIVE'S RULE. Every other empty state
 * in the app can offer something ("Import your first file", "Widen the dates"). This one cannot: the
 * thing to do is trade and come back, and a button that navigates away from a page the trader
 * deliberately opened is a worse answer than no button.
 *
 * WHAT IT MUST NOT DO IS COUNT. `CLAUDE.md`'s re-entry doctrine - no state may represent absence -
 * applies here more than anywhere: no "0 reads", no "check back tomorrow", no date. Those are all
 * ways of telling a trader they are behind on a thing that has never existed.
 *
 * WHEN THE READ SHIPS this page becomes the archive `build-plan.md` §S8 describes - past reads by
 * session, the arrows, and the weekly roll-up - and `user-guide.md` §6 keeps that spec. Nothing here
 * is load-bearing for it; this file is a door with a note on it.
 */
export default async function ReadPage() {
  /* THE SAME GATE EVERY OTHER ROUTE IN THIS SEGMENT TAKES. A placeholder is still a signed-in
     surface: it names a product feature, and an anonymous visitor reaching it would learn what is
     being built from a page that is meant to be behind the login. */
  await requireTrader();

  return (
    <div className={cn(PAGE_COLUMN, 'py-6')}>
      <EmptyState
        icon={FileText}
        title="Your daily read is coming"
        description="Once a day, Run will name one pattern in your own trading and what it is costing you. It is being built."
      />
    </div>
  );
}
