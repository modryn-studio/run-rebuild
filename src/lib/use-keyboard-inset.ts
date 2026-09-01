'use client';

/* HOW MUCH OF THE PAGE THE ON-SCREEN KEYBOARD IS COVERING, as a CSS variable.
 *
 * ─── THE BUG THIS EXISTS FOR (2026-09-01) ──────────────────────────────────────────────────────
 *
 * Luke, on a phone: *"on the login page, im not able to scroll when my phone's keyboard is open.
 * i think its a problem with the page. there is no scrolling on that page i dont believe."* He read
 * it exactly right, and `layout.tsx`'s own viewport export had already flagged this as the risk it
 * was taking:
 *
 *   > `overlays-content` leaves the layout viewport alone [...] The one thing to watch is A FIELD
 *   > LOW ON THE SCREEN BEING COVERED - not a risk for the surface that prompted this, since the
 *   > phone's search row sits in the header band at the very top.
 *
 * `/login` is that unwatched surface. Its card is vertically centred in a `min-h-dvh` column, so
 * with the keyboard drawn OVER the page rather than resizing it, the document has zero scrollable
 * overflow. A browser scrolls a focused field into view by scrolling the document; when there is
 * nothing to scroll, there is nowhere to put it, and the email field and its button sit under the
 * keyboard with no way to reach them.
 *
 * ─── WHY NOT JUST FLIP THE VIEWPORT KEY ────────────────────────────────────────────────────────
 *
 * `/login` DOES flip it - see its own `viewport` export, which sets `resizes-content` for that route
 * only, so the layout viewport (and therefore `dvh`) shrinks with the keyboard and the page becomes
 * scrollable for free. That is the whole fix on Chrome 108+ and Firefox 132+.
 *
 * **WebKit does not implement `interactive-widget` at all**, so on an iPhone that export is inert
 * and the page is exactly as stuck as before. This hook is the part that works there.
 *
 * ─── WHAT IT MEASURES, AND WHY IT IS SELF-DISABLING ────────────────────────────────────────────
 *
 * The visual viewport is what you can see; the layout viewport is what the page is laid out in. A
 * keyboard always shrinks the first. Whether it shrinks the second is the thing `interactive-widget`
 * controls. So the overlap is the difference between them:
 *
 *     overlap = window.innerHeight - visualViewport.height - visualViewport.offsetTop
 *
 * On a browser honouring `resizes-content` the two heights already agree, the overlap computes to
 * ~0, and this adds nothing - so the CSS fix and the JS fix cannot double up. On iOS the layout
 * viewport never moves, the overlap IS the keyboard, and the padding it produces is what gives the
 * document something to scroll.
 *
 * `offsetTop` IS IN THE SUM DELIBERATELY. iOS pans the visual viewport up to keep a focused field
 * above the keyboard; without subtracting that offset the padding grows by however far it panned,
 * and the page gains height on every pan.
 *
 * ─── WHY A VARIABLE ON `<html>` RATHER THAN REACT STATE ────────────────────────────────────────
 *
 * `visualViewport` fires `resize` and `scroll` continuously while the keyboard animates in - dozens
 * of events over ~250ms. Routing that through `setState` re-renders the whole login screen on every
 * frame of an animation nobody asked React to drive. A custom property is a style write the browser
 * already batches, and `.keyboard-inset` in globals.css is the only consumer.
 *
 * IT CLEARS ON UNMOUNT, because the property lives on `<html>` and outlives the component. A stale
 * inset left behind after navigating away is a phantom gap at the foot of the next screen.
 */

import { useEffect } from 'react';

/** The property `.keyboard-inset` reads. Declared here because this hook is what writes it. */
const PROP = '--keyboard-inset';

export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    /* NO FALLBACK PATH, and that is a decision rather than an omission. `visualViewport` is the only
       way to learn a keyboard's height from the web platform; a browser without it (none current)
       simply gets the behaviour it had before this hook existed, which is the desktop behaviour and
       is correct there. */
    if (!vv) return;

    const root = document.documentElement;
    const apply = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      /* ROUNDED, because iOS reports fractional heights and a property that changes by 0.5px on
         every pan is a style invalidation for nothing. Clamped at 0 so a visual viewport reported
         TALLER than the layout one - which happens mid-rotation - cannot pull the page upward. */
      root.style.setProperty(PROP, `${Math.max(0, Math.round(overlap))}px`);
    };

    apply();
    vv.addEventListener('resize', apply);
    /* `scroll` TOO, NOT JUST `resize`. iOS pans the visual viewport without resizing it, so a field
       focused after the keyboard is already up fires only this one. */
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty(PROP);
    };
  }, []);
}
