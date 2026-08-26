'use client';

/* THE CLIENT BOUNDARY FOR `/accounts`, and it holds exactly one thing: whether a modal is open.
 *
 * The page stays a Server Component that reads the corpus, because it is the only source of truth
 * for what the trader owns. But the controls that open the add-account modal sit in unrelated
 * subtrees - the header is portalled into the shell's band, the empty-state call to action is inside
 * a card, the dashed row is at the foot of the list - so their common ancestor has to be a client
 * component. This is that ancestor and nothing more: the data arrives already read.
 */

import { AccountModalsProvider, useAddAccount } from './account-modals';
import { AccountsHeader } from './accounts-header';
import { RosterCard } from './roster-card';
import type { RosterAccount } from '@/lib/accounts/read';

export function AccountsView({
  accounts,
  freshness,
}: {
  accounts: RosterAccount[];
  /* A PLAIN OBJECT, NOT A `Map`. `getFreshness` builds a Map because that is the right shape on the
     server, but a Map does not survive the RSC boundary as one - it arrives as `{}`, silently. The
     page converts on the way out and this converts back. */
  freshness: Record<string, string>;
}) {
  return (
    <AccountModalsProvider>
      <AccountsHeader />
      <Roster accounts={accounts} freshness={freshness} />
    </AccountModalsProvider>
  );
}

/* A CHILD, because a component cannot consume a context that it renders the provider for itself -
   the hook would resolve against whatever is ABOVE this component, not the provider inside it. */
function Roster({
  accounts,
  freshness,
}: {
  accounts: RosterAccount[];
  freshness: Record<string, string>;
}) {
  const add = useAddAccount();
  const stamps = new Map<string, Date>(
    Object.entries(freshness).map(([id, iso]) => [id, new Date(iso)])
  );
  return <RosterCard accounts={accounts} freshness={stamps} onAdd={add} />;
}
