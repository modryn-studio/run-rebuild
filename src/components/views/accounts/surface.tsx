'use client';

/* WHICH CONTAINER A SCREEN IS SITTING IN, and whether it is the one on top.
 *
 * ─── WHY THE SCREENS DO NOT KNOW ─────────────────────────────────────────────────────────────────
 *
 * `/accounts` has three flows (add, import, edit) and two confirmations, and below 768px every one
 * of them is a full-screen sheet rather than a centred card (2026-08-28, Luke: "basically no modals
 * on mobile is the rule"). The screens themselves are identical in both containers - same questions,
 * same order, same copy - so duplicating them per surface would be five files that must be edited in
 * pairs forever, which is exactly how `FilterSheet` and `FiltersPopover` are ALLOWED to differ and
 * these are not: those two are different controls for one filter, these are one flow in two frames.
 *
 * So the screens render what they always rendered, and this decides where the CHROME goes.
 *
 * ─── THE HEADER IS THE ONLY THING THAT MOVES ─────────────────────────────────────────────────────
 *
 * In a modal the header is the card's first row and travels with it. In a sheet it must NOT travel:
 * the whole point of the drill-in (`filter-sheet.tsx`, and Luke again here: "the header changes and
 * the new page emerges/animated from the bottom") is that the header swaps on the frame of the tap
 * while only the body slides. A header rendered inside the sliding layer would slide with it.
 *
 * A PORTAL, for the reason `header-slot.tsx` gives: context would mean the sheet holding screen-owned
 * React nodes in state, and a JSX child is a new object every render, so the effect that registered
 * them would re-register forever. A portal keeps the header in the SCREEN's tree, where its handlers
 * already live, and only relocates where it paints.
 *
 * `active` IS WHAT STOPS TWO HEADERS LANDING IN ONE SLOT. Every layer of a sheet stays mounted while
 * it slides away, so during a back press two screens exist at once. Only the one the sheet considers
 * current renders its header, which is also what makes the swap happen on the right frame: the
 * header is the new screen's the instant Back is pressed, and the old body is still travelling.
 */

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* BEFORE THE PAINT, NOT AFTER IT. Same alias and same reason as `header-slot.tsx`: a header found in
 * a passive effect arrives one frame late, and this one carries 64px of height at the top of a panel
 * that is sliding at the same moment. `useLayoutEffect` has no meaning during SSR and React warns
 * about it, so the server takes `useEffect`, which never runs there either. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type SurfaceMode = 'modal' | 'sheet';

type Surface = {
  mode: SurfaceMode;
  /** The id of the sheet's header host. Null in a modal, where the header renders in place. */
  headerHost: string | null;
  /** Whether this screen is the one on top. A modal only ever renders one, so it defaults true. */
  active: boolean;
};

const SurfaceContext = createContext<Surface>({ mode: 'modal', headerHost: null, active: true });

export function useSurface() {
  return useContext(SurfaceContext);
}

/** Wraps one layer of a sheet. `AccountSheet` renders it; nothing else should. */
export function SurfaceProvider({
  mode,
  headerHost,
  active,
  children,
}: Surface & { children: ReactNode }) {
  return (
    <SurfaceContext.Provider value={{ mode, headerHost, active }}>{children}</SurfaceContext.Provider>
  );
}

/* Puts a screen's header where its container wants it: in place for a modal, in the sheet's fixed
 * bar for a sheet, and nowhere at all when the screen is not the one on top.
 *
 * The host does not exist on the first client render — it is a sibling rendered by the sheet — so
 * this resolves it in a layout effect and re-renders before paint, which is the shape `HeaderSlot`
 * arrived at after a visible flash. */
export function SurfaceHeader({ children }: { children: ReactNode }) {
  const { mode, headerHost, active } = useSurface();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (mode !== 'sheet' || !headerHost) return;
    setHost(document.getElementById(headerHost));
  }, [mode, headerHost]);

  if (mode === 'modal') return <>{children}</>;
  if (!active || !host) return null;
  return createPortal(children, host);
}
