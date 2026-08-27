'use client';

/* A HEADER POPOVER'S OPEN STATE, AND THE THREE THINGS THAT MAKE IT A DIALOG RATHER THAN A DIV.
 *
 * EXTRACTED FROM `trades-controls.tsx` (2026-08-26) when `/accounts` needed the same control. It was
 * private there, and the alternative was a second copy — which is how one page ends up trapping
 * focus and the other does not, six months after anyone remembers there are two. Every fix below
 * was paid for once already; a copy would have inherited none of them.
 *
 * FOCUS MOVES IN. `run-trading@v2` shipped its popovers without it (its issue #95), so a keyboard
 * user opened a dialog and stayed on the page behind it.
 *
 * AND FOCUS GOES BACK WHERE IT CAME FROM. Moving it in was only half the defect: a dialog that
 * dismisses into nowhere strands the keyboard at the top of the document, so Escape out of Filters
 * left the trader tabbing from the wordmark to reach the control they had just used.
 *
 * THE RESTORE IS GUARDED ON `isConnected`, because the trigger is not always still there — a
 * `Clear` unmounts when the last filter goes — and focusing a detached node silently sends focus to
 * `<body>`, which is the failure being fixed, with an extra step.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* THE AIR LEFT UNDER A CAPPED PANEL, so it reads as ending rather than as running off the screen. */
const EDGE_GAP = 8;

/* `useLayoutEffect` HAS NO MEANING DURING SSR and React warns about it; the server takes `useEffect`,
   which never runs there either. Same isomorphic form `header-slot.tsx` uses, picked once at module
   scope so the hook called below is unconditional. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function usePopover(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /* WHERE FOCUS CAME FROM, so it can go back. */
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      const back = opener.current;
      opener.current = null;
      if (back?.isConnected) back.focus();
    };
  }, [open]);

  /* ─── THE PANEL NEVER RUNS OFF THE BOTTOM OF THE VIEWPORT (2026-08-27) ────────────────────────
   *
   * Luke: "if im zoomed in too far on the browser, and i open the filter menu... then i cant
   * vertically or horizontally scroll to see the clipped sections of the menu."
   *
   * MEASURED, on all three surfaces, at a 1100x420 viewport (a laptop at 150% zoom in a short
   * window): `/trades`, `/accounts` and `/accounts/details` each hung 18px below the fold with
   * NOTHING scrollable - not the panel, not the document. At WCAG's own reflow test size of
   * 320x256 the account detail panel hung 143px below and 24px off the left. The part that goes is
   * the footer, which is where Apply lives.
   *
   * IT IS A REAL FAILURE, NOT A ROUGH EDGE. WCAG 2.2 SC 1.4.10 Reflow requires content to stay
   * usable at 400% zoom without two-direction scrolling, and F102 names exactly this: content
   * clipped by a container with no way to reach it.
   *
   * WHAT THE FIX IS, AND WHY IT IS THIS ONE. The standard answers are Floating UI's `size`
   * middleware (cap the height to the space available), `flip` (move above), `shift` (slide along),
   * or CSS anchor positioning's `position-try-fallbacks`. Anchor positioning is the direction of
   * travel and is roughly 88% supported in mid-2026 - Chrome 125+, Firefox 132+, Safari 18.4+ for
   * the fallback half - which is not yet a floor this product can stand on without writing the JS
   * fallback anyway. Floating UI is a dependency for one behaviour.
   *
   * So: `size`, and only `size`. THE FLIP IS DELIBERATELY NOT BUILT, because every popover in this
   * app hangs off the shell's header band at the top of the viewport - there is never more room
   * above a trigger than below it, so a flip could only ever make things worse. If a popover is
   * ever anchored low on the page, this is where that case goes.
   *
   * THE PANEL SCROLLS ITSELF once capped, which is the half that makes the cap honest: a shorter
   * panel that hides its own footer is the same bug with less of it. Call sites pair this with a
   * flex column whose BODY takes `overflow-y-auto` and whose footer takes `shrink-0`.
   *
   * MEASURED WITH THE CAP CLEARED, or the second open would read back the first open's answer and
   * ratchet the panel smaller every time. */
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = panel.current;
    if (!el) return;
    el.style.maxHeight = '';
    const top = el.getBoundingClientRect().top;
    setMaxHeight(Math.max(120, window.innerHeight - top - EDGE_GAP));
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setMaxHeight(undefined);
      return;
    }
    measure();
    /* RESIZE COVERS THE ZOOM ITSELF: changing zoom fires `resize`, so a panel open while the trader
       zooms re-caps rather than going stale. `scroll` is captured because the band can move under a
       page that scrolls beneath it. */
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen((o) => !o);
  };

  /** Spread onto the panel element. Undefined while closed, so nothing is written at rest. */
  const fit: React.CSSProperties = maxHeight ? { maxHeight } : {};

  return { open, setOpen, toggle, root, panel, fit };
}
