'use client';

/* A label for an icon-only control, and the one place a keyboard shortcut gets taught.
 *
 * NOT the native `title` attribute. The browser's own delay is roughly a second, it never fires on
 * keyboard focus, and it cannot be styled - so as a way to teach a shortcut it reaches only the
 * person who was already waiting to find out. A shortcut nobody learns is not a shortcut.
 *
 * Register: `surface` + hairline + `--shadow-card` is what brand.md fixes as "raised", and a
 * tooltip is the most transient raised thing in the app. `--radius-sm`, never a pill. The
 * conventional treatment is white-on-near-black; keeping Run's raised surface is deliberate,
 * because a second "floating panel" look would be a new object in a system that already defines
 * exactly one.
 */

import { useEffect, useRef, useState } from 'react';

export function Tooltip({
  label,
  shortcut,
  align = 'end',
  tapToReveal = false,
  children,
}: {
  label: string;
  /** The key that does the same job, shown quieter than the label. */
  shortcut?: string;
  /** Reveal on tap as well as hover. OFF by default - see the note on the wrapper below. */
  tapToReveal?: boolean;
  /** Which edge of the trigger the label hangs from. `end` keeps it inside a right-edge control. */
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}) {
  const x =
    align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  /* TAP TO OPEN, because hover does not exist on a phone (Luke, 2026-07-30). This was deliberately
   * CSS-only - no state, no portal - and that held right up until a label carried information a
   * touch user actually needs. The Total P&L caveat is exactly that: a trader comparing Run's figure
   * to Tradovate's gross needs to know it is net of fees, and on a phone there was no way to reach
   * the sentence saying so.
   *
   * Hover still drives the pointer case entirely in CSS, so desktop is unchanged; the state only
   * ADDS a second way in. Escape and an outside tap close it - a tooltip pinned open with no way to
   * dismiss is worse than one that never opened. */
  const [tapped, setTapped] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  /* EDGE COLLISION, measured rather than assumed. This file used to say a tooltip that has to flip
   * away from a viewport edge is what earns a positioning library - and then one did: at a 390px
   * phone width the Total P&L caveat is 288px anchored ~113px in, so its right edge landed at 401
   * against a 390 viewport and the last words were clipped (measured 2026-07-30 with the viewport
   * actually emulated, which is how it was found at all).
   *
   * A library is still not the answer for one axis and one direction. Measuring the rendered label
   * and translating it back by exactly the overflow is four lines, needs no dependency, and is
   * self-correcting on resize. It runs on every reveal because the trigger's position changes with
   * the layout, and the label's own width changes with the text. */
  const align_ = align;
  useEffect(() => {
    const fit = () => {
      const el = labelRef.current;
      if (!el) return setShift(0);
      const prev = el.style.transform;
      el.style.transform = '';
      const r = el.getBoundingClientRect();
      el.style.transform = prev;
      const margin = 12;
      const overRight = r.right - (window.innerWidth - margin);
      const overLeft = margin - r.left;
      setShift(overRight > 0 ? -overRight : overLeft > 0 ? overLeft : 0);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [label, align_, tapped]);

  useEffect(() => {
    if (!tapped) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setTapped(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTapped(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [tapped]);

  /* NO WRAPPER BUTTON. The first version of tap-to-reveal wrapped `children` in a <button>, which
   * broke the sidebar immediately: Tooltip there wraps an IconButton, so it produced a button inside
   * a button - invalid HTML, a hydration mismatch, and React regenerating the whole subtree on the
   * client. Caught by Luke's console, 2026-07-30.
   *
   * The handler belongs on the wrapper SPAN instead, where it can never nest. It is also opt-in:
   * most tooltips wrap a control that already does something on click (the sidebar toggle), and
   * binding a reveal to that click would pin a hint open every time the control was used. Only a
   * tooltip whose trigger does nothing else - the Total P&L caveat, hanging off an inert icon -
   * wants tap, and that call site passes `tapToReveal` and supplies its own focusable trigger. */
  return (
    /* A NAMED GROUP, and it is a correctness fix rather than a tidy-up. `group` / `group-hover:`
       matches ANY ancestor carrying `group`, so the first time a tooltip was nested inside something
       that already had one - a tape row, whose whole surface is a `group` button so the chevron can
       light with it - hovering anywhere on that row revealed the tooltip. A tooltip should answer to
       its own trigger and nothing else. Every existing call site is unaffected: they were relying on
       this wrapper being the nearest group, which naming only makes explicit. */
    <span
      ref={ref}
      className="group/tooltip relative inline-flex"
      onClick={tapToReveal ? () => setTapped((t) => !t) : undefined}
    >
      {children}
      {/* The delay is on the SHOW only. An instant tooltip fires every time the pointer crosses the
          control on its way somewhere else, which is noise; an instant hide is what you want the
          moment you leave.
          `focus-visible`, not `focus-within`: a button keeps focus after a mouse click, so
          focus-within would park the label over the page every time the control was used. */}
      <span
        aria-hidden
        ref={labelRef}
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        /* `w-max` IS THE FIX FOR THE NARROW WRAP (Luke, 2026-07-30), and the cause is worth naming
           because a max-width alone looks like it should have solved it. An absolutely positioned box
           sizes shrink-to-fit against its CONTAINING BLOCK, which here is the 14px trigger - so the
           available width was 14px and the label wrapped to near-min-content, stacking "Net of /
           commissions / and fees," down the page in a column barely wider than the icon. `w-max`
           sizes to max-content instead, and the cap below is then what actually limits it.

           The cap itself is a mobile bug fix and stays: an absolutely positioned child extends the
           SCROLLABLE OVERFLOW of its pane even at opacity-0, so an uncapped label was making the
           page scroll sideways at 390px. 18rem holds this caveat on two comfortable lines.

           This does NOT make the tooltip edge-aware, and is not meant to. A label anchored close to
           the right edge can still overhang; that remains the case that earns a positioning
           library. */
        className={`border-border bg-surface text-small text-text pointer-events-none absolute top-full z-50 mt-1.5 flex w-max max-w-72 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 leading-snug shadow-[var(--shadow-card)] transition-opacity group-hover/tooltip:opacity-100 group-hover/tooltip:delay-500 group-has-[:focus-visible]/tooltip:opacity-100 ${x} ${tapped ? 'opacity-100' : 'opacity-0'}`}
      >
        {label}
        {shortcut ? <span className="text-faint">{shortcut}</span> : null}
      </span>
    </span>
  );
}
