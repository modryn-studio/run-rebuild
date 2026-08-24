'use client';

/* THE ACCOUNT ROW + ITS MENU, at the bottom of the sidebar. Ported from `run-trading@v2`'s
 * `app-shell.tsx` (2026-08-17, S5c), which had it as `AccountMenu`.
 *
 * WHERE THE THEME TOGGLE LIVES NOW. v2 carries exactly one, here, not a second copy in the header
 * band. Verified against Monarch's own account menu (`app.monarch.com/transactions`, its bottom-left
 * row) before porting, since it is the reference this shell already follows: its menu is Dark mode,
 * What's new, Settings, Sign out — the same four rows, the same order, Settings and Sign out as real
 * navigation and the first two as actions. That confirms the shape rather than inventing it.
 *
 * SETTINGS NAVIGATES TO A ROUTE THAT DOES NOT EXIST YET, AND THAT IS THE HOUSE PATTERN RATHER THAN
 * AN OVERSIGHT — but the comment here claimed the opposite and had to be corrected (2026-08-20, S5
 * step 3). It read "`/settings` exists in this build ... so this one navigates". It does not exist:
 * the routes are /accounts, /admin, /trades, /login, /status and the rack. The link is live and
 * 404s, exactly as the sidebar's Today and Read rows do, and `CLAUDE.md` states the reason for that
 * choice — a row 404s rather than pointing at a stub, because "a stub is a screen somebody has to
 * remember to delete". So the BEHAVIOUR stands and the false claim about it does not.
 * Nothing was verified against a real page when that sentence was written, which is the tell: a
 * comment asserting a route exists is a claim, and this file is the only place it was made.
 * BOTH ROWS NOW HAVE A SLICE: `S8b` in `build-plan.md` (added 2026-08-20). Before that they were
 * not "unbuilt", they were UNPLANNED - Today and Read 404 because S8 and S7 are coming for them,
 * and these two had nobody coming. If S8b slips, these rows go inert rather than shipping a link to
 * nothing.
 * "What's new" stays inert: neither build has a changelog surface to open.
 *
 * ROWS ARE ICON + LABEL, ALL THE SAME SHAPE, no rule between them — the divider was doing the job
 * spacing and a shared hover fill already do on their own (v2's own note, holds here too).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import type { SessionUser } from '@/lib/trader';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';

/* `gap-3 px-3`, MATCHING THE NAV ROW (2026-08-20, S5 step 3). This carried `gap-2.5 px-2.5`, a
   third set of numbers in a rail that already had two: a nav row is `h-10 gap-3 px-3`, the trigger
   below was `min-h-11 gap-2 px-2`, and these items were 10px. Three answers to one question, none
   of them wrong on its own and all three visible in the same 224px column.
   The TYPE role stays `text-body` rather than the nav row's `text-nav`: these are menu choices, not
   destinations, and `Menu`'s own items are `text-body` too. Geometry is what has to agree here. */
const ITEM_CLASS =
  'text-body text-text hover:bg-selected flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left transition-colors';

export function AccountMenu({ user }: { user: SessionUser | null }) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      /* ESCAPE RETURNS FOCUS TO THE TRIGGER; A CLICK OUTSIDE DOES NOT. The two dismissals are not
         the same gesture. Escape is "back out of this", so a keyboard user who was tabbing through
         the menu lands back where they started rather than falling out to `document.body` and
         having to Tab from the top of the page again. A click outside is the user already choosing
         to interact with something else — forcing focus back to the trigger there would fight the
         click rather than follow it, which is why `onDown` above deliberately does not. */
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* FROM THE SERVER, NOT FROM `authClient.useSession()`. That hook returns null during SSR and the
   * real user after hydration, so this row rendered "Not signed in" into the HTML and the trader's
   * email a moment later — a hydration mismatch React reports, and a visible flash from an "N"
   * avatar to an "L". The layout resolves it instead, off the same request-cached session the auth
   * gate already fetched, so both renders produce the same string. */
  const email = user?.email ?? null;
  const label = user?.name || email || 'Not signed in';
  /* `referrerPolicy="no-referrer"` is not decoration: Google serves lh3 avatars with a referrer
   * check and returns 403 for some origins without it. */
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = !avatarFailed ? (user?.image ?? null) : null;

  return (
    <div ref={ref} className="relative">
      {/* ALWAYS MOUNTED; `data-open` DRIVES IT (2026-08-20, adopting `modryn-base`'s
         `.menu-panel`). This used to be `{open && (<div role="menu" className="pop-in-up ...">`,
         a keyframe entrance with no exit at all - closing just unmounted the panel mid-frame,
         which is why the section it came from is titled "ENTER ONLY, NO EXIT" and argues that a
         dismissal should feel instant. That argument was covering for what keyframes cannot do:
         they are not interruptible, so an exit needs the panel held mounted through it, an
         `animationend` listener to unmount, and a `pointer-events-none` guard for the render where
         that event never fires. `run-trading@v2` carries exactly that machinery for this component.
         `.menu-panel` is a TRANSITION instead, which the browser can reverse from wherever it
         currently is - reopening mid-close just turns around - and it ends at `display: none` via
         `transition-behavior: allow-discrete`, so closed still means genuinely closed: out of the
         accessibility tree, out of the tab order, unclickable, with no `aria-hidden` to keep in
         sync by hand. See the class's own note in globals.css for the full mechanism.
         BORDER *AND* SHADOW STAYS RUN'S OWN ANSWER, unchanged by this migration: a popover opens
         over whatever is behind its trigger rather than over `bg`, so the ground-change-alone
         argument `Card` makes does not reach it, and the other five popovers in this product agree
         (`design-system.md` §4). */}
      <div
        role="menu"
        data-open={open}
        className="menu-panel border-border bg-surface absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-[var(--radius)] border p-1 shadow-[var(--shadow-card)]"
      >
        {/* EVERY ITEM CLOSES THE MENU, the theme toggle included — it used to flip the theme and
            leave the menu open, which reads as "that did not take". */}
        <button
          role="menuitem"
          onClick={() => {
            toggleTheme();
            setOpen(false);
          }}
          className={ITEM_CLASS}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {/* Inert: no changelog surface exists to open. Kept as a placeholder row for parity with
            the reference rather than dropped, so adding one later is a behaviour change, not a
            layout change. */}
        <button role="menuitem" onClick={() => setOpen(false)} className={ITEM_CLASS}>
          <Icon name="bolt" size={16} />
          What&apos;s new
        </button>
        <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={ITEM_CLASS}>
          <Icon name="settings" size={16} />
          Settings
        </Link>
        <button
          role="menuitem"
          onClick={() =>
            authClient.signOut({
              /* Full navigation, not a router push. `signOut()` only clears the session
                 server-side and invalidates the client-side `useSession()` cache — it does not
                 navigate. Without this, clicking Log out leaves the trader on the same page with
                 a dead session until they refresh or click something that hits the server, which
                 reads as hanging rather than signing out. */
              fetchOptions: { onSuccess: () => window.location.assign('/login') },
            })
          }
          disabled={!email}
          className={cn(ITEM_CLASS, 'text-neg disabled:cursor-not-allowed disabled:opacity-50')}
        >
          <Icon name="sign-out" size={16} />
          Log out
        </button>
      </div>

      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        /* `bg-selected`, THE SAME GROUND A NAV ROW TAKES (2026-08-20). This sat on `hover`, so the
           account row answered the pointer with a different fill than the four rows directly above
           it - one rail, two hover languages. `selected` is the token that means "a row of this rail
           is active or hovered", and this row belongs to the rail. */
        /* EXACTLY A NAV ROW'S BOX (Luke, 2026-08-20): `h-10 gap-3 px-3`, where this was
           `min-h-11 gap-2 px-2 py-2` and rendered 48px against the four rows above it at 40. The
           height came from the avatar rather than from a decision - a 32px disc plus `py-2` is 48,
           which cleared the `min-h-11` floor and set the row's height by accident.
           `min-h-11` (44px) went with it, and that is the one real cost: 44 is the touch-target
           floor and 40 is under it. The four nav rows have always been 40, so the rail was never
           meeting it; making this row alone taller bought a floor for one row out of five and cost
           the rail its rhythm. If 44 matters it is a decision for the whole rail, not for the row
           that happened to inherit it from the boilerplate.
           `transition-colors`, not `transition`: only the ground changes here. The chevron carries
           its own `transition-transform`. */
        className="hover:bg-selected flex h-10 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 transition-colors"
      >
        {/* The provider's avatar when there is one, the initial when there is not. A plain <img>,
            not next/image: the host is lh3.googleusercontent.com, which next/image would need
            whitelisting for, and onError has to fall back when Google rotates or 404s the URL. */}
        {/* A BORDER ON THE AVATAR (Luke, 2026-08-20). The disc keeps the row's own ground, so on
            hover it is the same fill as the row behind it and the mark dissolves into it - a
            same-on-same disc reads as a gap rather than as a face. The hairline is what keeps its
            edge findable in every state without giving it a second, competing fill. */}
        {/* 28px, DOWN FROM 32 (2026-08-20). A 32px disc in a 40px row leaves 4px above and below
            and reads as a mark wedged into its row; 28 leaves 6 and is also the size this product
            already uses for a small disc carrying two or three characters (`InstrumentMark`), so it
            is the system's existing answer rather than a new number. */}
        <span className="bg-selected border-border text-caption text-muted flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            (label[0] ?? '?').toUpperCase()
          )}
        </span>
        <span className="text-body text-text min-w-0 flex-1 truncate text-left">{label}</span>
        {/* Points UP while the menu is up — the panel opens above this row, so the rotation is 180
            rather than the usual -90: the chevron aims at the thing it opened, wherever it goes. */}
        <Icon
          name="chevron"
          size={14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
    </div>
  );
}
