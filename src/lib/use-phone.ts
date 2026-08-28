'use client';

/* IS THIS A PHONE, reactively — the one hook that decides modal or sheet.
 *
 * A HOOK RATHER THAN `md:hidden` ON TWO COPIES, and that is the difference between this and the way
 * `/trades` forks. `trades-controls.tsx` mounts BOTH `FiltersPopover` and `FilterSheet` and lets CSS
 * pick, which is right there because the two are separate components holding separate drafts of the
 * same filter. The /accounts flows are one state machine that POSTS: two mounted copies would each
 * hold their own staged files and their own `savingRef`, and a resize mid-flow would swap a trader
 * onto an empty one. One machine, one container, chosen here.
 *
 * IT READS THE QUERY ON FIRST RENDER rather than starting false and correcting in an effect. Every
 * caller mounts on a CLICK, so there is no server render to mismatch — and starting false would
 * paint one frame of a centred modal on a phone before flipping.
 *
 * `matchMedia`, not a resize listener: it fires on the CROSSING rather than on every pixel of a
 * drag. The same call `accounts-view.tsx` makes, for the same reason.
 */

import { useEffect, useState } from 'react';
import { PHONE_QUERY } from '@/lib/shell';

export function usePhone(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return phone;
}
