'use client';

/* THE ACCOUNT DETAIL PAGE'S `Filters` CONTROL: a dropdown of dropdowns.
 *
 * ─── WHY THIS IS NOT `/trades`' THREE-COLUMN PANEL ──────────────────────────────────────────────
 *
 * In `run-trading@v2` it was, for about a day. Luke (2026-08-06): *"i had you copy the menu the same
 * as accounts and sessions page. but now i see the filters menu in the accounts/details page really
 * doesn't need to look the same. it looks empty because it doesn't have the Accounts filter and it
 * doesn't need it either."*
 *
 * He is right, and the measurement makes the case: that panel is 656px over three columns with a
 * dimensions rail, a scrolling middle and a "selected" column, built for five axes over a
 * thirty-three row account tree. This page has TWO axes and a handful of options. The same shape at
 * this size is a large empty room, and "consistent" is not a reason to render furniture.
 *
 * The reference splits the same way and for the same reason: its transactions page spreads the
 * controls across a band, its ACCOUNT DETAIL page folds them into one dropdown of labelled select
 * boxes with the actions on top.
 *
 * ─── WHAT IS COPIED, AND WHAT IS OURS ───────────────────────────────────────────────────────────
 *
 * Copied: the SHAPE. One column, each facet a labelled control reading "All <things>" until
 * something is picked, a search field first because it is the broadest filter.
 *
 * Ours: every component. The tick rows are the same `Row` the `/trades` panel uses, the footer is
 * the same `PanelFooter`, the dismissal is the same `usePopover` (outside click, Escape, focus
 * returned to the trigger), and the geometry is this build's scale. A copied layout drawn in
 * someone else's parts is how a design system dies.
 *
 * SEARCH LIVES INSIDE, not beside. On a page with two facets a separate Search button would be two
 * header controls doing one job; the reference folds it in for the same reason. The band is
 * Edit + Filters.
 *
 * A CHEVRON, NOT THE FILTER MARK. The rule: a chevron says "a small menu opens here", the filter
 * glyph says "a workspace opens" - and `/trades` does open a workspace, with columns and a footer
 * and a scroll. This opens a menu. Different surfaces earn different affordances, and the button
 * says the word "Filters" either way.
 */

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { HeaderControl } from '@/components/shell/header-slot';
import { Icon } from '@/components/ui/icon';
import { Row, PanelFooter } from '@/components/ui/filter-rows';
import { usePopover } from '@/components/ui/use-popover';
import { cn } from '@/lib/cn';
import { facetCounts, type FacetRow } from '@/lib/trades/facets';
import type { ResultToken } from '@/lib/trades/filter';

export type Option = { value: string; label: string };

type Draft = { products: string[]; results: string[]; q: string };

export function DetailFilters({
  accountId,
  applied,
  products,
  results,
  facetRows,
}: {
  /** The one account this page is about. The facet engine keys on it. */
  accountId: string;
  applied: { products: string[]; results: ResultToken[]; q: string | null };
  /** The products this account actually traded, so the panel offers only real choices. */
  products: Option[];
  results: Option[];
  facetRows: FacetRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [draft, setDraft] = useState<Draft>({
    products: applied.products,
    results: applied.results,
    q: applied.q ?? '',
  });

  /* RE-SEEDED ON EVERY OPEN rather than kept: a panel that reopens holding an abandoned draft is a
     panel that applies something the trader typed and walked away from. `usePopover` takes the
     seeding as its `onOpen`, which is the same contract the `/trades` popovers use. */
  const { open, setOpen, toggle, root, panel } = usePopover(() =>
    setDraft({ products: applied.products, results: applied.results, q: applied.q ?? '' })
  );

  const commit = (next: Draft) => {
    const q = new URLSearchParams(params.toString());
    const set = (k: string, v: string | null) => (v ? q.set(k, v) : q.delete(k));
    set('products', next.products.length ? next.products.join(',') : null);
    set('results', next.results.length ? next.results.join(',') : null);
    set('q', next.q.trim() || null);
    /* `replace`, NOT `push`. Narrowing a list is not a place in the app's history - a trader who
       ticked three products and pressed Back wants the page they came FROM, not their own second
       and first ticks. Same call every `/trades` control makes.
       `scroll: false` because the tape below is what changed, and jumping to the top would take the
       chart the trader is reading with it. */
    router.replace(`${pathname}${q.toString() ? `?${q}` : ''}`, { scroll: false });
    setOpen(false);
  };

  /* THE SAME NARROWING THE `/trades` PANEL DOES, from the same engine: each facet's options are
     counted against the OTHER facet's selection and never against its own, so picking Wins re-counts
     the products without locking you out of adding a second one. `lib/trades/facets.ts` has the
     argument.
     SCOPED TO THIS ACCOUNT by putting it in the selection rather than by pre-filtering the rows -
     the engine already knows how to narrow on that axis, and asking it twice in two ways is how two
     counts come to disagree. */
  const counts = facetCounts(facetRows, {
    accounts: [accountId],
    products: draft.products,
    results: draft.results as ResultToken[],
    status: [],
    types: [],
  });

  const dirty =
    draft.products.join() !== applied.products.join() ||
    draft.results.join() !== applied.results.join() ||
    draft.q.trim() !== (applied.q ?? '');
  const anything = draft.products.length > 0 || draft.results.length > 0 || draft.q.trim() !== '';
  const active =
    applied.products.length + applied.results.length + (applied.q ? 1 : 0);

  const toggleValue = (key: 'products' | 'results', v: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v],
    }));

  return (
    <div ref={root} className="relative">
      <HeaderControl
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
        Filters
        <Icon name="chevron" size={14} className={cn('transition-transform', open && 'rotate-180')} />
        {/* A DOT, NOT A COUNT (v2, Luke 2026-08-06: "remove the number badge and just use the dot
            like the other page's filter button used. for consistency").
            A number earns its place when it counts something that can be more than a handful, which
            is why the big panels keep theirs - they count GROUPS across five axes. Two facets and a
            search box is not a number worth printing: the dot says "something is on", which is all
            this control has to say, and the panel itself shows what. */}
        {active > 0 && (
          <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
        )}
      </HeaderControl>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-label="Filter this account"
          /* 328px, and narrow on purpose: every control inside is full width, so the panel is
             exactly as wide as one field needs and no wider. */
          className="pop-in border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-82 overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          <div className="flex flex-col gap-4 p-4">
            <Field label="Search">
              {/* A BARE `<input>` RATHER THAN `TextField`, and only because that primitive owns its
                  own label and hint block - which `Field` is already providing for all three rows
                  here. Two labels on one control is worse than one hand-styled box, and the classes
                  below are the same tokens `TextField` resolves to. */}
              <input
                value={draft.q}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                // Enter applies. A panel whose fields are all optional still has one obvious verb.
                onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
                placeholder="Search this account"
                aria-label="Search this account"
                className="border-border bg-bg text-body-lg sm:text-body text-text placeholder:text-muted focus:border-accent h-10 w-full rounded-[var(--radius-sm)] border px-3 outline-none"
              />
              {/* Says what THIS search covers. The account is not in the list because it is the same
                  on every row here, so matching it would return everything and read as broken. */}
              <p className="text-meta text-muted mt-1.5">Matches the product and the contract.</p>
            </Field>

            <Field label="Product">
              <Picker
                summary={summarise(draft.products, products, 'All products')}
                options={products.map((o) => ({ ...o, count: counts.products.get(o.value) ?? 0 }))}
                picked={draft.products}
                onToggle={(v) => toggleValue('products', v)}
              />
            </Field>

            <Field label="Result">
              <Picker
                summary={summarise(draft.results, results, 'All results')}
                options={results.map((o) => ({ ...o, count: counts.results.get(o.value) ?? 0 }))}
                picked={draft.results}
                onToggle={(v) => toggleValue('results', v)}
              />
            </Field>
          </div>

          {/* THE SAME FOOTER THE `/trades` PANELS USE, so Clear/Cancel/Apply behave identically on
              every filtering surface in the product. Clear COMMITS and closes - see its own note. */}
          <PanelFooter
            onClear={() => commit({ products: [], results: [], q: '' })}
            onCancel={() => setOpen(false)}
            onApply={() => commit(draft)}
            clearDisabled={!anything}
            applyDisabled={!dirty}
          />
        </div>
      )}
    </div>
  );
}

/** A label over its control, which is the whole layout of this panel. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-body text-text mb-1.5 block font-medium">{label}</span>
      {children}
    </div>
  );
}

/* WHAT THE CLOSED CONTROL SAYS. "All products" while nothing is picked, the pick itself when there
   is one, a count past that: one selection is worth naming and four are worth counting. */
function summarise(picked: string[], options: Option[], empty: string): string {
  if (picked.length === 0) return empty;
  if (picked.length === 1) return options.find((o) => o.value === picked[0])?.label ?? picked[0];
  return `${picked.length} selected`;
}

/* A SELECT-SHAPED TRIGGER over a list of the panel's own tick rows.
 *
 * NOT A NATIVE `<select>`: it is multi-select, it shows counts, and it has to look like the rest of
 * Run rather than like the operating system. The rows are `Row` from `filter-rows.tsx` - the same
 * component the `/trades` panel ticks - so a checkbox behaves identically in both.
 *
 * IN FLOW, NOT OVER IT, and v2 records why: an absolutely positioned list read closer to the
 * reference and covered this panel's own footer with it, so Apply sat underneath the options - the
 * one control you need after picking. Pushing the fields below it down instead costs a taller panel
 * and cannot hide anything. It also removes the whole class of problem that comes with a popover
 * inside a popover: two outside-click handlers, a dismissal order, and a z-index that has to beat
 * its own parent. For two facets and a handful of options, none of that was buying anything. */
function Picker({
  summary,
  options,
  picked,
  onToggle,
}: {
  summary: string;
  options: (Option & { count: number })[];
  picked: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'border-border bg-bg text-body flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-3 text-left transition-colors',
          open ? 'border-accent' : 'hover:border-muted',
          picked.length > 0 ? 'text-text' : 'text-muted'
        )}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <Icon
          name="chevron"
          size={14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="border-border bg-bg mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-[var(--radius-sm)] border p-1"
        >
          {options.map((o) => (
            <Row
              key={o.value}
              label={o.label}
              trailing={o.count.toLocaleString('en-US')}
              state={picked.includes(o.value) ? 'on' : 'off'}
              onClick={() => onToggle(o.value)}
              // Greyed rather than dropped, so the list keeps its length while you tick through it.
              dead={o.count === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
