'use client';

/* THE ROSTER'S FILTER, AND IT IS THE SAME OBJECT `/trades` PUTS IN THIS BAND.
 *
 * NOT A LOOKALIKE. `HeaderControl` is the trigger, `usePopover` is the open state, `Head`/`Row`/
 * `Chip`/`PanelFooter` are the panel's parts, and the panel is `/trades`' THREE-COLUMN DIMENSION
 * RAIL — which is also v2's own accounts panel, measured off the running page:
 *
 *   left    the axis names, each with how many of its own options are picked
 *   centre  the SELECTED axis's options, searchable when it is the account tree
 *   right   everything picked, grouped by axis, each group with its own Clear
 *
 * THREE AXES, NOT TWO. An earlier pass shipped Type and Status and left the ACCOUNT TREE out,
 * which is v2's default axis and the one a roster is actually filtered by. That was the bulk of
 * "there is so much missing". The tree is here now: grouped by firm, tri-state parent rows,
 * searchable past eight accounts, exactly as `/trades` and v2 both draw it.
 *
 * THE LISTS NARROW EACH OTHER on every tick (`rosterFacets`), so ticking Status = Failed greys the
 * accounts that did not fail rather than leaving the trader to guess and land on an empty roster.
 *
 * NOTHING IS OFFERED UNLESS THE ROSTER CAN ANSWER IT. An axis holding one distinct value is a
 * statement rather than a choice, so the gate is two-or-more and an axis that fails it drops out of
 * the rail. The whole control does not render when no axis clears it.
 */

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { HeaderControl } from '@/components/shell/header-slot';
import { usePopover } from '@/components/ui/use-popover';
import { Head, Row, Chip, PanelFooter } from '@/components/ui/filter-rows';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { accountShortTitle } from '@/lib/prop-firms';
import {
  STATUS_LABELS,
  TYPE_LABELS,
  activeCount,
  filterTree,
  firmTree,
  rosterFacets,
  rosterOptions,
  type RosterFilter,
} from '@/lib/accounts/roster-filter';
import type { RosterAccount } from '@/lib/accounts/read';
import type { AccountStatus, AccountType } from '@/lib/db/schema';

/** The account tree gains a search field at this many accounts. Below it, scanning beats typing —
 *  search would filter a list you can already see all of. */
const SEARCHABLE_FROM = 8;

type Dim = 'accounts' | 'types' | 'status';

export function RosterFilters({
  applied,
  accounts,
}: {
  applied: RosterFilter;
  /** The UNFILTERED roster. The tree has to offer what the filter is currently hiding, or narrowing
   *  to one firm would remove every other firm from the panel that got you there. */
  accounts: RosterAccount[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [draft, setDraft] = useState<RosterFilter>(applied);
  const [query, setQuery] = useState('');

  const options = useMemo(() => rosterOptions(accounts), [accounts]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const tree = useMemo(() => firmTree(accounts), [accounts]);
  const shownTree = useMemo(
    () => filterTree(tree, query, accountShortTitle),
    [tree, query]
  );

  /* THE SMART PART: recomputed against the DRAFT on every tick, so picking a status immediately
     greys the accounts that cannot answer it. `rosterFacets` excludes each axis from its own
     narrowing, which is what keeps a second type addable after the first is picked. */
  const counts = useMemo(() => rosterFacets(accounts, draft), [accounts, draft]);

  /* THE RAIL. A count rather than a tick — a rail row is not a choice you make, it is a place you
     go, and what it reports is how much is waiting there. */
  const dims = (
    [
      {
        key: 'accounts' as const,
        label: 'Accounts',
        picked: draft.accounts.length,
        has: options.hasAccounts,
      },
      { key: 'types' as const, label: 'Type', picked: draft.types.length, has: options.hasTypes },
      {
        key: 'status' as const,
        label: 'Status',
        picked: draft.status.length,
        has: options.hasStatus,
      },
    ] satisfies { key: Dim; label: string; picked: number; has: boolean }[]
  ).filter((d) => d.has);

  const [dim, setDim] = useState<Dim>(dims[0]?.key ?? 'accounts');

  /* RESEEDED ON OPEN, not on every render. `applied` is a fresh object each time the server
     responds, so watching it would reset a staged tick the moment an unrelated navigation landed —
     the defect `filter-sheet.tsx` had to be dug out of. */
  const { open, setOpen, toggle, root, panel } = usePopover(() => {
    setDraft(applied);
    setQuery('');
    setDim(dims[0]?.key ?? 'accounts');
  });

  const count = activeCount(applied);
  const total = draft.accounts.length + draft.status.length + draft.types.length;
  const dirty =
    draft.accounts.join() !== applied.accounts.join() ||
    draft.status.join() !== applied.status.join() ||
    draft.types.join() !== applied.types.join();

  const commit = (next: RosterFilter) => {
    const q = new URLSearchParams(params.toString());
    const set = (k: string, v: string[]) => (v.length ? q.set(k, v.join(',')) : q.delete(k));
    /* EVERY ACCOUNT TICKED IS NOT A FILTER, so it writes no parameter — otherwise the dot would
       claim a narrowing that is not happening, and the URL would carry every id to say "all". */
    set('accounts', next.accounts.length === accounts.length ? [] : next.accounts);
    set('status', next.status);
    set('types', next.types);
    const s = q.toString();
    router.replace(s ? `/accounts?${s}` : '/accounts', { scroll: false });
    setOpen(false);
  };

  /* EVERY TOGGLER COMPUTES FROM THE PREVIOUS DRAFT INSIDE THE UPDATER rather than from what this
     render closed over. Two clicks landing in one React batch would otherwise lose the first,
     silently — the double-click bug v2's own postcheck found in this panel. */
  const toggleStatus = (v: AccountStatus) =>
    setDraft((d) => ({
      ...d,
      status: d.status.includes(v) ? d.status.filter((x) => x !== v) : [...d.status, v],
    }));
  const toggleType = (v: AccountType) =>
    setDraft((d) => ({
      ...d,
      types: d.types.includes(v) ? d.types.filter((x) => x !== v) : [...d.types, v],
    }));

  /* THE DIRECTION IS DECIDED INSIDE THE UPDATER TOO, not just the Set edit. Passing `on` from the
     render read the picked set as it was when the handler was attached, so two fast clicks on one
     row both computed "turn it ON" and the second was a no-op — a double click left the row ticked
     where it should have netted to off. `mode` says what the caller MEANT rather than what it had
     measured. */
  const toggleAccounts = (ids: string[], mode: 'on' | 'off' | 'flip') =>
    setDraft((d) => {
      const next = new Set(d.accounts);
      const on = mode === 'flip' ? !ids.every((id) => next.has(id)) : mode === 'on';
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...d, accounts: [...next] };
    });

  const clearDim = (key: Dim) =>
    setDraft((d) => ({ ...d, [key]: [] }) as RosterFilter);

  /* SHORT LISTS DROP NOTHING AND GREY THE EMPTIES, same as `/trades`' Products. A ticked option is
     never dropped or greyed, or the trader loses the way back out of a filter they applied. */
  const typeOpts = options.types.map((v) => ({
    value: v,
    label: TYPE_LABELS[v],
    count: counts.types.get(v) ?? 0,
  }));
  const statusOpts = options.status.map((v) => ({
    value: v,
    label: STATUS_LABELS[v],
    count: counts.status.get(v) ?? 0,
  }));

  const picked = new Set(draft.accounts);

  // No axis can answer anything: the control itself is the thing that should not be here.
  if (dims.length === 0) return null;

  return (
    <div ref={root} className="relative">
      <HeaderControl
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
        <Icon name="filter" />
        Filters
        {/* A DOT, NOT A COUNT. It answers "is anything applied", which is one question however many
            boxes are ticked. */}
        {count > 0 && (
          <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
        )}
      </HeaderControl>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Filter accounts"
          className="pop-in bg-surface absolute top-full right-0 z-50 mt-1.5 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-card)] outline-none"
        >
          <div className="divide-rule flex flex-col sm:flex-row sm:divide-x">
            {/* LEFT: the axes. */}
            <div className="flex shrink-0 flex-col sm:w-[8.75rem]">
              <Head>Filters</Head>
              {/* `gap-1`, BECAUSE THIS IS THE SIDEBAR'S OBJECT AND THE SIDEBAR HAS ONE
                  (2026-08-26, Luke: "the hover bg connects with the active choice. there is more of
                  a gap in the side bar"). `app-shell.tsx`'s nav is `flex flex-col gap-1`; this was a
                  bare `p-2` with no gap, so two adjacent rows' `bg-selected` fills touched and read
                  as one tall block rather than as two rows - which is exactly the state the ground
                  is supposed to distinguish. Same 4px, so the two rails cannot drift. */}
              <div className="flex flex-col gap-1 p-2">
                {dims.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={dim === d.key}
                    onClick={() => {
                      setDim(d.key);
                      setQuery('');
                    }}
                    className={cn(
                      'flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left transition-colors',
                      /* The app sidebar's contract, and the same one `/trades`' two rails keep:
                         full ink on every row, `bg-selected` carrying rank on its own. An axis you
                         have not opened yet is not metadata. */
                      dim === d.key
                        ? 'bg-selected text-text font-medium'
                        : 'text-text hover:bg-selected'
                    )}
                  >
                    <span className="text-body min-w-0 flex-1 truncate">{d.label}</span>
                    {d.picked > 0 && (
                      <span className="bg-accent text-accent-fg text-caption shrink-0 rounded-full px-1.5 font-semibold tabular-nums">
                        {d.picked}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* CENTRE: the selected axis's options. The search field IS the header, and only the
                account tree has one — a list of three types is not something you search. */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* `h-12` MUST MATCH `Head`'s, or the columns' headers stop lining up. */}
              <div className="border-rule flex h-12 shrink-0 items-center gap-2 border-b px-3">
                {dim === 'accounts' && accounts.length >= SEARCHABLE_FROM ? (
                  <>
                    <Icon name="search" className="text-muted shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search accounts"
                      aria-label="Search accounts"
                      /* `h-full`, SO THE FIELD IS THE BAND (2026-08-26, Luke: "the blinking
                         cursor looks really small in the search box"). It was an auto-height input:
                         20px of line box floating in a 48px header, so the caret occupied 42% of
                         the row it appears to own and everything below the pointer was dead space.
                         The caret still measures the line-height - that is what a caret IS - but
                         the control it sits in is now the row, which is what makes it read as one.
                         The icon beside it went 15 -> 16 in the same pass: 15 is off every scale in
                         this system, and `ICON_SIZE` is 16 precisely because that is the size that
                         pairs with `text-body`. See `/kitchen-sink` Icons, "Size is a context
                         decision". */
                      className="text-body text-text placeholder:text-muted h-full w-full min-w-0 bg-transparent outline-none"
                    />
                  </>
                ) : (
                  <span className="text-body text-text font-medium">
                    {dims.find((d) => d.key === dim)?.label}
                  </span>
                )}
              </div>
              <div className="scroll-thin h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {dim === 'accounts' ? (
                  shownTree.length === 0 ? (
                    <p className="text-body text-muted px-1 py-3">No account matches that.</p>
                  ) : (
                    shownTree.map((g) => {
                      const ids = g.accounts.map((a) => a.id);
                      const on = ids.filter((id) => picked.has(id)).length;
                      /* A FIRM IS DEAD ONLY IF EVERY ONE OF ITS ACCOUNTS IS. The parent is a bulk
                         toggle over its children, so it can only be as inert as all of them. */
                      const firmLive = ids.reduce((n, id) => n + (counts.accounts.get(id) ?? 0), 0);
                      return (
                        <div key={g.firm} className="mb-1 last:mb-0">
                          <Row
                            label={g.firm}
                            trailing={String(g.accounts.length)}
                            state={on === 0 ? 'off' : on === ids.length ? 'on' : 'some'}
                            onClick={() => toggleAccounts(ids, 'flip')}
                            dead={firmLive === 0}
                            strong
                          />
                          {g.accounts.map((a) => (
                            <Row
                              key={a.id}
                              /* The FIRM is the row above, so a child repeating it truncates away
                                 the four digits that tell near-identical rows apart. */
                              label={accountShortTitle(a)}
                              state={picked.has(a.id) ? 'on' : 'off'}
                              /* Greyed, not removed: a long tree that re-renders under the cursor
                                 moves the next row you were about to press. */
                              dead={(counts.accounts.get(a.id) ?? 0) === 0}
                              onClick={() => toggleAccounts([a.id], 'flip')}
                              indent
                            />
                          ))}
                        </div>
                      );
                    })
                  )
                ) : dim === 'types' ? (
                  typeOpts.map((o) => (
                    <Row
                      key={o.value}
                      label={o.label}
                      trailing={String(o.count)}
                      state={draft.types.includes(o.value) ? 'on' : 'off'}
                      onClick={() => toggleType(o.value)}
                      dead={o.count === 0}
                    />
                  ))
                ) : (
                  statusOpts.map((o) => (
                    <Row
                      key={o.value}
                      label={o.label}
                      trailing={String(o.count)}
                      state={draft.status.includes(o.value) ? 'on' : 'off'}
                      onClick={() => toggleStatus(o.value)}
                      dead={o.count === 0}
                    />
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: everything picked, GROUPED BY AXIS with a Clear each — not decoration, since
                the centre list scrolls and the evidence of what was picked would scroll with it. */}
            <div className="hidden shrink-0 flex-col sm:flex sm:w-64">
              <Head>{total > 0 ? `${total} selected` : '0 selected'}</Head>
              <div className="scroll-thin h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {dims.map((d) => {
                  if (d.picked === 0) return null;
                  return (
                    <div key={d.key} className="mb-3 last:mb-0">
                      <div className="mb-1 flex items-center justify-between gap-2 px-1">
                        <span className="text-body text-text font-medium">{d.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-my-1"
                          onClick={() => clearDim(d.key)}
                        >
                          Clear
                        </Button>
                      </div>
                      {d.key === 'accounts'
                        ? draft.accounts.map((id) => {
                            const a = byId.get(id);
                            /* THE FIRM COMES BACK HERE, unlike the tree rows: a chip sits outside
                               the tree with no group header above it. It is the head that gives way
                               when the column is tight, never the digits. */
                            return a ? (
                              <Chip
                                key={id}
                                label={a.propFirm ?? 'Unlabelled'}
                                tail={accountShortTitle(a)}
                                onRemove={() => toggleAccounts([id], 'off')}
                              />
                            ) : null;
                          })
                        : d.key === 'types'
                          ? draft.types.map((v) => (
                              <Chip
                                key={v}
                                label={TYPE_LABELS[v]}
                                onRemove={() => toggleType(v)}
                              />
                            ))
                          : draft.status.map((v) => (
                              <Chip
                                key={v}
                                label={STATUS_LABELS[v]}
                                onRemove={() => toggleStatus(v)}
                              />
                            ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* This Clear unticks and COMMITS, which is the band's Clear minus nothing — see
              `PanelFooter`. `clearDisabled` reads the applied count too, so a panel opened over an
              applied filter can clear it without staging a change first. */}
          <PanelFooter
            onClear={() => commit({ accounts: [], status: [], types: [] })}
            onCancel={() => setOpen(false)}
            onApply={() => commit(draft)}
            clearDisabled={total === 0 && count === 0}
            applyDisabled={!dirty}
          />
        </div>
      )}
    </div>
  );
}

/* ONE CLEAR FOR THE BAND, left of Filters, and it is `/trades`' own control down to the variant.
 *
 * A filter you have to reopen a panel to undo is a filter you forget you left on, and this page's
 * is the narrowing that removes ROWS without naming what it removed.
 *
 * `Button variant="ghost"`, not a hand-rolled element: it is an undo, not a peer of Filters and Add
 * account, so it wears ink only — and being the component is what gives it the press state, the
 * disabled handling and the focus ring.
 *
 * It renders only while something is applied, so the band is unchanged for a trader who has not
 * filtered, which is also what makes it a usable signal on its own.
 */
export function RosterClear({ applied }: { applied: RosterFilter }) {
  const router = useRouter();
  const params = useSearchParams();
  if (!activeCount(applied)) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={() => {
        const q = new URLSearchParams(params.toString());
        for (const k of ['accounts', 'status', 'types']) q.delete(k);
        const s = q.toString();
        router.replace(s ? `/accounts?${s}` : '/accounts', { scroll: false });
      }}
    >
      Clear
    </Button>
  );
}
