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
 * SETTINGS IS REAL HERE, WHICH IS ONE DEPARTURE FROM v2's OWN CURRENT STATE. v2's row is inert
 * ("no destination yet, just the row") because no settings page exists there yet. `/settings`
 * exists in this build, and Monarch's own equivalent row is a live link — so this one navigates.
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

const ITEM_CLASS =
  'text-body text-text hover:bg-hover flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-left transition';

export function AccountMenu({ user }: { user: SessionUser | null }) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
      {open && (
        <div
          role="menu"
          className="pop-in-up border-border bg-surface absolute bottom-full left-0 z-50 mb-2 w-full overflow-hidden rounded-[var(--radius)] border p-1 shadow-[var(--shadow-card)]"
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
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="hover:bg-hover flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 transition"
      >
        {/* The provider's avatar when there is one, the initial when there is not. A plain <img>,
            not next/image: the host is lh3.googleusercontent.com, which next/image would need
            whitelisting for, and onError has to fall back when Google rotates or 404s the URL. */}
        <span className="bg-surface-2 text-caption text-muted flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
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
