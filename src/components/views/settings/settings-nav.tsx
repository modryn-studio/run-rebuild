'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';

/* THE SETTINGS SUB-NAV, copied from the reference's markup (`app.monarch.com/settings`, read live
 * 2026-09-08 - the DOM, not a screenshot).
 *
 * WHAT THEIRS IS: a 242px white card to the left of the content column, `overflow:hidden`, with
 * `4px 0` inner padding. Two groups, each under an 18px/500 label in plain ink with no caps and no
 * tracking - `Account` (Profile, Display, Notifications, Security, Labs, Integrations) and
 * `Household` (General, Members, Preferences, Institutions, Categories, Merchants, Rules, Tags,
 * Data, Billing...). Rows are 40px tall, `8px 16px` padding, 16px/400, 8px radius. THE ACTIVE ROW
 * CHANGES COLOUR AND NOTHING ELSE: a tinted ground and tinted text, weight unchanged. The sidebar
 * gear links straight to `/settings/profile`; the bare `/settings` shows this nav over an empty
 * content column.
 *
 * WHAT RUN'S IS, and why it is shorter. `spec.md` §4.1 fixes what belongs in Settings - the
 * taxonomy (setups, symbols, tags), the display timezone, and the theme - and a settings row may
 * only exist for a thing that can be set. The taxonomy has no tables yet (auto-tagging is #11,
 * deferred alongside S7), so those rows do not appear: a nav row for a feature with no data model is
 * not "coming soon", it is a promise. They land under `Your data` the day the tables do, and
 * `build-plan.md` §S8b records that. `Your data` rather than `Household` because Run has no
 * household; the group is the same split the reference draws - the person, then their data.
 *
 * `bg-selected` IS THE ACTIVE TREATMENT because it is the shell's own: the sidebar's nav rows use
 * exactly this class for the current page. The reference's teal tint is its accent doing this job;
 * `selected` is Run's, and one product may not have two ways of saying "you are here".
 *
 * NOTIFICATIONS IS `disabled`, NOT ABSENT, following the sidebar gear's own precedent (Luke,
 * 2026-08-20): the reference has the row, the plan has the slice (S9c), and a row that says so beats
 * one that looks live and does nothing. `aria-disabled` on a `<span>`, because a disabled link is
 * not a thing HTML has.
 *
 * ON A PHONE THE NAV IS THE INDEX PAGE. Below `md` it renders only on `/settings` itself, full
 * width; a sub-page shows its content alone and the way back is the browser's. The reference's
 * phone settings is a native screen the browser cannot reach (`CLAUDE.md`: below md, ask Luke for
 * the screenshot), so this is the honest minimum rather than a designed drill-down, and the
 * drill-down is filed as a follow-up in `build-plan.md`.
 */

type Item = { href: string; label: string; disabled?: string };
type Group = { label: string; items: Item[] };

export const SETTINGS_GROUPS: readonly Group[] = [
  {
    label: 'Account',
    items: [
      { href: '/settings/profile', label: 'Profile' },
      { href: '/settings/display', label: 'Display' },
      { href: '/settings/notifications', label: 'Notifications', disabled: 'Coming with notifications (S9c).' },
    ],
  },
  {
    label: 'Your data',
    items: [{ href: '/settings/data', label: 'Data' }],
  },
];

export const SETTINGS_ROOT = '/settings';
/** Where the sidebar gear and the account menu land. The reference's gear goes to `/settings/profile`. */
export const SETTINGS_HOME = '/settings/profile';

// `rounded-sm` IS 8px IN THIS SYSTEM (`--radius-sm`, "a control"), the reference's own row radius
// and the class the sidebar's nav rows already carry. `px-4` is theirs (`8px 16px`), measured.
const ROW = 'text-body flex h-10 items-center rounded-sm px-4 transition-colors';

export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const onRoot = pathname === SETTINGS_ROOT;

  return (
    <nav
      aria-label="Settings"
      className={cn(
        cardSurface,
        'overflow-hidden py-1',
        // The index on a phone; a fixed left column above it.
        onRoot ? 'block' : 'hidden md:block',
        'md:w-60 md:shrink-0',
        className
      )}
    >
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label} className="px-2 py-2">
          <p className="text-h3 px-2 pt-1 pb-2">{group.label}</p>
          <ul>
            {group.items.map((item) => {
              const active = pathname === item.href;
              if (item.disabled) {
                return (
                  <li key={item.href}>
                    <Tooltip label={item.disabled}>
                      <span aria-disabled="true" className={cn(ROW, 'text-muted cursor-not-allowed')}>
                        {item.label}
                      </span>
                    </Tooltip>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(ROW, active ? 'bg-selected text-text' : 'text-text hover:bg-selected')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
