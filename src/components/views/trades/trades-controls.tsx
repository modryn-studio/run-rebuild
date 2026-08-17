'use client';

/* THE TAPE'S QUERY CONTROLS: Clear, Date, Filters. Ported from `run-trading@v2`'s
 * `sessions-filters.tsx` (2026-08-17, S5c), structure and reasoning intact.
 *
 * THE URL IS THE STATE. A filtered tape is a thing a trader reloads, bookmarks and sends to
 * themselves, and no narrowing here is worth a database row. Every panel writes search params and
 * lets the Server Component re-read them, so the figures and the address can never disagree.
 *
 * A DRAFT, THEN APPLY, and this is the part a simpler version gets wrong. Each panel edits a local
 * copy and commits on Apply, so a trader can build a multi-part question (this product, that
 * account, last month) and see the tape move once, rather than watching it re-query after every
 * click. Escape and an outside click discard the draft.
 *
 * DROPPED FROM v2, and both because the data does not exist here rather than for taste: SEARCH,
 * which searches trade notes (NOT IN V1, issue #10), and the STATUS and PHASE axes, which read
 * account columns no surface has labelled yet. The panel gains them back when those do.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HeaderControl } from '@/components/shell/header-slot';
import { cn } from '@/lib/cn';
import {
  DEFAULT_RANGE,
  RANGE_LABEL,
  RANGE_OPTIONS,
  RESULT_TOKENS,
  activeCount,
  isNarrowed,
  type Range,
  type ResultToken,
  type TradesFilter,
} from '@/lib/trades/filter';

/** What the Date button says. The window it is showing, or the question when it is showing all. */
function rangeButtonLabel(f: Pick<TradesFilter, 'range' | 'from' | 'to'>): string {
  if (f.from && f.to) return `${f.from} to ${f.to}`;
  if (f.from) return `Since ${f.from}`;
  if (f.to) return `Up to ${f.to}`;
  return f.range === DEFAULT_RANGE ? 'Date' : RANGE_LABEL[f.range as Range];
}

const isCustom = (f: Pick<TradesFilter, 'from' | 'to'>) => Boolean(f.from || f.to);
/** Whether the date control is narrowing at all — a custom window narrows without touching the
 *  shortcut, so this is not `range !== DEFAULT_RANGE`. */
const windowed = (f: Pick<TradesFilter, 'range' | 'from' | 'to'>) =>
  f.range !== DEFAULT_RANGE || isCustom(f);

/* ONE WRITER FOR THE URL, so no panel has its own idea of how a param is spelled. An empty value
 * DELETES the key rather than writing `?products=`: a URL a trader might read should not carry the
 * debris of a filter they turned off. */
function useParamWriter() {
  const router = useRouter();
  const params = useSearchParams();
  return useCallback(
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
}

/* Open state, an outside-click close and Escape. `onOpen` re-seeds the draft from what is APPLIED,
 * so re-opening a panel never shows an abandoned edit from last time. */
function usePopover(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus moves INTO the panel. v2 shipped these without it (its #95), so a keyboard user opened
    // a dialog and stayed on the page behind it.
    panel.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen((o) => !o);
  };
  return { open, setOpen, toggle, root, panel };
}

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
  const write = useParamWriter();

  return (
    <>
      {/* CLEAR COMES FIRST AND ONLY WHEN IT DOES SOMETHING. A permanently visible Clear on an
          unfiltered page is a control that does nothing. */}
      {isNarrowed(filter) && (
        <HeaderControl
          onClick={() => write({ range: null, from: null, to: null, products: null, results: null, accounts: null })}
          className="text-muted"
        >
          Clear
        </HeaderControl>
      )}
      <DatePopover applied={filter} />
      <FiltersPopover applied={filter} products={products} accounts={accounts} />
    </>
  );
}

function DatePopover({ applied }: { applied: TradesFilter }) {
  const write = useParamWriter();
  const [draft, setDraft] = useState({ range: applied.range, from: applied.from, to: applied.to });
  const { open, setOpen, toggle, root, panel } = usePopover(() =>
    setDraft({ range: applied.range, from: applied.from, to: applied.to })
  );

  const custom = isCustom(draft);
  const commit = (next: { range: Range; from: string | null; to: string | null }) => {
    write({
      // The default writes NO parameter, so a trader who never touches this has a clean URL.
      range: next.range === DEFAULT_RANGE ? null : next.range,
      from: next.from,
      to: next.to,
    });
    setOpen(false);
  };
  const dirty = draft.range !== applied.range || draft.from !== applied.from || draft.to !== applied.to;

  return (
    <div ref={root} className="relative">
      <HeaderControl onClick={toggle} aria-expanded={open} aria-haspopup="dialog" className="relative">
        <Icon name="today" size={15} />
        {rangeButtonLabel(applied)}
        {/* THE DOT. A trader scans the band for marks, not for which of two labels has changed
            wording, so a control that is narrowing the tape while looking exactly like one that is
            not is the control that gets missed. */}
        {windowed(applied) && (
          <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
        )}
      </HeaderControl>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Date range"
          className="border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-[26rem] overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          <div className="flex">
            {/* THE SHORTCUT RAIL. Picking one CLEARS the custom dates: a shortcut and a custom
                window are two answers to one question, and leaving both set would make the button's
                own label lie about what the tape is showing. */}
            <div className="border-rule w-[8.75rem] shrink-0 border-r p-2">
              {RANGE_OPTIONS.map((r) => {
                const on = !custom && draft.range === r;
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDraft({ range: r, from: null, to: null })}
                    className={cn(
                      'text-body hover:bg-hover flex min-h-9 w-full items-center rounded-[var(--radius-sm)] px-2 text-left transition-colors',
                      on ? 'text-text font-medium' : 'text-muted'
                    )}
                  >
                    {RANGE_LABEL[r]}
                  </button>
                );
              })}
            </div>

            {/* EITHER END MAY STAND ALONE, BUT THEY CANNOT CROSS. Each input bounds the other, so a
                trader cannot pick an end before the start and get an empty tape with nothing on
                screen explaining why. Bounding rather than validating: there is no error state to
                write, because the state cannot be reached. */}
            <div className="flex-1 p-4">
              <DateField
                label="Start date"
                value={draft.from}
                max={draft.to}
                onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
              />
              <div className="mt-4">
                <DateField
                  label="End date"
                  value={draft.to}
                  min={draft.from}
                  onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
                />
              </div>
            </div>
          </div>

          <PanelFooter
            onClear={() => commit({ range: DEFAULT_RANGE, from: null, to: null })}
            onCancel={() => setOpen(false)}
            onApply={() => commit(draft)}
            clearDisabled={draft.range === DEFAULT_RANGE && !custom}
            applyDisabled={!dirty}
          />
        </div>
      )}
    </div>
  );
}

function FiltersPopover({
  applied,
  products,
  accounts,
}: {
  applied: TradesFilter;
  products: string[];
  accounts: { id: string; name: string }[];
}) {
  const write = useParamWriter();
  const seed = () => ({
    products: applied.products,
    results: applied.results,
    accounts: applied.accounts,
  });
  const [draft, setDraft] = useState(seed);
  const { open, setOpen, toggle, root, panel } = usePopover(() => setDraft(seed()));

  const count = activeCount(applied);
  const draftCount = draft.products.length + draft.results.length + draft.accounts.length;
  const dirty =
    draft.products.join() !== applied.products.join() ||
    draft.results.join() !== applied.results.join() ||
    draft.accounts.join() !== applied.accounts.join();

  const commit = (next: typeof draft) => {
    write({
      products: next.products.join(',') || null,
      results: next.results.join(',') || null,
      accounts: next.accounts.join(',') || null,
    });
    setOpen(false);
  };

  const toggleIn = <T extends string>(key: 'products' | 'results' | 'accounts', v: T) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return { ...d, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
    });

  return (
    <div ref={root} className="relative">
      <HeaderControl onClick={toggle} aria-expanded={open} aria-haspopup="dialog" className="relative">
        <Icon name="filter" size={15} />
        Filters
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
          aria-label="Filters"
          className="border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-[22rem] overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          <div className="flex max-h-[26rem] flex-col gap-5 overflow-y-auto p-4">
            {/* A SCRATCH IS NEITHER, so both chips on is not "everything" — it is every DECIDED
                trade, which is the honest reading of asking for wins and losses. */}
            <Group label="Result">
              {RESULT_TOKENS.map((r) => (
                <Chip key={r} on={draft.results.includes(r)} onClick={() => toggleIn('results', r as ResultToken)}>
                  {r === 'win' ? 'Wins' : 'Losses'}
                </Chip>
              ))}
            </Group>

            {/* PRODUCT, NOT CONTRACT MONTH. `MNQ`, never `MNQU6`: the month is an expiry, not a
                strategy, and offering contracts turns eight instruments into twenty chips. */}
            {products.length > 1 && (
              <Group label="Product">
                {products.map((p) => (
                  <Chip key={p} on={draft.products.includes(p)} onClick={() => toggleIn('products', p)}>
                    {p}
                  </Chip>
                ))}
              </Group>
            )}

            {accounts.length > 1 && (
              <Group label="Account">
                {accounts.map((a) => (
                  <Chip key={a.id} on={draft.accounts.includes(a.id)} onClick={() => toggleIn('accounts', a.id)}>
                    {a.name}
                  </Chip>
                ))}
              </Group>
            )}
          </div>

          <PanelFooter
            onClear={() => commit({ products: [], results: [], accounts: [] })}
            onCancel={() => setOpen(false)}
            onApply={() => commit(draft)}
            clearDisabled={draftCount === 0 && count === 0}
            applyDisabled={!dirty}
          />
        </div>
      )}
    </div>
  );
}

/* THE FOOTER BOTH PANELS END WITH: Clear, Cancel, Apply. Three buttons a trader recognises beats
 * two they have to re-read, which is the call v2 landed on after shipping both shapes.
 *
 * CLEAR COMMITS AND CLOSES — it does not stage (Luke, 2026-08-06: "they should not have to click
 * 'clear' and then 'apply'"). "Clear this" is a complete instruction, and making it a draft edit
 * turns one intent into two clicks and leaves the panel open over a result already asked for. */
function PanelFooter({
  onClear,
  onCancel,
  onApply,
  clearDisabled,
  applyDisabled,
}: {
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  clearDisabled?: boolean;
  applyDisabled?: boolean;
}) {
  return (
    <div className="border-rule flex h-14 items-center justify-between gap-3 border-t px-3">
      <button
        type="button"
        disabled={clearDisabled}
        onClick={onClear}
        className="text-body text-muted hover:text-text -my-2 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        Clear
      </button>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={applyDisabled} onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/** One labelled date input, with its own Clear — the fastest way back to a one-ended window
 *  without retyping the other end. */
function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string | null;
  /** The other end of the window, so the two cannot cross. */
  min?: string | null;
  max?: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-small text-muted font-medium">{label}</p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-small text-muted hover:text-text font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <input
        type="date"
        value={value ?? ''}
        min={min ?? undefined}
        max={max ?? undefined}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-body text-text border-field focus-visible:ring-accent min-h-9 w-full rounded-[var(--radius-sm)] border bg-transparent px-2 focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-small text-muted mb-2 font-medium">{label}</p>
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
