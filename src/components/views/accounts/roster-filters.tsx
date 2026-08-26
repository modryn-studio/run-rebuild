'use client';

/* THE ROSTER'S FILTER, AND IT IS THE SAME OBJECT `/trades` PUTS IN THIS BAND.
 *
 * NOT A LOOKALIKE. `HeaderControl` is the trigger, `usePopover` is the open state, and `Head`, `Row`
 * and `Chip` are the panel's parts — every one of them the file `/trades` already uses. A page that
 * draws its own version of a control the app already has is how two headers drift apart while both
 * look "right" in isolation, which is exactly what Luke caught here.
 *
 * TWO COLUMNS, NOT THREE. `/trades` runs a dimension rail because it has five axes and a searchable
 * firm tree; this has two, and a rail naming two destinations is furniture. The right-hand
 * "selected" column stays, because it is what keeps the evidence of a choice visible after the
 * middle list has scrolled — v2's own reason for it.
 *
 * NOTHING IS OFFERED UNLESS THE ROSTER CAN ANSWER IT. An axis holding one distinct value is a
 * statement rather than a choice, so the gate is two-or-more (`rosterOptions`), and the whole
 * control does not render when neither axis clears it. A menu that cannot change anything is the
 * inert-control failure v2 records against its own Refresh button.
 */

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { HeaderControl } from '@/components/shell/header-slot';
import { usePopover } from '@/components/ui/use-popover';
import { Head, Row, Chip } from '@/components/ui/filter-rows';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  STATUS_LABELS,
  TYPE_LABELS,
  activeCount,
  type RosterFilter,
} from '@/lib/accounts/roster-filter';
import type { AccountStatus, AccountType } from '@/lib/db/schema';

type Options = {
  status: { value: AccountStatus; count: number }[];
  types: { value: AccountType; count: number }[];
  hasStatus: boolean;
  hasTypes: boolean;
};

export function RosterFilters({ applied, options }: { applied: RosterFilter; options: Options }) {
  const router = useRouter();
  const params = useSearchParams();

  const [draft, setDraft] = useState<RosterFilter>(applied);
  /* RESEEDED ON OPEN, not on every render. `applied` is a fresh object each time the server
     responds, so watching it would reset a staged tick the moment an unrelated navigation landed —
     the defect `filter-sheet.tsx` had to be dug out of. */
  const { open, setOpen, toggle, root, panel } = usePopover(() => setDraft(applied));

  const count = activeCount(applied);
  const total = draft.status.length + draft.types.length;
  const dirty =
    draft.status.join() !== applied.status.join() || draft.types.join() !== applied.types.join();

  const commit = (next: RosterFilter) => {
    const q = new URLSearchParams(params.toString());
    const set = (k: string, v: string[]) => (v.length ? q.set(k, v.join(',')) : q.delete(k));
    set('status', next.status);
    set('types', next.types);
    const s = q.toString();
    router.replace(s ? `/accounts?${s}` : '/accounts', { scroll: false });
    setOpen(false);
  };

  /* BOTH TOGGLERS COMPUTE FROM THE PREVIOUS DRAFT INSIDE THE UPDATER rather than from what this
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

  const chips = useMemo(
    () => [
      ...draft.status.map((v) => ({
        key: `s:${v}`,
        label: STATUS_LABELS[v],
        drop: () => toggleStatus(v),
      })),
      ...draft.types.map((v) => ({
        key: `t:${v}`,
        label: TYPE_LABELS[v],
        drop: () => toggleType(v),
      })),
    ],
    [draft]
  );

  // Neither axis can answer anything: the control itself is the thing that should not be here.
  if (!options.hasStatus && !options.hasTypes) return null;

  return (
    <div ref={root} className="relative">
      <HeaderControl
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
        <Icon name="filter" size={15} />
        Filters
        {/* A DOT, NOT A COUNT. It answers "is anything applied", which is one question however many
            boxes are ticked. */}
        {count > 0 && (
          <span
            aria-hidden
            className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full"
          />
        )}
      </HeaderControl>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Filter accounts"
          className="pop-in bg-surface absolute top-full right-0 z-50 mt-1.5 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-card)] outline-none"
        >
          <div className="divide-rule flex flex-col sm:flex-row sm:divide-x">
            <div className="flex min-w-0 flex-1 flex-col">
              <Head>Filters</Head>
              <div className="scroll-thin max-h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {options.hasTypes && (
                  <>
                    <p className="text-body text-muted px-1 pt-1 pb-1.5 font-medium">Type</p>
                    {options.types.map((o) => (
                      <Row
                        key={o.value}
                        label={TYPE_LABELS[o.value]}
                        trailing={String(o.count)}
                        state={draft.types.includes(o.value) ? 'on' : 'off'}
                        onClick={() => toggleType(o.value)}
                      />
                    ))}
                  </>
                )}
                {options.hasStatus && (
                  <>
                    <p className="text-body text-muted px-1 pt-3 pb-1.5 font-medium">Status</p>
                    {options.status.map((o) => (
                      <Row
                        key={o.value}
                        label={STATUS_LABELS[o.value]}
                        trailing={String(o.count)}
                        state={draft.status.includes(o.value) ? 'on' : 'off'}
                        onClick={() => toggleStatus(o.value)}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* THE SELECTED COLUMN IS NOT DECORATION. The list beside it scrolls, so once a trader
                has picked three of six the evidence of what they picked can scroll away. */}
            <div className="hidden shrink-0 flex-col sm:flex sm:w-56">
              <Head>{total > 0 ? `${total} selected` : '0 selected'}</Head>
              <div className="scroll-thin max-h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {chips.map((c) => (
                  <Chip key={c.key} label={c.label} onRemove={c.drop} />
                ))}
              </div>
            </div>
          </div>

          {/* PEERS AT ONE SIZE, varying only by variant — the rule `design-system.md` §2a states and
              `/trades` already keeps: Clear is `ghost` so it cannot read as a third equal button. */}
          <div className="border-rule flex h-14 shrink-0 items-center justify-between border-t px-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={total === 0}
              onClick={() => setDraft({ status: [], types: [] })}
            >
              Clear
            </Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!dirty} onClick={() => commit(draft)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
