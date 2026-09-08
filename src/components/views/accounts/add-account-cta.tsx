'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddAccountModal } from './add-account-modal';

/* THE ONE CTA UNDER EVERY EMPTY-STATE CARD: it opens the Add account flow in place.
 *
 * The reference's "Connect an account to get started" opens its connect flow as a modal over the
 * faded page rather than navigating away, and that is the right shape here too - a trader who
 * pressed "Import" on Today should not land on Accounts to do it. `AddAccountModal` is the same
 * component the roster's own button opens, so there is one import flow, not one per page.
 *
 * `connected={0}` BECAUSE THIS ONLY RENDERS WHEN NOTHING HAS BEEN IMPORTED. The modal reads the
 * count to decide whether to offer adopting an existing row; on day one there is none. A page that
 * shows this card with a non-empty roster has a bug upstream, not a wrong prop here.
 *
 * A CLIENT ISLAND HOLDING ONE BOOLEAN, so the overlay it sits in can stay a Server Component and be
 * handed the CTA as a rendered node (`CLAUDE.md`: DATA across the boundary, never behaviour).
 */
export function AddAccountCta({ label = 'Import your trades' }: { label?: string }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <Button onClick={() => setAdding(true)}>{label}</Button>
      {adding && <AddAccountModal connected={0} onClose={() => setAdding(false)} />}
    </>
  );
}
