'use client';

/* WHICH ACCOUNT, ON A PHONE - the header's own control, and a full-screen sheet behind it.
 *
 * ─── WHY THE DESKTOP'S MENU DOES NOT COME DOWN HERE ────────────────────────────────────────────
 *
 * 2026-09-03, Luke: *"i realize we have our account picker. but that doesn't work in the header. i
 * dont want it like that. we need to copy the same way we do everything else in the header. look at
 * the accounts and trades pages for mobile. we use icons."* He is right and the rule is already
 * written: `design-system.md` §6a - **no modals on a phone, and below `PHONE_QUERY` every
 * dismissible surface is a full-screen sheet.** A 150px `Menu` trigger reading "All accounts" in a
 * 375px band is a desktop control wearing a phone's clothes; it crowds a bar whose other three
 * items are 22px marks, and its popover opens over the card it is about.
 *
 * SO THE BAND GETS A MARK AND THE MARK OPENS A SHEET, which is what `/trades` and `/accounts` both
 * already do with theirs.
 *
 * ─── THE ICON IS `filter`, AND IT IS THE APP'S OWN WORD FOR THIS ───────────────────────────────
 *
 * `DrawnFilter`, from `ui/icon.tsx` - a custom mark, already in the set, already racked. It is what
 * `/trades` puts its filter sheet behind, and this product has one meaning for it: **narrow what
 * this screen is showing.** An account scope IS a narrowing, so reusing the glyph is the consistent
 * answer rather than a convenient one.
 *
 * TWO ALTERNATIVES WERE WEIGHED AND TURNED DOWN. `accounts` (DrawnStack, the layers glyph) is
 * semantically exact - but it is the Accounts NAV icon, and using it as a control would make this
 * the one place in the app where a nav glyph means something other than navigation. `more` (the
 * three dots) is what the phone's account bar uses and what the reference puts on its widgets, and
 * it is honest but vague: it says *something is here* rather than what.
 *
 * ─── IT IS `AccountSheet`, NOT A NEW SHELL ─────────────────────────────────────────────────────
 *
 * The layered phone sheet built for `/accounts` takes `open`, `onClose`, `onBack`, `label` and
 * `layers`, and it already solves the two things a new one would get wrong: the device Back button
 * (`useOverlayBack`, one history entry per level, innermost consumed first) and the per-mode
 * grounds. One layer here, because one question is being asked.
 *
 * ITS FILE LIVES IN `views/accounts/` AND THAT IS NOW THE WRONG ADDRESS - it serves two surfaces.
 * Left alone deliberately: moving it is a rename across a dozen imports in a slice that is about
 * `/today`, and a move with no behaviour change is the kind of diff that hides one.
 *
 * ─── AND IT WRITES THE SAME PARAM THE DESKTOP DOES ─────────────────────────────────────────────
 *
 * `?accounts=<uuid>`, through the same `usePathname`-held writer `AccountSelect` uses, so a scope
 * set on a phone survives a rotation into the desktop layout and vice versa. There is no second
 * piece of state: the sheet reads the URL and writes the URL.
 */

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, ICON_TOUCH } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { AccountSheet, useSheet } from '@/components/views/accounts/account-sheet';
import { ModalHeader } from '@/components/views/accounts/shared';
import { cn } from '@/lib/cn';
import type { FacetAccount } from '@/lib/trades/read';

/** The sentinel for "not narrowed". Never written to the URL - picking it DELETES the param, which
 *  is what keeps a cleared filter out of an address a trader might read. Same value `AccountSelect`
 *  uses, and deliberately the same word, because they are one control at two widths. */
const ALL = 'all';

const label = (a: FacetAccount) => `${a.firm} ${a.short}`.trim();

export function ScopeSheetTrigger({
  accounts,
  selected,
}: {
  accounts: FacetAccount[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);

  /* NOTHING TO SCOPE, NOTHING TO PRESS. `AccountSelect` renders at one account because there it is
     a LABEL naming which account you are looking at, and a label is worth a band slot on a desktop.
     A mark is not a label: an icon that opens a sheet listing one row, already ticked, is a control
     that cannot do anything. `ColumnsMenu`'s rule - absent, not empty. */
  if (accounts.length < 2) return null;

  return (
    <>
      {/* `md:hidden`, THE SHELL'S OWN PHONE BOUNDARY, and it pairs with `max-md:hidden` on the
          desktop `AccountSelect` so exactly one of the two is in the document at any width. Two
          controls writing one param would be two places to fix a bug in. */}
      <IconButton
        aria-label="Which account"
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        {/* `ICON_TOUCH` (22px) - the mark size for anything aimed at with a thumb, which is every
            control in this bar. Named step, not a literal. */}
        <Icon name="filter" size={ICON_TOUCH} />
      </IconButton>

      {open && (
        <ScopeSheet
          accounts={accounts}
          selected={selected}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ScopeSheet({
  accounts,
  selected,
  onClose,
}: {
  accounts: FacetAccount[];
  selected: string[];
  onClose: () => void;
}) {
  /* `useSheet` OWNS THE EXIT, so the panel travels down before the parent unmounts it. Unmounting
     on the tap would make the sheet vanish rather than leave. */
  const sheet = useSheet(onClose);
  const router = useRouter();

  /* ─── THE MARKER, AND THIS SHEET SHIPPED WITHOUT IT FOR ONE TEST (2026-09-03) ────────────────
   *
   * Picking an account wrote nothing. The URL came back `""`, the sheet closed, and the card did
   * not narrow - and the cause is a rule this codebase already owns:
   *
   *   `CLAUDE.md`: "An overlay that COMMITS a navigation calls `useOverlayBack`'s returned marker,
   *   or its cleanup's `history.back()` reverts the write: inside one React commit every effect
   *   cleanup runs before anything else."
   *
   * So `router.push('?accounts=...')` landed, then the sheet's own `useOverlayBack` cleanup popped
   * its history entry with `history.back()` - and the entry it popped was the one the push had just
   * created. Exactly the race `AccountSheet`'s docblock records against Delete's
   * `router.replace('/accounts')`, and the one `FilterSheet` calls the same marker for.
   *
   * HELD AS STATE, NOT A REF, and `ConfirmShell` states why: the sheet hands its marker up once,
   * and a ref crossing that boundary is what the React Compiler refuses. `setMark(() => fn)`
   * because a bare function argument to a setter is read as an updater. */
  const [mark, setMark] = useState<(() => void) | null>(null);
  const receiveMark = useCallback((fn: () => void) => setMark(() => fn), []);

  /* THE PATH THIS SCREEN WAS MOUNTED AT, HELD - `useParamWriter`'s pattern, and its reasoning
     applies here too: `usePathname()` follows a native `pushState`, and an overlay's own push would
     otherwise redirect this write at the overlay. `useState`'s initialiser rather than a ref,
     because reading a ref during render is what the React Compiler refuses. */
  const here = usePathname();
  const [pathname] = useState(here);

  /* READ FROM `window` IN THE HANDLER, not from `useSearchParams` - the hook forces a client-side
     bailout on whatever renders it, and this component is reachable from `/kitchen-sink`, which is
     a STATIC page. A click only ever happens in a browser, so there is no server render of an
     event to break. Same call `AccountSelect` makes, for the same reason. */
  const pick = useCallback(
    (value: string) => {
      const next = new URLSearchParams(window.location.search);
      if (value === ALL) next.delete('accounts');
      else next.set('accounts', value);
      const qs = next.toString();
      /* MARKED BEFORE THE PUSH, so the sheet's cleanup knows its entry is being REPLACED rather
         than abandoned and does not pop the write off the stack. */
      mark?.();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      /* CLOSE AFTER THE WRITE, AND THROUGH `requestClose` SO THE SHEET TRAVELS rather than
         vanishing. */
      sheet.requestClose();
    },
    [router, pathname, sheet, mark]
  );

  const current = selected.length === 1 ? selected[0] : ALL;

  return (
    <AccountSheet
      open={sheet.open}
      onClose={sheet.requestClose}
      /* ONE LAYER, SO BACK AND CLOSE ARE THE SAME GESTURE. `design-system.md`: a screen drawing only
         an `x` closes; there is nowhere to go one layer back to. */
      onBack={sheet.requestClose}
      label="Which account"
      onMark={receiveMark}
      layers={[
        <>
          {/* NO BACK ARROW, for the rule above: this sheet has one screen. */}
          <ModalHeader title="Which account" onClose={sheet.requestClose} />
          <div className="pb-2">
            <ScopeRow
              label="All accounts"
              selected={current === ALL}
              onClick={() => pick(ALL)}
            />
            {accounts.map((a) => (
              <ScopeRow
                key={a.id}
                label={label(a)}
                selected={current === a.id}
                onClick={() => pick(a.id)}
              />
            ))}
          </div>
        </>,
      ]}
    />
  );
}

/* ONE ROW. `min-h-14` is the phone row height the roster and the tape both use, and the tick is on
   the RIGHT because that is where every other selected row in this app puts it. A row is one type
   size; the state is carried by the mark and the weight, never by a second size.
   EXPORTED FOR THE RACK (2026-09-03). The sheet itself cannot be racked - it is `fixed inset-0`, so
   a specimen of it would cover the page it is specimened on - and its `md:hidden` trigger does not
   render at a desktop viewport at all. The row is the part with states worth reviewing. */
export function ScopeRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="hover:bg-hover flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left transition-colors"
    >
      <span className={cn('text-body-lg truncate', selected ? 'text-text font-medium' : 'text-text')}>
        {label}
      </span>
      {selected && <Icon name="check" size={ICON_TOUCH} className="text-accent shrink-0" />}
    </button>
  );
}
