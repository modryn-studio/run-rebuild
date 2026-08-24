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
 * DROPPED FROM v2: the STATUS and PHASE axes, which read account columns no surface has labelled
 * yet, so the data genuinely does not exist here. The panel gains them back when it does.
 *
 * SEARCH IS NOT ONE OF THE CUTS, and this comment used to say it was (corrected 2026-08-19, #20).
 * It claimed search "searches trade notes", which would make it unbuildable until notes exist
 * (#10) — but `wireframes.md` §3 draws `[Search]` in this toolbar and names it in the toolbar list,
 * so it was v1 scope all along, and v2's own field matches THREE things of which notes are one.
 * It is built; see `SearchPopover` below. It matches one field fewer than v2's until notes land,
 * and the panel says so rather than inheriting a promise this build cannot keep.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { HeaderControl } from '@/components/shell/header-slot';
import { FilterSheet } from './filter-sheet';
import { IconButton } from '@/components/ui/icon-button';
import { DateInput } from '@/components/ui/date-input';
import { cn } from '@/lib/cn';
import { Head, Row, Chip } from '@/components/ui/filter-rows';
import { productName } from '@/lib/instruments';
import { facetCounts, type FacetRow } from '@/lib/trades/facets';
import type { FacetAccount } from '@/lib/trades/read';
import {
  DEFAULT_RANGE,
  RANGE_LABEL,
  RANGE_OPTIONS,
  RESULT_TOKENS,
  activeCount,
  isNarrowed,
  sheetCount,
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

/* THE PHONE'S SEARCH ROW (`S5d`, 2026-08-20).
 *
 * A PILL BELOW THE BAND, not a chip inside it. The reference's mobile screen gives search a full
 * row of its own directly under the title bar, and that is what makes the title able to be centred
 * and large: a 390px band cannot hold a centred title AND three filter chips, which is exactly what
 * broke when this page first met a phone — the chips overlapped the title, measured.
 *
 * IT IS A REAL FIELD, NOT A POPOVER TRIGGER. The desktop's `Search` is a chip that opens a panel
 * holding an input; here the input IS the row, always visible, because on a phone the panel would
 * cost a tap to reach a field that has room to simply be there.
 *
 * THE ROUND SHAPE IS THE ONE NEW THING. Run's radius scale is slot 12 / control 8 / badge 6, and a
 * pill is none of them. It is the reference's shape for this control and it reads as a search field
 * specifically — worth flagging as a system question rather than adopting silently.
 *
 * IT WRITES THE SAME `q` PARAM the desktop panel does, through the same `useParamWriter`, so the
 * two are one narrowing rather than two that happen to agree.
 */
export function TradesSearchPill({
  applied,
  products,
  accounts,
  facetRows,
}: {
  applied: TradesFilter;
  products: string[];
  accounts: FacetAccount[];
  facetRows: FacetRow[];
}) {
  const write = useParamWriter();
  const [draft, setDraft] = useState(applied.q ?? '');
  const [sheet, setSheet] = useState(false);
  /* `sheetCount`, NOT `activeCount`, and `filter.ts` argues the split. This one control opens a
     sheet holding EVERY axis including the date window, so the window has to be in its count — the
     desktop band is the surface where the window has its own button and its own dot. */
  const count = sheetCount(applied);

  // Re-seed when the applied term changes from anywhere else — the band's Clear, or a back button.
  useEffect(() => setDraft(applied.q ?? ''), [applied.q]);

  return (
    /* THE BOTTOM OF THE PAGE HEADER, AND IT STAYS PUT (Luke, 2026-08-20: "as the user scrolls, the
       main header with the search bar remains on the screen").
       `sticky top-0` against `<main>`, which is the scrollport — the shell's 64px band sits ABOVE
       main and never scrolls at all, so the two stack into one header block without either knowing
       about the other.
       `-mx-4` cancels `PAGE_COLUMN`'s gutter from the inside so the border and its shadow reach both
       screen edges while the field itself stays inset. A rule that stops 16px short of the edge
       reads as a mistake rather than as a boundary.
       NO SHADOW, JUST THE HAIRLINE (Luke, 2026-08-21: "is our shadow too prominent? maybe more
       subtle is need to match the screenshot"). It carried `--shadow-sm`, already the quietest step
       on the ramp — so "subtler" had nowhere left to go and the honest answer was none. Measured on
       the reference's own screen: the boundary between its search area and the first date band is a
       hairline and nothing else, and the two grounds either side of it are the same value, exactly
       as `bg` and `band` are here. The hairline does all the work in both.
       It is also what the house rule already says: a border OR a drop shadow, never both, and only
       `Card` gets the shadow. This header is a boundary, not a sheet.

       `-mb-4` CANCELS THE PAGE COLUMN'S `gap-4` FROM THE INSIDE. Without it the first session band
       sat 16px below the header at rest and then snapped flush the moment it stuck — measured at
       y=137 then y=120, which reads as the band changing height on scroll. The gap is right between
       the page's other children and wrong directly under a header that the content scrolls beneath.

       `border-border`, NOT `border-rule`, and that is the difference between the two tokens rather
       than a shade preference. `rule` divides SIBLINGS INSIDE one container and in light mode its
       value is literally `--color-bg` — drawn here, against the page ground, it measured
       `rgb(246,245,243)` on `rgb(246,245,243)`: invisible. This line BOUNDS the header against the
       content scrolling under it, which is an edge. See `design-system.md` §3. */
    <>
    <div className="bg-bg border-border sticky top-0 z-20 -mx-4 -mb-4 border-b px-4 pt-2 pb-3 md:hidden">
      {/* ONE FIELD, WITH THE FILTER MARK INSIDE IT. The reference puts its filter control at the
          right edge of the search field rather than beside it, which is what keeps the row to a
          single object instead of two competing ones. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          write({ q: draft.trim() || null });
        }}
        /* NOT A PILL (Luke, 2026-08-20: "the search bar is the same shape as the Text field or
           button. stay consistent with the app"). It shipped `rounded-full`, which is a shape this
           system does not have — the radius scale is slot 12 / control 8 / badge 6, and a search
           field is a CONTROL. `--radius-sm` is what `Input` and `Button` already wear.
           `h-9` (36px) matches the session band beneath it, which is the only table header visible
           at this width, and is the app's own control height (`Button md`, `HeaderControl`). It was
           48px, which read as the tallest thing on the screen. */
        className="border-border bg-surface focus-within:border-accent flex h-9 min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-3 transition-colors"
      >
        <Icon name="search" size={18} className="text-muted shrink-0" />
        {/* `text-body-lg` (16px) IS THE iOS NO-ZOOM FLOOR, not a size preference: Safari zooms the
            whole page when a focused field is under 16px, and it does not zoom back out. */}
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search"
          aria-label="Search trades"
          className="text-body-lg text-text placeholder:text-muted h-full min-w-0 flex-1 bg-transparent outline-none"
        />
        {/* THE SHEET, NOT THE POPOVER (`S5d`, 2026-08-21). The desktop panel is a three-column rail
            anchored to a chip and none of it survives 390px; `FilterSheet` is the same axes as a
            full screen of rows. The trigger keeps its dot, which is the only thing that says a
            filter is applied once the label is gone. */}
        <IconButton
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          aria-label={count > 0 ? `Filters, ${count} applied` : 'Filters'}
          className="relative -mr-1"
        >
          <Icon name="filter" size={20} />
          {/* A COUNT, NOT A DOT (2026-08-21, Luke: "the filter icon needs to have a dot with the
              number of filters applied"), and only on this control. Everywhere else in the app the
              mark is a bare dot, because everywhere else the count is ALREADY ON SCREEN — the
              desktop chips sit beside the panel that lists what they hold, so a number on the chip
              would be the same fact twice. Here the sheet is closed and the label is gone, so the
              badge is the only thing that can say how much of the tape is hidden.
              `min-w-4 px-1` rather than `size-4`: at ten or more the circle grows into a stadium
              instead of clipping a digit. */}
          {count > 0 && (
            <span
              aria-hidden
              className="bg-accent text-accent-fg text-caption absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-medium tabular-nums"
            >
              {count}
            </span>
          )}
        </IconButton>
      </form>
    </div>

    {/* OUTSIDE THE STICKY CONTAINER, and that is a stacking bug rather than tidying (2026-08-21).
        The sheet started life inside it, and `position: sticky` with a `z-index` CREATES A STACKING
        CONTEXT — so the sheet's `z-[70]` was scoped inside a `z-20` box and resolved beneath the
        shell's own `z-40` chrome. Measured: the hamburger and the bottom bar painted straight
        through a full-screen sheet.
        As a sibling it competes in the root context, where 70 actually means 70. */}
    <FilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        applied={applied}
        products={products}
        accounts={accounts}
        facetRows={facetRows}
        onApply={(d) => {
          write({
            range: d.range === DEFAULT_RANGE ? null : d.range,
            from: d.from,
            to: d.to,
            products: d.products.join(',') || null,
            results: d.results.join(',') || null,
            accounts: d.accounts.join(',') || null,
          });
          setSheet(false);
        }}
      />
    </>
  );
}

export function TradesControls({
  filter,
  products,
  accounts,
  facetRows,
}: {
  filter: TradesFilter;
  /** Every product ever traded, NOT just the ones in range — see `getFacets`. */
  products: string[];
  accounts: FacetAccount[];
  /** `(account, product) -> wins, losses`, for the panel's per-tick narrowing. */
  facetRows: FacetRow[];
}) {
  const write = useParamWriter();

  return (
    <div className="contents max-md:hidden">
      {/* CLEAR COMES FIRST AND ONLY WHEN IT DOES SOMETHING. A permanently visible Clear on an
          unfiltered page is a control that does nothing.
          PLAIN TEXT, NOT A `HeaderControl` CHIP — matching v2's `ClearAll` exactly. It is an undo,
          not a peer of Date and Filters, so it does not wear the same lift-press/lift-rest chrome
          those two do; giving it a border and a hover fill made it read as a third equal button
          instead of the escape hatch underneath them. */}
      {isNarrowed(filter) && (
        <button
          type="button"
          onClick={() =>
            write({
              range: null,
              from: null,
              to: null,
              products: null,
              results: null,
              accounts: null,
              // `q` too, or the one button that promises to clear everything leaves the search term
              // narrowing the tape while the control that set it is the only place saying so.
              q: null,
            })
          }
          className="text-body text-muted hover:text-text shrink-0 font-medium transition-colors"
        >
          Clear
        </button>
      )}
      {/* Clear, then Search, Date, Filters — v2's order, with the one undo in front of it.
          ALL OF IT IS DESKTOP-ONLY NOW (`S5d`). Below `md` the band carries a centred title instead
          and search moves to its own pill row (`TradesSearchPill`), because three chips plus a
          centred title do not fit in 390px — they overlapped, measured. */}
      <SearchPopover applied={filter} />
      <DatePopover applied={filter} />
      <FiltersPopover
        applied={filter}
        products={products}
        accounts={accounts}
        facetRows={facetRows}
      />
    </div>
  );
}

/* THE SEARCH CONTROL. `wireframes.md` §3 draws it in this toolbar, so it is v1 scope; it was missed
 * in the first S5c pass and the reason recorded for missing it was wrong (see this file's header).
 *
 * NO CLEAR OF ITS OWN. `Clear` in the band already clears every narrowing at once (Luke,
 * 2026-08-04: "same button works for all of them"). Three controls each growing their own would be
 * three words reading "Clear" that each mean something different. */
function SearchPopover({ applied }: { applied: TradesFilter }) {
  const write = useParamWriter();
  const [draft, setDraft] = useState(applied.q ?? '');
  const input = useRef<HTMLInputElement>(null);
  const { open, setOpen, toggle, root, panel } = usePopover(() => setDraft(applied.q ?? ''));

  // Autofocused. A search panel opens for exactly one reason, and putting the caret anywhere else
  // would mean a click before you can start typing.
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const commit = (q: string) => {
    write({ q: q.trim() || null });
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <HeaderControl
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
        <Icon name="search" size={15} />
        {/* THE CONTROL NAMES ITS OWN STATE: with a term applied the button reads "tradeify" rather
            than "Search", so the band says what the tape is showing instead of only that something
            is. */}
        {applied.q ? <span className="max-w-32 truncate">&ldquo;{applied.q}&rdquo;</span> : 'Search'}
        {/* A DOT, NOT A COUNT (Luke, 2026-08-04: "we have a number badge. why?"). A badge reading
            "1" counts a thing that cannot be more than one. Filters keeps its dot for the same
            reason every control in this band uses one. */}
        {applied.q && (
          <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
        )}
      </HeaderControl>

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Search trades"
          className="pop-in border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          <div className="p-4">
            <Group label="Search">
              <input
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                // Enter applies. A one-field panel whose only control is a button below the field is
                // a form, and a form that ignores Enter is a form that feels broken.
                onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
                placeholder="Enter a search term..."
                aria-label="Search trades"
                className="border-border bg-bg text-body text-text placeholder:text-muted focus:border-accent h-10 w-full rounded-[var(--radius-sm)] border px-3 outline-none"
              />
              {/* SAYS WHAT THIS ONE MATCHES. v2's line leads with notes because notes are why that
                  control exists; there are none here (#10), so the line states what is actually
                  searched rather than inheriting a promise this build cannot keep. A box that
                  silently covers a different set than an identical-looking box is worse than none. */}
              <p className="text-body text-muted mt-2 leading-relaxed">
                Matches the account, the product and the contract.
              </p>
            </Group>
          </div>
          <PanelFooter
            onClear={() => commit('')}
            onCancel={() => setOpen(false)}
            onApply={() => commit(draft)}
            clearDisabled={!draft}
            applyDisabled={draft.trim() === (applied.q ?? '')}
          />
        </div>
      )}
    </div>
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
      <HeaderControl
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-active={open ? 'true' : undefined}
        className="relative"
      >
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
          className="pop-in border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-[26rem] overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
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
                placeholder="Earliest"
                value={draft.from}
                max={draft.to}
                onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
              />
              <div className="mt-4">
                <DateField
                  label="End date"
                  placeholder="Latest"
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

/* ─── FILTERS: A DIMENSION RAIL, WHICH IS THE REFERENCE'S ACTUAL STRUCTURE ────────────────────
 *
 * Ported from `run-trading@v2`'s `SessionsFilters` (2026-08-19, S5c). This shipped first as a
 * single column of flat chip groups, which is the ROSTER's shape — and the roster gets away with it
 * because it has ONE axis worth asking about. A tape has more, and each is a different question, so
 * the left column stops being a list of OPTIONS and becomes a list of DIMENSIONS with the centre
 * swapping to whichever is selected. That is what the reference does, and it is why it carries
 * seven axes without growing.
 *
 *   left    the dimension names, each with how many of its own options are picked
 *   centre  the SELECTED dimension's options, searchable when it is the account tree
 *   right   everything picked, grouped by dimension, each group with its own Clear
 *
 * THREE AXES HERE, NOT v2's FIVE. Status and Phase read account columns no surface has labelled
 * yet, so they are absent rather than stubbed. That is fewer than the rail was designed for, and
 * the gate below is what keeps it honest: an axis with fewer than two options is dropped, because a
 * filter offering one choice cannot change anything. On a one-account corpus the Accounts axis
 * drops itself and the rail is Result and Product — v2 behaves identically on the same data.
 *
 * NO AXIS, NO CONTROL. If every axis drops, the button returns null. A menu of nothing reads as
 * broken rather than as not-yet-earned.
 */
type Dim = 'accounts' | 'results' | 'products';

/** Every axis that is a plain token list. One definition, read by `dirty`, by `total` and by the
 *  clear, so none of the three can forget an axis the others know about. */
const TOKEN_AXES = ['products', 'results'] as const;

/** The account tree gains a search field at this many accounts. Below it, scanning beats typing. */
const SEARCHABLE_FROM = 8;

type Draft = { products: string[]; results: ResultToken[]; accounts: string[] };

function FiltersPopover({
  applied,
  products,
  accounts,
  facetRows,
  trigger = 'chip',
}: {
  applied: TradesFilter;
  products: string[];
  accounts: FacetAccount[];
  /** `(account, product) -> wins, losses`. Every option list below is a projection of this,
   *  narrowed by the OTHER axes — see `lib/trades/facets.ts`. It is here rather than resolved on
   *  the server because the panel stages a draft: options that only re-narrowed after Apply would
   *  arrive after the guessing is over. */
  facetRows: FacetRow[];
  /* THE TRIGGER'S SHAPE, not the panel's contents (2026-08-20, `S5d`). On a phone this control
     lives INSIDE the search field at its right edge — the reference's arrangement — where a
     labelled chip reading "Filters" would take half the field's width. `icon` renders the mark
     alone; the panel below is identical either way, which is the point of it being a prop rather
     than a second component. */
  trigger?: 'chip' | 'icon';
}) {
  const write = useParamWriter();
  const [query, setQuery] = useState('');

  const seed = (): Draft => ({
    products: applied.products,
    results: applied.results,
    accounts: applied.accounts,
  });
  const [draft, setDraft] = useState<Draft>(seed);

  const count = activeCount(applied);

  /* THE RAIL, BUILT FROM THE DRAFT so each row can say how many of its own options are picked. */
  const dims = (
    [
      {
        key: 'accounts' as const,
        label: 'Accounts',
        picked: draft.accounts.length,
        /* SHOWN AT ONE ACCOUNT TOO (Luke, 2026-08-20: "same with the filters panel. show the
           option but dont allow the user to unselect it"). The axis used to drop below two on the
           rule that "a filter offering one choice cannot change anything" — true, but dropping it
           left the header's `AccountSelect` naming an account the panel then had no row for, which
           is the mirror breaking at exactly one account. It renders, its single row reads as
           selected, and the row refuses to turn off. */
        has: accounts.length > 0,
      },
      { key: 'results' as const, label: 'Result', picked: draft.results.length, has: true },
      {
        key: 'products' as const,
        label: 'Product',
        picked: draft.products.length,
        has: products.length > 1,
      },
    ] satisfies { key: Dim; label: string; picked: number; has: boolean }[]
  ).filter((d) => d.has);

  const [dim, setDim] = useState<Dim>(dims[0]?.key ?? 'results');

  const { open, setOpen, toggle, root, panel } = usePopover(() => {
    setDraft(seed());
    setQuery('');
    setDim(dims[0]?.key ?? 'results');
  });

  /* DERIVED FROM THE AXIS LIST, NOT HAND-ENUMERATED. v2 spelled its axes out in both of these, and
     adding a sixth left them untouched — so ticking it staged a change Apply refused to commit, the
     button sitting disabled over a draft that plainly differed. */
  const dirty =
    TOKEN_AXES.some((k) => draft[k].join() !== (applied[k] as string[]).join()) ||
    draft.accounts.join() !== applied.accounts.join();
  const total = TOKEN_AXES.reduce((n, k) => n + draft[k].length, 0) + draft.accounts.length;

  const commit = (next: Draft) => {
    write({
      products: next.products.join(',') || null,
      results: next.results.join(',') || null,
      // EVERY ACCOUNT TICKED IS NOT A FILTER, so it writes no parameter.
      accounts:
        next.accounts.length > 0 && next.accounts.length < accounts.length
          ? next.accounts.join(',')
          : null,
    });
    setOpen(false);
  };

  /* Both togglers compute from the PREVIOUS draft INSIDE the updater rather than from the values
     this render closed over. Two clicks landing in one React batch would otherwise lose the first,
     silently — the exact double-click bug v2's own postcheck found in this panel. */
  const toggleToken = (key: 'products' | 'results', v: string) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return { ...d, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] } as Draft;
    });

  /** One account means the Accounts axis is a statement rather than a choice — see the Row below. */
  const onlyAccount = accounts.length === 1;

  /* `mode` SAYS WHAT THE CALLER MEANT rather than what it had measured, for the same reason. */
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

  const clearDim = (key: Dim) => setDraft((d) => ({ ...d, [key]: [] }) as Draft);

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  /* THE SMART PART. Every list below is recomputed on each tick against the DRAFT, so picking an
     account immediately shows the products traded on it rather than every product in the corpus
     (Luke, v2 2026-08-05: "so im always guessing"). `facetCounts` excludes each axis from its own
     narrowing, which is what keeps a second product addable after the first is picked. */
  const counts = useMemo(() => facetCounts(facetRows, draft), [facetRows, draft]);

  /** Accounts grouped by firm, which is the tree's whole structure. */
  const tree = useMemo(() => {
    const groups = new Map<string, FacetAccount[]>();
    for (const a of accounts) {
      if (!groups.has(a.firm)) groups.set(a.firm, []);
      groups.get(a.firm)!.push(a);
    }
    return [...groups].map(([firm, list]) => ({ firm, accounts: list }));
  }, [accounts]);

  const shownTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((g) => ({
        firm: g.firm,
        // A firm matching by NAME keeps all of its accounts, so typing a firm selects the group.
        accounts: g.firm.toLowerCase().includes(q)
          ? g.accounts
          : g.accounts.filter((a) => a.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.accounts.length > 0);
  }, [tree, query]);

  const picked = new Set(draft.accounts);

  /* SHORT LISTS DROP WHAT MATCHES NOTHING; the long ones keep it and grey it (see `Row`'s `dead`).
     Result is two rows, so it drops. A ticked option is never dropped, or the trader loses the way
     back out of a filter they applied. */
  const resultOpts = RESULT_TOKENS.map((r) => ({
    value: r,
    label: r === 'win' ? 'Wins' : 'Losses',
    count: counts.results.get(r) ?? 0,
  })).filter((o) => o.count > 0 || draft.results.includes(o.value));

  /* PRODUCTS KEEP EVERY ROW and grey the empty ones. It is the long list in this panel — the one
     the narrowing was asked for — so it is the one that must not jump under the cursor. */
  const productOpts = products.map((p) => ({
    value: p,
    label: productName(p) ?? p,
    count: counts.products.get(p) ?? 0,
  }));

  if (dims.length === 0) return null;

  return (
    <div ref={root} className="relative">
      {trigger === 'icon' ? (
        /* A BARE MARK INSIDE THE SEARCH FIELD. `IconButton` rather than `HeaderControl`: on a phone
           that component already resolves to the glyph alone (`.icon-btn`), so this is the app's
           existing touch control rather than a new one. It keeps the corner dot, which is the only
           thing that says a filter is applied once the label is gone. */
        <IconButton
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Filters"
          data-active={open ? 'true' : undefined}
          className="relative -mr-1"
        >
          <Icon name="filter" size={20} />
          {count > 0 && (
            <span aria-hidden className="bg-accent absolute top-0.5 right-0.5 size-2 rounded-full" />
          )}
        </IconButton>
      ) : (
        <HeaderControl
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          data-active={open ? 'true' : undefined}
          className="relative"
        >
          <Icon name="filter" size={15} />
          Filters
          {count > 0 && (
            <span aria-hidden className="bg-accent absolute -top-0.5 -right-0.5 size-2 rounded-full" />
          )}
        </HeaderControl>
      )}

      {open && (
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Filter trades"
          className="pop-in border-border bg-surface absolute top-full right-0 z-50 mt-1.5 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)] outline-none"
        >
          <div className="divide-rule flex flex-col sm:flex-row sm:divide-x">
            {/* LEFT: the dimensions. A count rather than a tick, because a rail row is not a choice
                you make — it is a place you go, and what it reports is how much is waiting there. */}
            <div className="flex shrink-0 flex-col sm:w-[8.75rem]">
              <Head>Filters</Head>
              <div className="p-2">
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
                      dim === d.key ? 'bg-hover text-text font-medium' : 'text-muted hover:bg-hover'
                    )}
                  >
                    <span className="text-body min-w-0 flex-1 truncate">{d.label}</span>
                    {d.picked > 0 && (
                      <span className="bg-accent text-accent-fg text-micro shrink-0 rounded-full px-1.5 font-semibold tabular-nums">
                        {d.picked}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* CENTRE: the selected dimension's options. The search field IS the header, and only
                the account tree has one — a list of two results is not something you search. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-rule flex h-[50px] shrink-0 items-center gap-2 border-b px-3">
                {dim === 'accounts' && accounts.length >= SEARCHABLE_FROM ? (
                  <>
                    <Icon name="search" size={15} className="text-muted shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search accounts"
                      aria-label="Search accounts"
                      className="text-body text-text placeholder:text-muted w-full min-w-0 bg-transparent outline-none"
                    />
                  </>
                ) : (
                  <span className="text-small text-muted font-medium">
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
                              // The firm is the row above. See `accountShortTitle`.
                              label={a.short}
                              trailing={(counts.accounts.get(a.id) ?? 0).toLocaleString('en-US')}
                              /* THE ONLY ACCOUNT READS AS ON AND CANNOT GO OFF. With one account
                                 "all" and "that one" select the same trades, so an empty `accounts`
                                 param already MEANS this row — showing it off would be the panel
                                 disagreeing with the tape and with the header's selector, which
                                 both say the trader is looking at that account. Turning it off
                                 would also be a no-op that lights the narrowed dot. */
                              state={onlyAccount || picked.has(a.id) ? 'on' : 'off'}
                              onClick={
                                onlyAccount ? () => {} : () => toggleAccounts([a.id], 'flip')
                              }
                              dead={(counts.accounts.get(a.id) ?? 0) === 0}
                              indent
                            />
                          ))}
                        </div>
                      );
                    })
                  )
                ) : (
                  (dim === 'results' ? resultOpts : productOpts).map((o) => (
                    <Row
                      key={o.value}
                      label={o.label}
                      trailing={o.count.toLocaleString('en-US')}
                      state={(draft[dim] as string[]).includes(o.value) ? 'on' : 'off'}
                      onClick={() => toggleToken(dim, o.value)}
                      // Only reachable on Products: Result dropped its empties above.
                      dead={o.count === 0}
                    />
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: everything picked, GROUPED BY DIMENSION with a Clear each. A group appears
                only once it holds something. */}
            <div className="hidden shrink-0 flex-col sm:flex sm:w-64">
              <Head>{total > 0 ? `${total} selected` : '0 selected'}</Head>
              <div className="scroll-thin h-[20.625rem] overflow-y-auto overscroll-contain p-2">
                {dims.map((d) => {
                  if (d.picked === 0) return null;
                  return (
                    <div key={d.key} className="mb-3 last:mb-0">
                      <div className="mb-1 flex items-center justify-between gap-2 px-1">
                        <span className="text-small text-muted font-medium">{d.label}</span>
                        <button
                          type="button"
                          onClick={() => clearDim(d.key)}
                          className="text-small text-muted hover:text-text font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      {d.key === 'accounts'
                        ? draft.accounts.map((id) => {
                            const a = byId.get(id);
                            return a ? (
                              <Chip
                                key={id}
                                label={a.firm}
                                tail={a.short}
                                onRemove={() => toggleAccounts([id], 'off')}
                              />
                            ) : null;
                          })
                        : (draft[d.key] as string[]).map((v) => (
                            <Chip
                              key={v}
                              label={
                                (d.key === 'results' ? resultOpts : productOpts).find(
                                  (o) => o.value === v
                                )?.label ?? v
                              }
                              onRemove={() => toggleToken(d.key as 'products' | 'results', v)}
                            />
                          ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* This Clear unticks the DRAFT, which is a different job from the band's: that one drops
              what is already APPLIED, including the range and the search. Same word, and the
              difference is which side of Apply you are on. */}
          <PanelFooter
            onClear={() => commit({ products: [], results: [], accounts: [] })}
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
  placeholder,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  /** What the field says while it holds no date. See `ui/date-input.tsx`. */
  placeholder: string;
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
      {/* `bg-bg`, AGAINST THE DEFAULT. This panel is `surface`, so a field wearing `surface` too
          would have no ground of its own and read as a line of text with a box drawn round it. The
          rule is the same one `Input` follows on a page: a field sits BACK from what holds it.
          "Earliest" / "Latest" rather than the UA's `mm/dd/yyyy` — see `ui/date-input.tsx` for why
          that needs a component at all. */}
      <DateInput
        size="sm"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={onChange}
        aria-label={label}
        className="bg-bg"
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
