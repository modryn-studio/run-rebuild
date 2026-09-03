'use client';

/* WHICH ACCOUNT THE TAPE IS SHOWING, in the tape's own header row.
 *
 * IT REPLACED THE WORD "TRADES" (Luke, 2026-08-20: "trades tables on desktop does not need the
 * title 'trades' because the page already is titled 'trades'"). The shell's band already names the
 * screen from the route, so a card header repeating it said the same word twice, 64px apart. The
 * reference does exactly this: measured on `app.monarch.com/transactions`, its table header carries
 * a 200x35 select reading "All transactions" where a title would otherwise be.
 *
 * ─── IT IS STRICTLY MIRRORED WITH THE FILTERS PANEL, AND THAT IS THE WHOLE DESIGN ─────────────
 *
 * There is no second piece of state here. This writes the same `accounts` search param the Filters
 * panel writes, so everything downstream follows for free and cannot disagree:
 *   - `activeCount` already counts `accounts`, so the Filters button lights its dot
 *   - `isNarrowed` already counts it, so the band's `Clear` appears
 *   - the panel's Accounts axis shows the same account ticked, because it reads the same param
 *   - clearing from EITHER side clears both, because there is only one thing to clear
 * Verified on the reference before copying: picking a view there lights the Filters dot, shows the
 * choice selected inside the panel, and adds a `Clear` to the band. The same three, in the same
 * places.
 *
 * ─── ONE ACCOUNT: IT IS A LABEL, NOT A FILTER ────────────────────────────────────────────────
 *
 * It renders at every account count (Luke, 2026-08-20: "i don't want it to render nothing below two
 * accounts"), and at one account it names that account and offers only it, already selected.
 *
 * IT WRITES NOTHING THERE, and that is what makes it safe. An earlier pass hid the control below two
 * accounts precisely because picking the only account would write `accounts=<id>`, select exactly
 * the same trades, AND light the "something is narrowed" dot — a control claiming the record was
 * narrowed without narrowing it, which is the one thing this product may not ship. Keeping the
 * control and dropping the WRITE answers both: the trader sees which account they are looking at,
 * and no filter is applied because there is nothing to filter to.
 * So at one account this is a label wearing a menu's clothes. There is no "All accounts" row,
 * because with one account "all" and "that one" are the same set and offering both would be two
 * words for one thing.
 *
 * At two or more it becomes a real control: "All accounts" plus each account, writing the same
 * `accounts` param the Filters panel writes.
 */

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from '@/components/ui/menu';
import type { FacetAccount } from '@/lib/trades/read';

/* THE FIRM AND ITS SHORT, JOINED BY A SPACE AND NOTHING ELSE.
 *
 * `short` is already a finished label — `accountShortTitle` returns "50K (...4873)", or the display
 * name if the trader set one, with the brackets baked in by `accountLast4`. Wrapping it again
 * printed "Tradeify ((...4873))" on the real corpus, which is what a template that assumed a bare
 * number looks like when it meets a formatter that already did the work. */
const accountLabel = (a: FacetAccount) => `${a.firm} ${a.short}`.trim();

/** The sentinel for "not narrowed". Not an account id, and never written to the URL — picking it
 *  DELETES the param, which is what keeps a cleared filter out of a URL a trader might read. */
const ALL = 'all';

export function AccountSelect({
  accounts,
  selected,
}: {
  accounts: FacetAccount[];
  /** The ids currently in the `accounts` param. Empty means every account. */
  selected: string[];
}) {
  const router = useRouter();
  /* IT WRITES TO THE PAGE IT WAS CALLED FROM, and `/trades` was a literal here until 2026-09-03.
   * `CLAUDE.md`: *"A filter control writes to `usePathname()`, never a hard-coded route."* This
   * control was the last violation of that rule, and it stopped being harmless the moment `/today`
   * mounted the same component for its page-level account scope - a picker in the dashboard's
   * header that navigated to the tape instead of narrowing the dashboard.
   * THE PATH IS HELD AT MOUNT, which is `useParamWriter`'s own pattern and its reasoning applies
   * unchanged: `usePathname()` follows a native `pushState`, and `TradeSheet` pushes `/trades/<id>`
   * onto this very page when a row is tapped on a phone. The address of the SCREEN does not change
   * while the screen is mounted; only an overlay's does. `useState`'s initialiser rather than a
   * ref, because reading a ref during render is what the React Compiler refuses. */
  const here = usePathname();
  const [pathname] = useState(here);

  /* THE CURRENT PARAMS COME FROM `window`, NOT `useSearchParams` (2026-08-20).
   *
   * That hook forces a client-side bailout on whatever renders it, and this control is rendered in
   * `/kitchen-sink` — a STATIC page. The build failed outright: "useSearchParams() should be
   * wrapped in a suspense boundary at page /kitchen-sink". Wrapping the rack in a boundary would
   * have fixed the symptom and left the cause: a control that cannot be rendered anywhere without
   * dragging a Suspense requirement along with it.
   *
   * Reading `window.location.search` inside the handler is safe precisely because a click only ever
   * happens in a browser — there is no server render of an event. The other params are preserved
   * the same way `useParamWriter` preserves them, so this and the Filters panel write the URL
   * identically. */
  const write = useCallback(
    (value: string) => {
      const next = new URLSearchParams(window.location.search);
      if (value === ALL) next.delete('accounts');
      else next.set('accounts', value);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  if (accounts.length === 0) return null;

  /* THE ONLY ACCOUNT IS THE ONLY OPTION. No "All accounts" beside it: the two would select the same
     trades, so the pair would be two labels for one set. */
  const single = accounts.length === 1;

  const options = single
    ? accounts.map((a) => ({ value: a.id, label: accountLabel(a) }))
    : [
        { value: ALL, label: 'All accounts' },
        ...accounts.map((a) => ({ value: a.id, label: accountLabel(a) })),
      ];

  /* THE TRIGGER TELLS THE TRUTH WHEN THE FILTER HOLDS MORE THAN ONE. The panel can select two
     accounts; this menu offers one at a time. Without the override the trigger would fall back to
     the first option and read "All accounts" while two were selected — the exact lie a mirrored
     control cannot afford. `Menu`'s `valueLabel` exists for this. */
  const valueLabel =
    selected.length > 1 ? `${selected.length} accounts` : undefined;

  return (
    <Menu
      label="Which account"
      /* At one account the menu is pinned to it: `value` is that account, its row shows the tick,
         and `onChange` does nothing. The row cannot be deselected because there is nothing to
         deselect TO. */
      value={single ? accounts[0].id : selected.length === 1 ? selected[0] : ALL}
      valueLabel={valueLabel}
      options={options}
      onChange={single ? () => {} : write}
    />
  );
}
