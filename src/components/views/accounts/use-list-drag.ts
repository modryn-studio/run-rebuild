/* DRAG A VERTICAL LIST INTO A NEW ORDER. One implementation, used at both levels of the roster:
 * the group cards among themselves, and the account rows inside each card.
 *
 * Extracted from roster-card.tsx 2026-08-04, when the second level arrived. Every line of the
 * mechanic below was already written and working for the cards - copying it into the rows would
 * have been the third attempt at the same physics, and the two would have drifted the first time
 * either was touched.
 *
 * THE MECHANIC (inspected live on the reference, which runs react-beautiful-dnd). The decisive
 * detail is what rbd leaves on items AT REST: nothing. No transform, static. Every bit of movement
 * is inline style applied during the gesture, and THE LIST ORDER ONLY CHANGES WHEN THE DROP
 * COMMITS. Reordering mid-drag moves the held item's own layout slot out from under it, so the
 * offset has to be re-based on every swap - which is the jump Luke kept seeing. The fix is not a
 * better re-base, it is to never move it.
 *
 *   the held item   follows the pointer on BOTH axes, transform only, no transition
 *   the others      slide by the held item's height to open a gap, WITH a transition
 *   the array       is untouched
 *
 * On release the held item animates into the gap, and only then does the order commit, with every
 * transform cleared in the same render. The snap is invisible because the painted positions already
 * equal the new layout. That last trick is rbd's, and it is why theirs looks seamless.
 *
 * OUT OF BOUNDS GOES HOME (Luke, 2026-08-04: "if user tries to drop it somewhere it doesnt
 * belong, it just goes back to where it was"). The held item may be dragged anywhere on screen -
 * that freedom is the point - but the list it came from has an extent, and once the item has
 * stopped overlapping it the target slot reverts to the one it started in. Dropping then animates
 * it home rather than committing, because the landing distance for from === to is zero.
 *
 * Half the item's height of tolerance, which is the plain reading of "does it still overlap": the
 * item may hang half of itself off either end and still count. Beyond that it is over something
 * else, and the answer to "which slot in THIS list" is honestly none.
 *
 * VERTICAL ONLY. Sideways movement is expressive and must not cancel anything - the reference lets
 * you swing a row right across the page while the gap stays open where it came from. And it does
 * not need to cancel: nothing horizontal changes the slot, so a purely sideways drag already ends
 * at from === to and already animates home.
 *
 * MOUSE ONLY, at both levels. HTML5 drag-and-drop does not fire on touch, and reimplementing the
 * physics with a long-press timer, touch tracking and scroll-lock is exactly the trap of copying a
 * native app on the web. The reference agrees, and says so in CSS: their rows carry
 * `touch-action: manipulation`, which is the declaration that a touch there is a tap or a scroll,
 * never a drag. Reordering is a desk task; a phone reads the roster.
 */
import { useEffect, useRef, useState } from 'react';

/* rbd's own durations, on Run's curve rather than theirs - the mechanic is borrowed, the motion
   language stays ours. The literal here IS `--ease-out`; it is spelled out because these values go
   into inline `transition` strings, and a `var()` in an inline style resolves against the element
   rather than against the stylesheet's cascade root, which is a different (and empty) answer if the
   token ever moves. `design-system.md`: ease-out is the curve for a thing entering or leaving a
   position, which is exactly what a slid row and a dropped card are doing. */
export const SHIFT_MS = 200;
export const DROP_MS = 240;
export const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/* PORTED FROM `run-trading@v2` VERBATIM (2026-08-26), physics and reasoning intact, because every
   paragraph above is a bug that was found by hand once already: the mid-drag re-base jump, the
   captured chevron, the stale drop closure, the click that navigated after a reorder. Re-deriving
   any of it would be the third attempt at the same mechanic.
   REDUCED MOTION IS NOT HANDLED HERE and does not need to be: a drag is a DIRECT MANIPULATION - the
   item is following the pointer, which is not decorative motion, and freezing it would break the
   gesture rather than calm it. The `prefers-reduced-motion` block in `globals.css` governs the
   page's entrances; this is the user's own hand. */

interface Options {
  /** The items in their current painted order, top to bottom. */
  keys: string[];
  /** The data attribute marking a draggable item inside the container, e.g. 'group' -> [data-group]. */
  attr: string;
  /** Gap between items in px. Cards sit in a `gap-4` stack; rows are flush under a divider. */
  gap: number;
  /** False when there is nothing to trade places with, or on a surface that should not offer this. */
  enabled: boolean;
  onCommit: (keys: string[]) => void;
  /* THE CONTAINER'S REF IS THE CALLER'S, handed in rather than created here and returned. Not a
     preference: a hook that returns a ref inside an object taints that whole object for
     react-hooks/refs, so every `styleFor`/`isHeld` read in the caller's JSX is reported as
     accessing a ref during render. Owning it at the call site is what the rule wants and it is
     where `ref={...}` is written anyway. */
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function useListDrag({ keys, attr, gap, enabled, onCommit, listRef: list }: Options) {
  const [drag, setDrag] = useState<{
    key: string;
    from: number;
    to: number;
    dx: number;
    dy: number;
    dropping: boolean;
    /* How far the others have to slide to open a gap: the held item's height plus the list gap.
       IN STATE, not read off the rects ref at render time - a ref is not a render input, and
       reaching into one from `styleFor` is both a lint error and the real bug it warns about
       (nothing re-renders when it changes). Captured once, when the drag begins. */
    size: number;
  } | null>(null);

  const grab = useRef<{
    key: string;
    from: number;
    startX: number;
    startY: number;
    moved: boolean;
    /* The slot it would land in right now. Mirrored onto the ref rather than read back out of
       `drag` state at drop time: the pointerup handler closes over whatever render attached it, and
       a stale closure there means the drop silently commits nothing. The ref is always current. */
    to: number;
    /** Every item's resting rect, measured once. Nothing moves in layout during the drag. */
    rects: { key: string; top: number; height: number }[];
    /** The list's own vertical extent, for the bounds test above. */
    listTop: number;
    listBottom: number;
  } | null>(null);

  /* ESCAPE PUTS IT BACK. Found in the postcheck: once a card was in your hand there was no way out
     of the gesture - releasing it always committed somewhere, so changing your mind meant dropping
     it and dragging it back. Clearing the grab ref is what does the work: the pointerup that
     follows finds nothing to commit and falls through to clearing the visual state. rbd binds the
     same key, and it is the one thing a drag needs that a click does not. */
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      grab.current = null;
      setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const onGrab = (e: React.PointerEvent) => {
    if (!enabled || e.pointerType !== 'mouse' || keys.length < 2 || drag) return;
    /* A PRESS THAT LANDS ON A CONTROL BELONGS TO THAT CONTROL, NOT TO THE GRAB (Luke, 2026-08-03:
       "why doesn't the collapse arrow work anymore?" - and his guess was right, the drag did it).
       `setPointerCapture` below retargets every later pointer event to the handle, so the chevron
       never sees its own pointerup and the browser fires the click on the handle instead of on the
       button. The handler was intact; the event stopped arriving.
       Checked here rather than by stopping propagation on the button, because the button should not
       have to know a drag exists - this is the grab deciding what is not a grab. */
    if ((e.target as HTMLElement).closest('button')) return;

    /* WHICH ITEM THIS IS, read off the DOM rather than curried in. Not a style preference: a
       handler built per key has to be CALLED during render to bind it, and a call into this hook
       from render is what react-hooks/refs rejects (rightly - everything below touches refs). One
       static handler that asks the DOM which item it landed on has neither problem, and it also
       covers the case where the handle is not the item: a group card's grip is its HEADER, and
       `closest` walks up to the card that carries the attribute. */
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>(`[data-${attr}]`);
    const key = el?.dataset[attr];
    if (!key) return;

    const rects: { key: string; top: number; height: number }[] = [];
    /* `:scope >` so a nested list is not swallowed by its parent's query. The group cards and the
       rows inside them are both marked, and without the child combinator the outer list would
       measure every row in the roster as though it were a card. */
    list.current?.querySelectorAll<HTMLElement>(`:scope > [data-${attr}]`).forEach((el) => {
      const r = el.getBoundingClientRect();
      rects.push({ key: el.dataset[attr]!, top: r.top, height: r.height });
    });
    const from = keys.indexOf(key);
    if (from < 0 || rects.length !== keys.length) return; // the DOM and the model disagree; do nothing

    // Measured from the ITEMS, not from the container: the container can be taller than its
    // children (padding, a footer flap), and the droppable region is where the items actually are.
    const listTop = Math.min(...rects.map((r) => r.top));
    const listBottom = Math.max(...rects.map((r) => r.top + r.height));

    grab.current = { key, from, startX: e.clientX, startY: e.clientY, moved: false, to: from, rects, listTop, listBottom };
    /* Capture keeps the move stream coming once the cursor leaves the handle, which is most of a
       drag. It throws for a pointer id the browser is not tracking, and a failure must not take
       the grab down with it. */
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // See above.
    }
  };

  const onDragMove = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    // Below the threshold this is still a click, and the item must not twitch.
    if (!g.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    g.moved = true;

    /* WHICH SLOT IT WOULD LAND IN. Every rect here is a RESTING one - nothing has moved in layout -
       so the held item's projected centre compares against them directly, with no correction for
       what has already shifted. That is the whole benefit of not reordering. */
    const me = g.rects[g.from];
    const centre = me.top + dy + me.height / 2;
    let to = g.from;
    const tol = me.height / 2;
    if (centre >= g.listTop - tol && centre <= g.listBottom + tol) {
      g.rects.forEach((r, i) => {
        if (i === g.from) return;
        const mid = r.top + r.height / 2;
        if (i < g.from && centre < mid) to = Math.min(to, i);
        if (i > g.from && centre > mid) to = Math.max(to, i);
      });
    }
    // else: dragged clear of its own list, so the slot stays home and the gap closes behind it.

    g.to = to;
    setDrag({ key: g.key, from: g.from, to, dx, dy, dropping: false, size: me.height + gap });
  };

  const onDrop = (e: React.PointerEvent) => {
    const g = grab.current;
    grab.current = null;
    try {
      if (g) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Mirror of the capture guard.
    }
    if (!g || !g.moved) return setDrag(null);

    /* A DRAG THAT ENDS ON A LINK STILL FIRES A CLICK, and the account rows ARE links - without this
       every reorder would navigate to the account you just dropped. Killed once, at the capture
       phase, so nothing downstream ever sees it; the timeout takes the listener back off when the
       drag ended somewhere that produces no click at all. */
    const killClick = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    document.addEventListener('click', killClick, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener('click', killClick, true), 0);

    const { from, to } = g;
    /* THE LANDING. How far the held item must travel to sit in the gap the others opened: the
       summed heights of everything it passed. Animating to exactly that is what makes the commit
       invisible - when the order finally changes, the item is already painted where the new layout
       puts it. */
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    let span = 0;
    for (let i = lo; i <= hi; i++) if (i !== from) span += g.rects[i].height + gap;
    const landing = from === to ? 0 : from < to ? span : -span;

    setDrag((d) => (d ? { ...d, dx: 0, dy: landing, dropping: true } : null));
    window.setTimeout(() => {
      if (from !== to) {
        const next = [...keys];
        next.splice(to, 0, ...next.splice(from, 1));
        onCommit(next);
      }
      setDrag(null);
    }, DROP_MS);
  };

  /* What an item is wearing right now. The held one tracks the pointer with NO transition; everyone
     between it and its target slides by its height WITH one. */
  const styleFor = (key: string, i: number): React.CSSProperties | undefined => {
    if (!drag) return undefined;
    if (key === drag.key) {
      return {
        transform: `translate(${drag.dx}px, ${drag.dy}px)`,
        transition: drag.dropping ? `transform ${DROP_MS}ms ${EASE}` : 'none',
        zIndex: 10,
        position: 'relative',
      };
    }
    let shift = 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -drag.size;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) shift = drag.size;
    return {
      transform: shift ? `translateY(${shift}px)` : undefined,
      transition: `transform ${SHIFT_MS}ms ${EASE}`,
    };
  };

  return {
    /** True from the moment an item is lifted until the drop animation ends. The caller uses it to
        stop clipping the item that is in the air - see the Card in roster-card.tsx. */
    dragging: drag !== null,
    styleFor,
    /** True only while the pointer is actually holding this item (not during the drop animation). */
    isHeld: (key: string) => drag?.key === key && !drag.dropping,
    /** Spread onto the handle: the whole item, or just its header. Empty when there is nothing to
        reorder, which is also what the caller reads to decide whether to show a grab cursor. */
    handlers: enabled
      ? {
          onPointerDown: onGrab,
          onPointerMove: onDragMove,
          onPointerUp: onDrop,
          onPointerCancel: onDrop,
        }
      : {},
  };
}
