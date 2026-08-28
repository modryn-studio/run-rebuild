'use client';

/* THE PHONE'S FILTER SHEET, AND THE STATE THAT MATTERS MOST IS THE CLOSED ONE.
 *
 * THIS SECTION IS A DEBT BEING PAID, not a nicety. CLAUDE.md: "A component isn't done until it
 * appears in `/kitchen-sink` in every state, in the same commit." `FilterSheet` shipped without
 * one, and on 2026-08-24 that omission had a price. The sheet is `fixed inset-0 z-[70]` and always
 * mounted; a deploy served a stale stylesheet, the single rule holding it off-screen was not in it,
 * and it painted over the entire app while `pointer-events-none` made the visible UI inert. The
 * phone could not be used. The rack is where a CLOSED overlay is rendered somewhere a person is
 * looking, which is the one place that would have shown up before a trader found it.
 *
 * IT OPENS OVER THE RACK RATHER THAN SITTING IN IT, which is the convention `trade-detail.tsx`
 * already set for `fixed inset-0`: "there is no inline specimen to render. What the rack CAN do is
 * make every one of its shapes reachable in one click." Framing it at phone width would need a
 * literal pixel size, and the rack holds no literal values.
 *
 * IT RENDERS AT DESKTOP WIDTH HERE, and that is only possible because `md:hidden` moved out of the
 * component and onto the call site in `trades-controls.tsx`. A component that erases itself above a
 * breakpoint cannot be racked, and "cannot be racked" is how this got missed the first time.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilterSheet, type FilterSheetDraft } from '@/components/views/trades/filter-sheet';
import { EMPTY_FILTER, type TradesFilter } from '@/lib/trades/filter';
import type { FacetRow } from '@/lib/trades/facets';
import { Note, Row, Section } from '../_components/section';
import { ACCOUNTS_FIXTURE } from '../_fixtures/trades';

const PRODUCTS = ['MNQ', 'MES', 'NQ', 'ES'];

/* Counts on the rows come from these, the same way the real sheet reads them off the tape's facets.
   Deliberately uneven, so a row with two digits sits beside one with three and the column can be
   judged. */
const FACETS: FacetRow[] = [
  { accountId: 'fixture-acct-1', product: 'MNQ', wins: 168, losses: 129 },
  { accountId: 'fixture-acct-1', product: 'MES', wins: 24, losses: 19 },
  { accountId: 'fixture-acct-2', product: 'NQ', wins: 9, losses: 7 },
  { accountId: 'fixture-acct-3', product: 'ES', wins: 41, losses: 38 },
];

/** Nothing narrowing: the state the tape opens in, and the one the badge must NOT mark. */
const NONE: TradesFilter = EMPTY_FILTER;

/** Two axes and a window, so the count badge reads 3 and every drill row shows a value. */
const NARROWED: TradesFilter = {
  ...EMPTY_FILTER,
  range: 'last30',
  products: ['MNQ', 'MES'],
  results: ['win'],
};

/** Every axis at once, to see a drill row grow and the chips wrap rather than truncate. */
const CROWDED: TradesFilter = {
  ...EMPTY_FILTER,
  products: PRODUCTS,
  results: ['win', 'loss'],
  accounts: ACCOUNTS_FIXTURE.map((a) => a.id),
};

/** One account, pinned. What an account's own trades screen passes. */
const PINNED: TradesFilter = { ...EMPTY_FILTER, accounts: [ACCOUNTS_FIXTURE[0].id] };

const CASES: { label: string; applied: TradesFilter; note: string; locked?: string[] }[] = [
  { label: 'Nothing applied', applied: NONE, note: 'every drill row bare, All time ticked' },
  {
    label: 'Three narrowings',
    applied: NARROWED,
    note: 'chips on the rows, a window on the date row',
  },
  {
    label: 'Every axis',
    applied: CROWDED,
    note: 'the rows grow and the chips wrap; no cap and no +N',
  },
  {
    label: 'One account, locked',
    applied: PINNED,
    locked: [ACCOUNTS_FIXTURE[0].id],
    note: 'the chip has no x and the row does not drill in',
  },
];

export function FilterSheetSection() {
  const [open, setOpen] = useState<number | null>(null);
  // What Apply/Clear last committed, so the rack shows the sheet actually doing its job rather than
  // swallowing the press. The real surface writes this to the URL.
  const [committed, setCommitted] = useState<FilterSheetDraft | null>(null);

  const applied = open === null ? NONE : CASES[open].applied;

  return (
    <Section
      id="filter-sheet"
      title="Filter sheet"
      intro="The phone's filter surface. The desktop popover is three columns anchored to a chip and none of that survives 390px, so the same axes become a screen of rows with one level of drill-in. Two screens, one sheet: the drill-in slides as a second layer on the same curve rather than as a second sheet."
    >
      <Row label="The two shapes" note="each opens the real sheet over this page">
        <div className="flex flex-wrap gap-3">
          {CASES.map((c, i) => (
            <Button key={c.label} variant="secondary" onClick={() => setOpen(i)}>
              {c.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-1">
          {CASES.map((c) => (
            <p key={c.label} className="text-small text-muted">
              <span className="text-text">{c.label}</span>, {c.note}
            </p>
          ))}
        </div>
        {committed && (
          <p className="text-small text-muted mt-3">
            Last committed: <span className="text-text">{committed.range}</span>, products{' '}
            <span className="text-text">{committed.products.length}</span>, results{' '}
            <span className="text-text">{committed.results.length}</span>
          </p>
        )}
        <Note>
          The rows show WHAT is picked rather than how many, each chip carrying its own x, and they
          grow to hold it. A locked chip has no x and its row has no chevron: on an account&apos;s own
          trades screen the account is not a choice, it is what the screen is.
        </Note>
        <Note>
          Open one and tap a quick range: single-select commits on the tap and takes the sheet down,
          because picking a range is a whole answer and there is no second tap that could refine it.
          Accounts, Result and Product stage a draft and wait for Apply, because two products is two
          taps and the tape must not move between them. Clear all commits like a range does.
        </Note>
      </Row>

      <Row label="Closed is a state, and it is the one that broke" note="rendered, not assumed">
        {/* THE SPECIMEN IS THE ABSENCE. There is nothing to see here when this is right, which is
            exactly why it was never looked at: a closed overlay leaves no mark on the page. It is
            rendered anyway, unconditionally, so that a stylesheet which fails to hide it turns this
            rack row into a full-screen panel the moment anyone loads the page. */}
        <div className="text-small text-muted">
          A closed sheet is rendered directly below this line. If you can see a panel, the build is
          wrong, and that is the entire point of this row.
        </div>
        <FilterSheet
          open={false}
          onClose={() => {}}
          applied={NONE}
          products={PRODUCTS}
          accounts={ACCOUNTS_FIXTURE}
          facetRows={FACETS}
          onApply={() => {}}
        />
        <Note>
          The position it is dismissed to is a Tailwind utility at the call site; the class only owns
          the timing. That split is what the sidebar and the summary rail already do, and it is why
          both of them survived the stylesheet that took this one down.
        </Note>
      </Row>

      {open !== null && (
        <FilterSheet
          open
          onClose={() => setOpen(null)}
          lockedAccounts={CASES[open].locked}
          applied={applied}
          products={PRODUCTS}
          accounts={ACCOUNTS_FIXTURE}
          facetRows={FACETS}
          onApply={(d) => {
            setCommitted(d);
            setOpen(null);
          }}
        />
      )}
    </Section>
  );
}
