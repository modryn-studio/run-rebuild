'use client';

/* THE PHONE'S SCOPE CHIPS, AND THE STATE THAT MATTERS MOST IS THE ONE THAT RENDERS NOTHING.
 *
 * `ScopeTabs` disappears below three chips, because "All" beside one group is a control with no
 * second state. That rule is invisible on a developer's own roster - which usually has every type in
 * it - and it is exactly the kind of gate that ships broken: an empty 44px row holding one chip, or
 * a control that vanished when a trader closed their last evaluation. So the rack renders both ends.
 *
 * IT IS RACKED AT DESKTOP WIDTH, which is only possible because `sm:hidden` lives at the call site
 * in `accounts-view.tsx` rather than inside the component. `filter-sheet.tsx`'s section is where
 * that convention was written down, and it was written down after a phone-only overlay with its own
 * breakpoint went unracked and then bricked a deploy.
 *
 * THE FIXTURE IS ACCOUNT TYPES AND NOTHING ELSE. These chips read one column, so a full
 * `RosterAccount` here would be forty fields of noise around the one being demonstrated.
 */

import { useState } from 'react';
import { ScopeTabs, type Scope } from '@/components/views/accounts/scope-tabs';
import { Note, Row, Section } from '../_components/section';

/** Every group filled, including the one with no type — the widest the row ever gets. */
const FULL = [
  { accountType: 'sim_funded' },
  { accountType: 'sim_funded' },
  { accountType: 'evaluation' },
  { accountType: 'personal' },
  { accountType: null },
];

/** Two groups: the smallest roster that still earns the control. */
const TWO = [{ accountType: 'evaluation' }, { accountType: 'personal' }];

/** One group. The control renders nothing at all, and that is the specimen. */
const ONE = [{ accountType: 'evaluation' }, { accountType: 'evaluation' }];

function Live({
  accounts,
  start = 'all',
}: {
  accounts: { accountType: string | null }[];
  start?: Scope;
}) {
  const [scope, setScope] = useState<Scope>(start);
  return <ScopeTabs accounts={accounts} scope={scope} onScope={setScope} />;
}

export function ScopeTabsSection() {
  return (
    <Section
      id="scope-tabs"
      title="Scope chips"
      intro="Which slice of the roster a phone screen is about. Picking one replots the chart AND filters the roster below it, so the two can never state different answers to one question. Chips rather than tabs: an underline says which page you are on, and this changes what the page shows."
    >
      <Row label="Every group" note="canonical order, and the unlabelled group closes the row">
        <Live accounts={FULL} />
      </Row>

      <Row label="Already narrowed" note="the picked chip takes a ground, the rest stay muted">
        <Live accounts={FULL} start="evaluation" />
      </Row>

      <Row label="Two groups" note="the smallest roster the control appears on">
        <Live accounts={TWO} />
      </Row>

      <Row label="One group" note="renders nothing: All beside itself is not a choice">
        <div className="border-border rounded-[var(--radius-sm)] border border-dashed p-3">
          <Live accounts={ONE} />
          <Note>
            The dashed box is the rack&rsquo;s, not the component&rsquo;s. It is here so an empty
            specimen is visibly empty rather than indistinguishable from a section that failed to
            render.
          </Note>
        </div>
      </Row>

      <Note>
        The row scrolls sideways rather than wrapping: four groups plus All do not fit 390px, and a
        second line would push the chart&rsquo;s figure down the one screen with no room to spare.
        Narrow the window past 390px to see it.
      </Note>
    </Section>
  );
}
