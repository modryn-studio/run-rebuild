import type { Metadata } from 'next';
import { requireTrader } from '@/lib/trader';
import { PAGE_COLUMN } from '@/lib/shell';
import { cn } from '@/lib/cn';

/* ACCOUNTS — CLEARED TO AN EMPTY SHELL (Luke, 2026-08-20: "delete what is on the main content.
 * im starting from scratch on this page").
 *
 * WHAT WAS HERE. `accounts-view.tsx`, the roster `S4e` built as the minimum that made the intake
 * testable, plus the server query behind it. Both are deleted rather than commented out — the whole
 * point of starting from scratch is not to negotiate with the previous attempt, and the code is one
 * `git show` away if a decision in it turns out to be worth recovering.
 *
 * `S6` in `build-plan.md` is what fills this: hero metric selector, groups by state with their own
 * totals, a freshness stamp on every row, `CLOSED` as a permanent group, summary rail. That slice
 * always said it replaces this page wholesale; this just does the deleting first.
 *
 * ⚠️ THE IMPORT LAUNCHER WENT WITH IT, AND NOTHING ELSE OFFERS ONE. `AddAccountModal` was mounted
 * here and only here in the shipped app, so there is currently no route from the product into the
 * three-file ingest. The flow itself is intact and unchanged — the modal, the drop zone, the
 * preflight, the write path, all of `S4e` — and `/kitchen-sink/demo` still mounts the real modal
 * under `dryRun` so it can be judged on a device. What is missing is a door in the product, and
 * `S6` builds it: per `build-plan.md`, launching an import from a specific account's own page is
 * the context v2's adoption path depends on, which is the reason "Add manually" was deferred to
 * that slice in the first place.
 *
 * THE ROUTE STAYS RATHER THAN 404-ING. `Accounts` is one of the four NAV rows and the sidebar links
 * to it; a destination that exists and is empty is a different statement from one that is missing,
 * and this one is being rebuilt rather than not yet started.
 */
export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage() {
  // The gate stays. This is a signed-in surface whatever gets built on it, and losing the guard
  // while the page is empty is how it comes back without one.
  await requireTrader();

  return <div className={cn(PAGE_COLUMN, 'pb-8')} />;
}
