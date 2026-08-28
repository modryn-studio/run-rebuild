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

export function usePhone(): boolean {
  const forced = useContext(Forced);
  /* FALSE, WHICH IS WHAT THE SERVER RENDERED. Never a `matchMedia` read: see the note above. */
  const [phone, setPhone] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* THE OVERRIDE WINS, AND IT IS READ AFTER THE HOOKS ABOVE HAVE RUN. Returning early on it would
     make the hook order depend on whether a provider is present, which React forbids and which would
     break the moment the demo mounted a scene inside one. */
  return forced ?? phone;
}
