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
 * IT STARTS AT THE SERVER'S ANSWER AND CORRECTS BEFORE PAINT, which is the opposite of how it
 * shipped and a bug fixed on 2026-08-28. The first version read `matchMedia` in its initial state,
 * on the reasoning that every caller mounts on a CLICK so there is no server render to mismatch.
 * That stopped being true the moment `/accounts/details` used it: those callers ARE server
 * rendered, and React said so in as many words - "Hydration failed because the server rendered HTML
 * didn't match the client ... A server/client branch `if (typeof window !== 'undefined')`".
 *
 * So `false` is the initial value, matching what the server assumed, and the real answer arrives in
 * a LAYOUT effect. Layout effects and the state they set are flushed synchronously before the
 * browser paints, so there is no frame of the desktop container on a phone - which is what the eager
 * read was protecting and what this keeps. It is the same shape `app-shell.tsx` arrived at for its
 * own breakpoint, and `header-slot.tsx` for its portal host, both after a visible flash.
 *
 * `matchMedia`, not a resize listener: it fires on the CROSSING rather than on every pixel of a
 * drag. The same call `accounts-view.tsx` makes, for the same reason.
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { PHONE_QUERY } from '@/lib/shell';

/* AN OVERRIDE, FOR `/kitchen-sink/demo` AND NOTHING ELSE.
 *
 * The demo walks the REAL add-account flow, and that flow picks its container from this hook - so at
 * the desktop width the demo page runs at, every scene mounted a modal and the phone's screens could
 * not be reviewed at all. Luke asked for them: "we should do the same for the mobile screen".
 *
 * A CONTEXT RATHER THAN A PROP THREADED THROUGH FIVE COMPONENTS, because the thing being overridden
 * is ambient - `AddAccountModal`, `LabelAccountModal`, `ConfirmShell` and `AccountTradesScreen` each
 * read it independently, and a prop would have to reach all four and every future fifth.
 *
 * NOT A FEATURE. Nothing in the app renders this provider; the value is `null` everywhere else, so
 * the query is the answer. If a product surface ever wants to force a container, that is a different
 * decision and should be argued on its own. */
const Forced = createContext<boolean | null>(null);

export function ForcePhone({ value, children }: { value: boolean; children: ReactNode }) {
  return <Forced.Provider value={value}>{children}</Forced.Provider>;
}

/* `useLayoutEffect` has no meaning during SSR and React warns about it, so the server takes
 * `useEffect`, which never runs there either. The standard isomorphic form, picked once at module
 * scope so the hook called below is unconditional. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* `null` UNTIL THE QUERY HAS ACTUALLY BEEN READ, and the tri-state is a bug fix rather than
 * fastidiousness (2026-08-28). `usePhone` answers `false` on the first client render so hydration
 * matches the server - which is correct for anything RENDERING a branch, and wrong for anything
 * ACTING on one. The account trades screen redirects to the details page above `md`; on a phone that
 * effect saw the initial `false` and redirected before the layout effect could correct it, so
 * "View all trades" bounced straight back.
 *
 * So: render off `usePhone()`, act off `usePhoneState()`. A component that navigates, writes or
 * fetches on the answer must wait until there IS one.
 *
 * The same shape `app-shell.tsx` arrived at for its own breakpoint, for its own version of this:
 * "nothing acts on a breakpoint until the breakpoint has actually been read, so there is no wrong
 * first answer to race." */
export function usePhoneState(): boolean | null {
  const forced = useContext(Forced);
  const resolved = usePhoneQuery();
  return forced ?? resolved;
}

export function usePhone(): boolean {
  return usePhoneState() ?? false;
}

function usePhoneQuery(): boolean | null {
  /* `null`, NOT `false`, and never a `matchMedia` read here: see the note at the top of the file. */
  const [phone, setPhone] = useState<boolean | null>(null);

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return phone;
}
