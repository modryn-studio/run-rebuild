'use client';

/* THE TAPE'S TWO QUERY CONTROLS: the date range, and everything else. Plus a Clear that only exists
 * while there is something to clear.
 *
 * THE URL IS THE STATE. A filtered tape is a thing a trader reloads, bookmarks and sends to
 * themselves, and no narrowing here is worth a database row. Every control writes a search param and
 * lets the Server Component re-read it, so the page's figures and its address can never disagree.
 *
 * BOTH PANELS ARE REAL DIALOGS, which is where this departs from `run-trading@v2` on purpose. Its
 * filter panels had no `aria-modal`, no focus move, no trap and no restore (its issue #95), so a
 * keyboard user opened one and stayed on the page behind it. Same treatment as the trade drawer.
 *
 * EMPTY MEANS EVERY ONE, everywhere. Nothing selected is the resting state rather than an edge case,
 * so a chip list needs no "All" entry — which would be a second reading of the same field.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import {
  RANGE_LABEL,
  RANGE_OPTIONS,
  RESULT_TOKENS,
  activeCount,
  isNarrowed,
  type Range,
  type ResultToken,
  type TradesFilter,
} from '@/lib/trades/filter';

export function TradesControls({
  filter,
  products,
  accounts,
}: {
  filter: TradesFilter;
  /** Every product ever traded, NOT just the ones in range — see `getFacets`. */
  products: string[];
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  /* ONE WRITER FOR THE URL, so no control has its own idea of how a param is spelled. An empty
     value DELETES the key rather than writing `?products=`, because a URL a trader might read
     should not carry the debris of a filter they turned off. */
  const apply = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(qs ? `/trades?${qs}` : '/trades', { scroll: false });
    },
    [params, router]
  );

  const narrowed = isNarrowed(filter);
  const count = activeCount(filter);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* CLEAR COMES FIRST AND ONLY WHEN IT DOES SOMETHING. A permanently visible Clear on an
          unfiltered page is a control that does nothing, which the postcheck treats as a defect. */}
      {narrowed && (
        <Button variant="ghost" size="sm" onClick={() => router.push('/trades', { scroll: false })}>
          Clear
        </Button>
      )}

      <Popover
        label={rangeLabel(filter)}
        active={filter.range !== 'all' || Boolean(filter.from || filter.to)}
        title="Date range"
      >
        {(close) => (
          <div className="flex w-64 flex-col p-1">
            {RANGE_OPTIONS.map((r) => (
              <MenuItem
                key={r}
                selected={filter.range === r && !filter.from && !filter.to}
                onClick={() => {
                  // A shortcut CLEARS a custom window; the two are one question with one answer.
                  apply({ range: r, from: null, to: null });
                  close();
                }}
              >
                {RANGE_LABEL[r]}
              </MenuItem>
            ))}

            <div className="border-rule my-1 border-t" />
            {/* EITHER END MAY STAND ALONE. "Everything since March" is a real question and so is
                "everything up to the day I blew it", so neither input requires the other. */}
            <div className="flex items-center gap-2 px-2 py-2">
              <DayInput
                label="From"
                value={filter.from}
                onChange={(v) => apply({ from: v, range: null })}
              />
              <DayInput label="To" value={filter.to} onChange={(v) => apply({ to: v, range: null })} />
            </div>
          </div>
        )}
      </Popover>

      <Popover label="Filters" active={count > 0} badge={count} title="Filters">
        {() => (
          <div className="flex w-72 flex-col gap-4 p-4">
            <Group label="Result">
              {/* A SCRATCH IS NEITHER, so both chips on is not "everything" — it is every DECIDED
                  trade, which is the honest reading of asking for wins and losses. */}
              {RESULT_TOKENS.map((r) => (
                <Chip
                  key={r}
                  on={filter.results.includes(r)}
                  onClick={() => apply({ results: toggle(filter.results, r).join(',') })}
                >
                  {r === 'win' ? 'Wins' : 'Losses'}
                </Chip>
              ))}
            </Group>

            {products.length > 1 && (
              <Group label="Product">
                {products.map((p) => (
                  <Chip
                    key={p}
                    on={filter.products.includes(p)}
                    onClick={() => apply({ products: toggle(filter.products, p).join(',') })}
                  >
                    {p}
                  </Chip>
                ))}
              </Group>
            )}

            {accounts.length > 1 && (
              <Group label="Account">
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    on={filter.accounts.includes(a.id)}
                    onClick={() => apply({ accounts: toggle(filter.accounts, a.id).join(',') })}
                  >
                    {a.name}
                  </Chip>
                ))}
              </Group>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

const toggle = <T extends string>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

function rangeLabel(f: TradesFilter): string {
  if (f.from && f.to) return `${f.from} to ${f.to}`;
  if (f.from) return `Since ${f.from}`;
  if (f.to) return `Up to ${f.to}`;
  return f.range === 'all' ? 'Date' : RANGE_LABEL[f.range as Range];
}

/* A POPOVER THAT IS A REAL DIALOG: labelled, focus moved in, trapped, restored on close, and
 * dismissed by Escape or an outside click. */
function Popover({
  label,
  title,
  active,
  badge,
  children,
}: {
  label: string;
  title: string;
  active: boolean;
  badge?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  /* `close` ONLY SETS STATE. It used to focus the trigger too, which reads a ref — and this function
     is handed to `children()` during render, so the React Compiler correctly refused it. Restoring
     focus is a side effect of having closed, so it belongs in an effect rather than in the handler
     that asked for the close. */
  const close = useCallback(() => setOpen(false), []);

  /* FOCUS GOES BACK TO THE TRIGGER, but only on a real close — `wasOpen` is what stops this
     stealing focus on mount, when `open` is already false and nothing has been dismissed. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = panel.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div ref={wrap} className="relative">
      <Button
        ref={trigger}
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={active || undefined}
      >
        {label}
        {badge ? <span className="text-caption tabular-nums">({badge})</span> : null}
        <Icon name="chevron" size={14} />
      </Button>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={onKeyDown}
          className="bg-surface border-border absolute right-0 z-50 mt-1 rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-body hover:bg-hover flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors',
        selected ? 'text-text' : 'text-muted'
      )}
    >
      {children}
      {selected && <Icon name="check" size={14} className="text-accent" />}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption text-muted mb-2 uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'text-body min-h-9 rounded-[var(--radius-sm)] border px-2.5 transition-colors',
        on
          ? 'border-accent text-accent bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]'
          : 'border-border text-muted hover:text-text hover:bg-hover'
      )}
    >
      {children}
    </button>
  );
}

function DayInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-caption text-muted">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-body text-text border-field focus-visible:ring-accent min-h-9 w-full rounded-[var(--radius-sm)] border bg-transparent px-2 focus-visible:ring-2 focus-visible:outline-none"
      />
    </label>
  );
}
