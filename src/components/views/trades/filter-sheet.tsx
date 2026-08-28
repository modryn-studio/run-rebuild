'use client';

/* THE PHONE'S FILTER SURFACE: a full-screen sheet arriving from the bottom, with one level of
 * drill-in beneath it (`S5d`, 2026-08-21). Built against the reference's own mobile filter flow.
 *
 * WHY A SHEET AND NOT THE DESKTOP POPOVER. `FiltersPopover` is a three-column rail anchored to a
 * chip — it needs the width to show axis, options and selection side by side, and none of that
 * survives 390px. The reference solves it the way phones generally do: a screen of rows, one axis
 * per row, each drilling into its own screen. The DATA is identical; only the container changes.
 *
 * TWO SCREENS, ONE SHEET. The sheet slides once. Moving between the axis list and an axis's page is
 * a swap INSIDE it, not a second sheet — a phone that slid a new panel up per drill-in would be
 * three deep by the second tap and the way back would be ambiguous. The header says which screen
 * you are on: "Filters" with a close, or the axis name with a back arrow.
 *
 * TWO WAYS TO COMMIT, AND WHICH ONE APPLIES IS DECIDED BY THE AXIS (2026-08-21, Luke: "when a
 * different range is selected, the screen is animated away back towards the bottom of the screen to
 * immediately show the /trades page with the filter applied").
 *
 *   SINGLE-SELECT (the date window) COMMITS ON THE TAP and takes the sheet down with it. Picking a
 *   range is a whole answer — there is no second tap that could refine it, so an Apply button after
 *   it asks the trader to confirm a decision they have already finished making.
 *
 *   MULTI-SELECT (accounts, result, product) STAGES A DRAFT AND COMMITS ON APPLY, exactly like the
 *   desktop panel and for the same reason: "ES and NQ" is two taps, and a tape that re-queried
 *   between them would move under the trader mid-question.
 *
 * A single-select commit carries whatever the multi-select pages have already staged, so a trader
 * who picks two products and then a range gets one query holding all three, not a range that threw
 * the products away.
 */

import { SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { BOTTOM_BAR_H } from '@/lib/shell';
import { useOverlayBack } from '@/lib/overlay-back';
import type { FacetAccount } from '@/lib/trades/read';
import type { FacetRow } from '@/lib/trades/facets';
import { productName } from '@/lib/instruments';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/accounts/roster-filter';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES } from '@/lib/db/schema';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import {
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  RANGE_LABEL,
  RESULT_TOKENS,
  type Range,
  type ResultToken,
  type TradesFilter,
} from '@/lib/trades/filter';

export type FilterSheetDraft = {
  range: Range;
  from: string | null;
  to: string | null;
  products: string[];
  results: ResultToken[];
  accounts: string[];
  /* THE ACCOUNT'S TWO AXES, here as well as on the desktop panel - the two surfaces write the same
     URL or they are two filters that happen to agree. That exact defect was found on this sheet
     once already (the all-accounts normalisation it did not have). */
  status: AccountStatus[];
  types: AccountType[];
};

/** Nothing narrowing at all. The state `Clear all` commits, and the state the tape opens in. */
const NOTHING: FilterSheetDraft = {
  range: DEFAULT_RANGE,
  from: null,
  to: null,
  products: [],
  results: [],
  accounts: [],
  status: [],
  types: [],
};

/** Which screen the sheet is showing. `null` is the axis list. */
type Page = null | 'date' | 'accounts' | 'results' | 'products' | 'status' | 'types';
type SubPage = Exclude<Page, null>;

const PAGE_TITLE: Record<SubPage, string> = {
  date: 'Date Range',
  accounts: 'Accounts',
  results: 'Result',
  products: 'Product',
  status: 'Status',
  types: 'Type',
};

/* THE GREY SECTION BAND. The same object the tape's session band is: a LABEL for the rows beneath
 * it, so it takes `band` ground and muted ink. `.eyebrow` is the ramp's spaced-caps role. */
function SectionBand({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow bg-band text-muted border-rule border-y px-4 py-3">{children}</p>;
}

/* A ROW THAT DRILLS IN. `min-h-14` (56px) is the reference's row height on this screen and well
 * over the 44px touch floor. The label is full ink and the current value muted beside it — the
 * label is the thing you are choosing, the value is a property of it. */
function DrillRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-rule active:bg-hover flex min-h-14 w-full items-center gap-3 border-b px-4 text-left transition-colors"
    >
      <span className="text-body-lg text-text flex-1">{label}</span>
      {value && <span className="text-body text-muted shrink-0 truncate">{value}</span>}
      <Icon name="chevron" size={18} className="text-muted shrink-0 -rotate-90" />
    </button>
  );
}

/* A ROW THAT PICKS. No chevron: it ticks in place.
 *
 * `select` IS THE ARIA ROLE, and the two are genuinely different controls rather than one with two
 * looks. `one` is a radio — picking a range REPLACES the previous answer, and a screen reader that
 * announced eight independent toggles would be describing a set the trader cannot actually reach.
 * `many` is a toggle, where any combination is legal. */
function PickRow({
  label,
  on,
  onClick,
  trailing,
  select,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  trailing?: string;
  select: 'one' | 'many';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={select === 'one' ? 'radio' : undefined}
      aria-checked={select === 'one' ? on : undefined}
      aria-pressed={select === 'many' ? on : undefined}
      className="border-rule active:bg-hover flex min-h-14 w-full items-center gap-3 border-b px-4 text-left transition-colors"
    >
      <span className={cn('text-body-lg text-text flex-1', on && 'font-medium')}>{label}</span>
      {/* `text-body-lg` to match this row's own label, for the reason `filter-rows.tsx` gives:
          a row is one size, and muted is what marks the count as secondary. */}
      {trailing && (
        <span className="text-body-lg text-muted shrink-0 tabular-nums">{trailing}</span>
      )}
      <span className="text-accent flex w-5 shrink-0 justify-center">
        {on && <Icon name="check" size={18} />}
      </span>
    </button>
  );
}

export function FilterSheet({
  open,
  onClose,
  applied,
  products,
  accounts,
  facetRows,
  onApply,
  className,
}: {
  open: boolean;
  onClose: () => void;
  applied: TradesFilter;
  products: string[];
  accounts: FacetAccount[];
  facetRows: FacetRow[];
  onApply: (d: FilterSheetDraft) => void;
  /* WHERE THIS IS ALLOWED TO EXIST IS THE CALLER'S CALL, NOT THIS COMPONENT'S. `md:hidden` used to
     be baked into the root, which is a component deciding its own breakpoint — and it made the sheet
     impossible to put in `/kitchen-sink`, because the rack runs at desktop width and the component
     erased itself there. That is not a small thing: CLAUDE.md requires a component in the rack in
     every state IN THE SAME COMMIT, and the state that would have been visible there is the CLOSED
     one, which is precisely the state that broke in production. */
  className?: string;
}) {
  const [draft, setDraft] = useState<FilterSheetDraft>(() => ({
    range: applied.range,
    from: applied.from,
    to: applied.to,
    products: applied.products,
    results: applied.results,
    accounts: applied.accounts,
    status: applied.status,
    types: applied.types,
  }));
  const [page, setPage] = useState<Page>(null);
  /* WHAT THE DRILL-IN IS STILL SHOWING WHILE IT SLIDES BACK DOWN. `page` goes null the instant Back
     is pressed, because the header has to change immediately (Luke: "the header is fine") — so
     without a second piece of state the panel would empty itself and then animate a blank box away.
     It is never reset: off-screen content costs nothing and re-opening overwrites it. */
  const [shown, setShown] = useState<SubPage>('date');
  const [customOpen, setCustomOpen] = useState(Boolean(applied.from || applied.to));
  const panel = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);

  const seed = useCallback(() => {
    setDraft({
      range: applied.range,
      from: applied.from,
      to: applied.to,
      products: applied.products,
      results: applied.results,
      accounts: applied.accounts,
      status: applied.status,
      types: applied.types,
    });
    setPage(null);
    setCustomOpen(Boolean(applied.from || applied.to));
  }, [applied]);

  /* SEEDED ON THE OPEN EDGE ONLY, not whenever `seed` changes identity (2026-08-25, postcheck).
     `seed` closes over `applied`, which is a fresh object on every server render - so this effect
     re-ran WHILE THE SHEET WAS OPEN every time the RSC returned, resetting the draft and throwing
     the trader out of a drill-in back to the axis list. Search-as-you-type makes that routine:
     type in the pill, open Filters within the debounce, tick a product, and the staged tick
     disappears when the write lands.
     The ref tracks the previous `open`, so the body runs on false -> true and nothing else. `seed`
     stays out of the deps deliberately; it is read, not observed. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      seed();
      panel.current?.focus();
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above: edge-triggered.
  }, [open]);

  /* A DRILL-IN ALWAYS ARRIVES AT ITS TOP. The layer stays mounted between visits, so a trader who
     scrolled to "Last year", went back, and opened Product would find Product already scrolled. */
  useEffect(() => {
    if (!page) return;
    setShown(page);
    if (sub.current) sub.current.scrollTop = 0;
  }, [page]);

  /* THE DEVICE BACK BUTTON DOES WHAT ESCAPE DOES, ONE LEVEL AT A TIME (2026-08-25, Luke: "if the
     page has a back arrow or 'x' button, the back button on the user's device should take the user
     back a step or close the modal/page"). Until now it did neither: this sheet is client state, so
     the OS back gesture walked straight past a full-screen panel and out of `/trades`.
     TWO REGISTRATIONS, INNERMOST LAST, because the entries stack the way the screens do. Opening
     pushes one; drilling in pushes a second on top of it. So back from Date Range lands on the axis
     list, and back again takes the sheet down - the same two steps the header's own controls make.
     NO URL for either: a staged, uncommitted draft is not a place, and writing one would make a
     half-finished filter shareable. The trade sheet passes one because a trade IS a place. */
  useOverlayBack(open, onClose);
  useOverlayBack(page !== null, () => setPage(null));

  /* ESCAPE BACKS OUT ONE LEVEL, THEN CLOSES. Dismissing the whole sheet from a sub-page would throw
     away the screen the trader was reading rather than the one they opened. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (page) setPage(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, page, onClose]);

  const rangeLabel = draft.from || draft.to ? 'Custom range' : RANGE_LABEL[draft.range];
  /* WHICH QUICK RANGE IS TICKED. A custom window overrides the shortcut, so while one is set NONE
     of them is ticked — including `all`, which would otherwise claim the tape was unnarrowed. */
  const pickedRange = (r: Range) => draft.range === r && !draft.from && !draft.to;

  const toggle = (key: 'products' | 'results' | 'accounts' | 'status' | 'types', value: string) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return {
        ...d,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });

  /* The two account axes' option lists, off the roster the sheet was handed. Sorted so the sheet
     and the desktop panel offer them in the same order. */
  const heldStatus = new Set(accounts.map((a) => a.status));
  const heldTypes = new Set(accounts.map((a) => a.accountType));
  const statusOpts = ACCOUNT_STATUSES.filter((v) => heldStatus.has(v));
  const typeOpts = ACCOUNT_TYPES.filter((v) => heldTypes.has(v));

  const byAccount = new Map<string, number>();
  const byProduct = new Map<string, number>();
  for (const r of facetRows) {
    const n = r.wins + r.losses;
    byAccount.set(r.accountId, (byAccount.get(r.accountId) ?? 0) + n);
    byProduct.set(r.product, (byProduct.get(r.product) ?? 0) + n);
  }

  return (
    <div
      className={cn('fixed inset-0 z-[70]', !open && 'pointer-events-none', className)}
      aria-hidden={!open}
      /* THE WHOLE SHEET LEAVES THE TAB ORDER WHEN CLOSED, and the guard belongs HERE rather than on
         the two content layers (2026-08-25, postcheck). Putting it on those covered the drill rows
         and missed the FOOTER, which is their sibling - so `Clear all` and `Apply` stayed focusable
         off-screen, and Enter on an invisible control wiped every filter including the date window.
         The close button in the header was outside it too.
         `aria-hidden` and `pointer-events-none` beside it hide the panel from readers and the
         pointer; neither touches the tab order. Three attributes, three different audiences. */
      inert={!open}
    >
      {/* The sheet covers the screen, so this is only ever seen during the travel. It still earns
          its place: without it the tape shows through under a sheet that has not landed. */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300 ease-out',
          open ? 'opacity-100' : 'opacity-0'
        )}
        style={{ background: 'var(--scrim-nav)' }}
      />

      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        data-open={open}
        /* `translate-y-full` HERE, NOT IN `.sheet-transition`. The class owns the timing and this
           owns the position, which is the contract `.drawer-transition` and `.panel-transition`
           already keep. It used to live in the stylesheet, and on 2026-08-24 a deploy that shipped
           a stale stylesheet therefore rendered this panel over the entire app, inert, on a phone
           that could not be used. A dismissed overlay must not depend on a hand-written rule. */
        /* THE DRILL-IN IS DROPPED WHEN THE SHEET HAS FINISHED LEAVING, not when it starts.
           `seed()` below resets `page` on OPEN, and that is one frame too late to be invisible:
           `useEffect` runs after paint, so a sheet reopened from a sub-page began its entrance
           still showing that sub-page and swapped a frame later. Resetting on close is not an
           option either — the header would flip to "Filters" while the panel is still on screen.
           So it happens in the gap, where nothing is visible to flicker. `seed()` remains the
           backstop for the case where no transition fires at all. */
        onTransitionEnd={(e) => {
          if (!open && e.target === panel.current) setPage(null);
        }}
        className={cn(
          'sheet-transition bg-surface absolute inset-0 flex flex-col outline-none',
          !open && 'translate-y-full'
        )}
      >
        {/* NO BOTTOM BORDER ON THE HEADER (Luke's spec). The first thing under it is a grey section
            band, which is already a ground change — a rule between them would be a second answer to
            a question the band has answered. Same call the tape's session bands make. */}
        <div className="relative flex h-16 shrink-0 items-center justify-center px-2">
          {/* THE WRAPPER IS POSITIONED, NOT THE BUTTON, and `icon-button.tsx` says why in its own
              header: `.lift-press` sets `position: relative` to anchor its 44px hit expander, and
              that rule is UNLAYERED so a utility passed through `className` cannot beat it. An
              `absolute` handed to `IconButton` silently resolves to `relative` plus an offset. It
              did exactly that here — the back arrow rendered inline beside the centred title
              instead of at the far left. */}
          {page && (
            <div className="absolute left-2">
              <IconButton onClick={() => setPage(null)} aria-label="Back to filters">
                <Icon name="back" size={SHEET_CONTROL_ICON} />
              </IconButton>
            </div>
          )}
          <h2 className="text-h3 text-text font-medium">{page ? PAGE_TITLE[page] : 'Filters'}</h2>
          {!page && (
            <div className="absolute right-2">
              <IconButton onClick={onClose} aria-label="Close filters">
                <Icon name="close" size={SHEET_CONTROL_ICON} />
              </IconButton>
            </div>
          )}
        </div>

        {/* TWO LAYERS, ONE CLIPPED BOX (2026-08-21, Luke: "the transition from the Filters page to
            the Date Range page is not smooth at all ... the rest of the Date Range page needs to
            animate up from the bottom of the page consistent with how the Filters page animates").
            It was a conditional swap, so the drill-in appeared in one frame — the sheet itself slid
            and the screen INSIDE it cut. Two screens in one container that behave differently read
            as a bug even when nobody can name it.
            Now the drill-in is a second layer over the list, sliding on the same `.sheet-transition`
            the sheet arrives on: same curve, same 0.3s in / 0.2s out, so the two moves are one
            declaration rather than two that resemble each other.
            The clip is what makes 100% mean "off the bottom" — this box, not the viewport, is what
            the layer travels out of, and the footer below stays put because it is identical on both
            screens and animating something that does not change is just motion. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* These two separate the two SCREENS from each other. "Closed" is the ROOT's job - see
              the `inert` there, and why putting it here instead missed the footer. */}
          <div className="absolute inset-0 overflow-y-auto" inert={page !== null}>
            <SectionBand>Date range</SectionBand>
            <DrillRow label={rangeLabel} onClick={() => setPage('date')} />

            <SectionBand>Filter by</SectionBand>
            {accounts.length > 0 && (
              <DrillRow
                label="Accounts"
                value={draft.accounts.length ? String(draft.accounts.length) : undefined}
                onClick={() => setPage('accounts')}
              />
            )}
            <DrillRow
              label="Result"
              value={draft.results.length ? String(draft.results.length) : undefined}
              onClick={() => setPage('results')}
            />
            <DrillRow
              label="Product"
              value={draft.products.length ? String(draft.products.length) : undefined}
              onClick={() => setPage('products')}
            />
            {/* Gated on the roster holding more than one answer, same as the desktop rail: an axis
                with one option is a control that cannot change anything. */}
            {typeOpts.length > 1 && (
              <DrillRow
                label="Type"
                value={draft.types.length ? String(draft.types.length) : undefined}
                onClick={() => setPage('types')}
              />
            )}
            {statusOpts.length > 1 && (
              <DrillRow
                label="Status"
                value={draft.status.length ? String(draft.status.length) : undefined}
                onClick={() => setPage('status')}
              />
            )}
          </div>

          <div
            ref={sub}
            data-open={page !== null}
            inert={page === null}
            className={cn(
              'sheet-transition bg-surface absolute inset-0 overflow-y-auto',
              page === null && 'translate-y-full'
            )}
          >
            {shown === 'date' && (
              <>
                {/* CUSTOM RANGE EXPANDS IN PLACE and everything below moves down with it (Luke's
                    spec). `grid-template-rows: 0fr -> 1fr` is the one way to transition to a
                    content-sized height without measuring it in JS; the inner element needs
                    `overflow-hidden` or its contents paint outside the collapsed track. */}
                <button
                  type="button"
                  onClick={() => setCustomOpen((v) => !v)}
                  aria-expanded={customOpen}
                  className="border-rule active:bg-hover flex min-h-14 w-full items-center gap-3 border-b px-4 text-left transition-colors"
                >
                  <span className="text-body-lg text-text flex-1">Custom range</span>
                  <Icon
                    name="chevron"
                    size={18}
                    className={cn(
                      'text-muted shrink-0 transition-transform',
                      customOpen && 'rotate-180'
                    )}
                  />
                </button>
                {/* COLLAPSED MEANS OUT OF THE TAB ORDER TOO (2026-08-25). A `0fr` track plus
                    `overflow-hidden` hides PIXELS; both date fields and both picker buttons stayed
                    focusable behind it, so tabbing through a closed Date Range walked into eight
                    stops nobody could see. Same fix, same reason, as the collapsed sidebar and this
                    sheet's own footer: `inert` is the only one of the three attributes that touches
                    the tab order. */}
                <div
                  className="border-rule grid border-b transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: customOpen ? '1fr' : '0fr' }}
                  inert={!customOpen}
                >
                  <div className="overflow-hidden">
                    {/* THE ONLY PART OF THIS SCREEN THAT KEEPS AN APPLY, and that is the difference
                        between a shortcut and a window rather than an inconsistency: a custom range
                        is not finished until BOTH ends have been considered, so committing on the
                        first field would take the sheet down mid-answer.
                        Each end bounds the other, so the two cannot cross — there is no error state
                        to write because the state cannot be reached. */}
                    <div className="flex flex-col gap-4 px-4 py-4">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-body text-text font-medium">Start date</span>
                        <DateInput
                          value={draft.from}
                          max={draft.to}
                          placeholder="Earliest"
                          aria-label="Start date"
                          onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-body text-text font-medium">End date</span>
                        <DateInput
                          value={draft.to}
                          min={draft.from}
                          placeholder="Latest"
                          aria-label="End date"
                          onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* ALL TIME IS ONE OF THE QUICK RANGES HERE, and it is NOT on the desktop panel
                    (2026-08-21, Luke). `filter.ts` argues the desktop case: a menu of narrowings
                    needs no entry that undoes the others, because Clear does that.
                    A LIST OF TICKS IS A DIFFERENT OBJECT. Every row here shows whether it is the
                    current answer, so a screen with no tick anywhere reads as "nothing selected"
                    rather than as "everything" — and the resting state of the tape would be the one
                    state this screen could not describe.
                    IT SORTS LAST (2026-08-24, Luke: "the All Time option should be below the Last
                    year option"). It led the list because `RANGES` declares it first and it is the
                    widest window - but the rows above it are a RAMP, seven days out to a year, and
                    a reset dropped at the top of a ramp is the one row that does not belong to the
                    sequence it is sitting in. At the foot it reads as the way back out of the list,
                    which is what it is. `RANGE_OPTIONS` is `RANGES` minus the default, so the ramp
                    is spelled by the module rather than re-ordered by hand here. */}
                <SectionBand>Quick ranges</SectionBand>
                <div role="radiogroup" aria-label="Quick ranges">
                  {[...RANGE_OPTIONS, DEFAULT_RANGE].map((r) => (
                    <PickRow
                      key={r}
                      select="one"
                      label={RANGE_LABEL[r]}
                      on={pickedRange(r)}
                      onClick={() => onApply({ ...draft, range: r, from: null, to: null })}
                    />
                  ))}
                </div>
              </>
            )}

            {shown === 'accounts' &&
              accounts.map((a) => (
                <PickRow
                  key={a.id}
                  select="many"
                  label={`${a.firm} ${a.short}`.trim()}
                  trailing={(byAccount.get(a.id) ?? 0).toLocaleString('en-US')}
                  /* ONE ACCOUNT READS AS ON AND CANNOT GO OFF, matching the desktop panel and the
                     header's own selector: with one account, "all" and "that one" are the same
                     set. */
                  on={accounts.length === 1 || draft.accounts.includes(a.id)}
                  onClick={() => accounts.length > 1 && toggle('accounts', a.id)}
                />
              ))}

            {shown === 'results' &&
              RESULT_TOKENS.map((t) => (
                <PickRow
                  key={t}
                  select="many"
                  label={t === 'win' ? 'Wins' : 'Losses'}
                  on={draft.results.includes(t)}
                  onClick={() => toggle('results', t)}
                />
              ))}

            {shown === 'types' &&
              typeOpts.map((v) => (
                <PickRow
                  key={v}
                  select="many"
                  label={TYPE_LABELS[v]}
                  on={draft.types.includes(v)}
                  onClick={() => toggle('types', v)}
                />
              ))}

            {shown === 'status' &&
              statusOpts.map((v) => (
                <PickRow
                  key={v}
                  select="many"
                  label={STATUS_LABELS[v]}
                  on={draft.status.includes(v)}
                  onClick={() => toggle('status', v)}
                />
              ))}

            {shown === 'products' &&
              products.map((p) => (
                <PickRow
                  key={p}
                  select="many"
                  label={productName(p) ?? p}
                  trailing={(byProduct.get(p) ?? 0).toLocaleString('en-US')}
                  on={draft.products.includes(p)}
                  onClick={() => toggle('products', p)}
                />
              ))}
          </div>
        </div>

        {/* THE FOOTER IS ON EVERY SCREEN, drill-ins included — the reference's own arrangement, and
            the right one: a trader who has just set a custom window should be able to apply without
            first navigating back up. It clears the safe area for the same reason the bottom bar
            does.
            CLEAR ALL COMMITS AND CLOSES (2026-08-21, Luke: "clicking 'clear all' clears the filters
            and closes the filters page to show the /trades page"). It used to reset the DRAFT and
            leave the sheet standing, which put the trader one Apply away from a tape that already
            looked cleared on the screen in front of them — two states for one word. Clearing is a
            whole answer, the same as picking a range is, so it commits like one. */}
        {/* THE SAME HEIGHT AS THE BOTTOM BAR, OFF THE SAME TOKEN (2026-08-25, Luke: "we should make
            the Filters page footer the same height as the /trades page footer for consistency").
            It was 60px against the bar's 56 - 12 + 36 + 12, arrived at from padding rather than
            from the thing it sits in for. A sheet that covers the tape puts its footer exactly
            where the tape's bar was, so a 4px step made the bar appear to twitch as the sheet
            landed on top of it.
            THE ARRANGEMENT IS THE BAR'S OWN, not a copy of its numbers: `--bottom-bar-h` is the
            CONTENT box on an inner row, and `env(safe-area-inset-bottom)` is padding on the
            element that actually touches the home indicator, so the painted ground runs through
            the inset. See `BottomBar` in `app-shell.tsx`, which states the same split. */}
        <div
          className="border-rule shrink-0 border-t px-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-3" style={{ height: BOTTOM_BAR_H }}>
            {/* 36px THAT TARGETS 44 (2026-08-24). `md` is the app's 36px standard action and Luke
              chose it on looks after `lg` at 48 read heavy here. That was flagged as a compromise
              against the 44px target this build holds every other phone control to - and it is not
              one, because the project already had the answer: `.lift-press` expands a 36px icon
              chip to a 44px target invisibly, and `.hit-44` is that expander on its own. The two
              most consequential taps on the phone now read at 36 and are hit at 44.
              (For the record: 36 clears WCAG 2.5.8 AA, 24x24, several times over. 44 is 2.5.5 AAA
              and Apple's HIG. This meets the stricter one at no visual cost.) */}
            <Button
              variant="secondary"
              size="md"
              className="hit-44 flex-1"
              onClick={() => onApply(NOTHING)}
            >
              Clear all
            </Button>
            <Button size="md" className="hit-44 flex-1" onClick={() => onApply(draft)}>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
