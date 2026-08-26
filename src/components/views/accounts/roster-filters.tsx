'use client';

/* THE ROSTER'S FILTER, AND IT IS THE SAME OBJECT `/trades` PUTS IN THIS BAND.
 *
 * NOT A LOOKALIKE. `HeaderControl` is the trigger, `usePopover` is the open state, `Head`/`Row`/
 * `Chip` are the panel's parts, and the panel itself is `/trades`' THREE-COLUMN DIMENSION RAIL —
 * left the axis names, centre the selected axis's options, right everything picked, grouped by
 * axis. A prior version of this file stacked Type and Status into one scrolling column and argued
 * two axes were too few to earn a rail. That argument does not survive a diff: v2's OWN accounts
 * panel runs the rail down to two axes (Status, Phase, on a roster with one Accounts-tree hidden
 * by a single-firm gate), and `/trades` runs it at two as well the moment Products drops out. The
 * rail is the object at every axis count above one; a flat stack is a second, different control
 * this page had drawn for itself, which is exactly the drift Luke was pointing at.
 *
 * NOTHING IS OFFERED UNLESS THE ROSTER CAN ANSWER IT. An axis holding one distinct value is a
 * statement rather than a choice, so the gate is two-or-more (`rosterOptions`), and a dimension
 * that fails it drops out of the rail the same way Products drops out of `/trades`'. The whole
 * control does not render when neither axis clears it.
 */

import { useState } from 'react';
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

type Dim = 'types' | 'status';

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

  /* THE RAIL, same shape as `/trades`': a dimension drops out the moment its own axis cannot
     answer anything, and the order (Type, then Status) is what the stacked version already used —
     nothing about which axis reads first was the part Luke flagged. */
  const dims = (
    [
      { key: 'types' as const, label: 'Type', picked: draft.types.length, has: options.hasTypes },
      { key: 'status' as const, label: 'Status', picked: draft.status.length, has: options.hasStatus },
    ] satisfies { key: Dim; label: string; picked: number; has: boolean }[]
  ).filter((d) => d.has);

  const [dim, setDim] = useState<Dim>(dims[0]?.key ?? 'types');

  /* RESEEDED ON OPEN, not on every render. `applied` is a fresh object each time the server
     responds, so watching it would reset a staged tick the moment an unrelated navigation landed —
     the defect `filter-sheet.tsx` had to be dug out of. The rail resets to its first axis too, or a
     panel closed on Status would reopen there instead of at the top. */
  const { open, setOpen, toggle, root, panel } = usePopover(() => {
    setDraft(applied);
    setDim(dims[0]?.key ?? 'types');
  });

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

  const clearDim = (key: Dim) =>
    setDraft((d) => (key === 'types' ? { ...d, types: [] } : { ...d, status: [] }));

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
          className="pop-in bg-surface absolute top-full right-0 z-50 mt-1.5 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-card)] outline-none"
        >
          <div className="divide-rule flex flex-col sm:flex-row sm:divide-x">
            {/* LEFT: the axes. A count rather than a tick — a rail row is not a choice you make,
                it is a place you go, and what it reports is how much is waiting there. */}
            <div className="flex shrink-0 flex-col sm:w-[8.75rem]">
              <Head>Filters</Head>
              <div className="p-2">
                {dims.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={dim === d.key}
                    onClick={() => setDim(d.key)}
                    className={cn(
                      'flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left transition-colors',
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

            {/* CENTRE: the selected axis's options. Neither axis is an account tree, so the header
                is just the axis name — the search field `/trades` puts here belongs to a list too
                long to scan, and Type and Status never grow past four rows. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-rule flex h-12 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-body text-text font-medium">
                  {dims.find((d) => d.key === dim)?.label}
                </span>
              </div>
              <div className="scroll-thin h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {dim === 'types'
                  ? options.types.map((o) => (
                      <Row
                        key={o.value}
                        label={TYPE_LABELS[o.value]}
                        trailing={String(o.count)}
                        state={draft.types.includes(o.value) ? 'on' : 'off'}
                        onClick={() => toggleType(o.value)}
                      />
                    ))
                  : options.status.map((o) => (
                      <Row
                        key={o.value}
                        label={STATUS_LABELS[o.value]}
                        trailing={String(o.count)}
                        state={draft.status.includes(o.value) ? 'on' : 'off'}
                        onClick={() => toggleStatus(o.value)}
                      />
                    ))}
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
                      {d.key === 'types'
                        ? draft.types.map((v) => (
                            <Chip key={v} label={TYPE_LABELS[v]} onRemove={() => toggleType(v)} />
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
