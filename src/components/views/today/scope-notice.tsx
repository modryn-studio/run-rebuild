import Link from 'next/link';
import { Inbox, SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonClasses } from '@/components/ui/button';

/* THE PAGE'S OWN BLANK, said once (#55, option A, 2026-09-08).
 *
 * `allExcluded` and `nothingInScope` are facts about the PAGE'S scope: `monarch-dashboard-teardown.md`
 * §A8 made the account scope page-level on purpose, one control in the band governing every card. So
 * three cards each saying the same sentence was the page speaking through three mouths, and with six
 * cards planned it would have been six. The page renders this in place of the grid and the cards keep
 * only `nothingImported`, which really is about each card's own subject.
 *
 * NEITHER SENTENCE COUNTS OR NAGS (`CLAUDE.md`: no state may represent absence). One names a switch
 * the trader threw and where it lives; the other names a scope and how to widen it. Neither names the
 * app - the cards' old copy began "Run holds no trades", which the house style forbids.
 *
 * A LINK WEARING THE BUTTON'S CLASSES. `Button` deliberately has no `asChild` (its own note says
 * why); `buttonClasses` is the export for a control that is an anchor.
 *
 * A SERVER COMPONENT - nothing here needs a browser - so the rack and the page render the same file.
 */
export type ScopeNoticeKind = 'allExcluded' | 'nothingInScope';

export function ScopeNotice({ kind }: { kind: ScopeNoticeKind }) {
  if (kind === 'allExcluded') {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="Every account is left out of totals"
        description="Turn one back on from Accounts and this page fills in."
        action={
          <Link href="/accounts" className={buttonClasses('secondary')}>
            Go to Accounts
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title="This account has no trades in your record"
      description="Widen the scope to every account, or import this one’s export."
      action={
        <Link href="/today" className={buttonClasses('secondary')}>
          Show every account
        </Link>
      }
    />
  );
}
