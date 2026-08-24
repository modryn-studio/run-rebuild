'use client';

/* THE TRADE DRAWER, AND THE THREE PIECES IT IS BUILT FROM.
 *
 * A CLIENT COMPONENT, because the drawer is one and because opening it is the point.
 *
 * THE DRAWER IS BEHIND A BUTTON AND CANNOT BE OTHERWISE. It is `fixed inset-0`, so it covers the
 * rack rather than sitting in it — there is no inline specimen to render. What the rack CAN do is
 * make every one of its shapes reachable in one click, which is the row below, and review its
 * parts inline, which is everything after that. A panel whose header block is fine and whose
 * quarantine block has never been rendered is a panel that has been half looked at.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TradeDrawer } from '@/components/views/trades/trade-drawer';
import { Row as FactRow, Section as FactSection, Stepper } from '@/components/views/trades/trade-drawer-body';
import type { TapeRow } from '@/lib/trades/read';
import { Note, Row, Section } from '../_components/section';
import {
  DRAWER_TRADE,
  DRAWER_TRADE_BARE,
  DRAWER_TRADE_QUARANTINED,
  DRAWER_TRADE_SHORT,
} from '../_fixtures/trades';

const CASES: { label: string; trade: TapeRow; note: string }[] = [
  { label: 'A win', trade: DRAWER_TRADE, note: 'fees, all three broker ids' },
  { label: 'A short, at a loss', trade: DRAWER_TRADE_SHORT, note: 'held two hours, 7 contracts' },
  { label: 'Quarantined', trade: DRAWER_TRADE_QUARANTINED, note: 'unknown root, direction unknown' },
  { label: 'No broker ids', trade: DRAWER_TRADE_BARE, note: 'and no fees imported' },
];

export function TradeDetailSection() {
  // Which case is open, as an index into CASES — so the steppers below can be real rather than
  // decorative, and the panel can be walked exactly the way it is walked on the tape.
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section
      id="trade-detail"
      title="Trade detail"
      intro="One trade, opened from the tape. A drawer rather than a modal, because reading a trade usually means reading the one before it too, and a drawer keeps the list on screen the whole time."
    >
      <Row label="The four shapes" note="each opens the real drawer over this page">
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
        <Note>
          Walk between them with the steppers or the arrow keys: stepping deliberately does NOT
          animate, because the panel stays mounted and only its contents swap, which is what makes
          walking the tape read as one surface rather than a panel that leaves and comes back.
          Closing does animate, on the same `.panel-transition` declaration the sidebar and the
          summary rail use, because two panels framing the work that arrive at different speeds read as two
          different products.
        </Note>
        <Note>
          It is read-only and the option to edit is not offered anywhere in it, which is a doctrine
          rather than an omission: the claim is that our numbers are the broker&apos;s numbers, and a
          DISABLED edit control would still say the idea had been entertained. Four things v2&apos;s
          drawer has are absent here because their surfaces do not exist yet in this build (the
          per-product link, the account link, notes, classification), not because they were
          reconsidered.
        </Note>
      </Row>

      <Row label="Section and Row" note="the eyebrow, and the fact list under it">
        <div className="bg-surface max-w-md rounded-[var(--radius)] p-6 shadow-[var(--shadow-card)]">
          <FactSection label="Result">
            <FactRow label="Gross">+$777.00</FactRow>
            <FactRow label="Fees">-$3.00</FactRow>
            <FactRow label="Net" strong>
              +$774.00
            </FactRow>
          </FactSection>
          <FactSection label="At the broker">
            <FactRow label="Pair" copy="777000000007">
              777000000007
            </FactRow>
            <FactRow label="Buy fill" copy="777000000003">
              777000000003
            </FactRow>
          </FactSection>
        </div>
        <Note>
          A rule between GROUPS, not between rows. The rows are already grouped by a spaced uppercase
          label, so a hairline between each one is a second answer to a question the label has
          answered. Dropping it let the row padding come down from 10px to 6px, because without a
          line to stand clear of, 10px reads as a gap rather than as a list, and it is the same figure the
          summary rail uses, so both label/value lists sit on one rhythm.
        </Note>
        <Note>
          `strong` is the one row that is the answer rather than the working. `CopyButton` has no
          independent existence and is not exported: it is reached through `Row`&apos;s `copy` prop,
          because the only values here anyone retypes are the broker ids, and a copy control on a
          price would be a control for something nobody copies. Click one: the glyph becomes a tick
          for two seconds and then gets out of the way. No toast: a toast for copying a twelve-digit
          id is a notification about a keystroke.
        </Note>
      </Row>

      <Row label="Stepper" note="enabled, and at the end of the tape">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Stepper label="Previous trade" disabled={false} onClick={() => {}}>
              <Icon name="chevron" size={18} className="rotate-180" />
            </Stepper>
            <span className="text-caption text-muted">enabled</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Stepper label="Next trade" disabled onClick={() => {}}>
              <Icon name="chevron" size={18} className="text-muted" />
            </Stepper>
            <span className="text-caption text-muted">disabled</span>
          </div>
        </div>
        <Note>
          DISABLED RATHER THAN ABSENT, unlike most controls in this product. A stepper that
          disappears at the end of the tape moves the other one, so the button under the pointer
          changes meaning mid-walk. Holding position is worth more here than the usual rule that
          nothing there says there is nothing there.
        </Note>
        <Note>
          IT KEEPS ITS DROP SHADOW, and that is not a breach of the border-or-shadow rule. These
          float over the PAGE with nothing behind them to bound against, which is the Card case
          rather than the button case: it is the one control in the product that is genuinely a
          sheet. They sit over the LIST rather than inside the panel because they are controls for
          the tape behind it, and they are hidden below `sm`, where 96px of furniture floating over a
          390px screen would cover the thing it navigates.
        </Note>
      </Row>

      {open !== null && (
        <TradeDrawer
          trade={CASES[open].trade}
          zone="UTC"
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < CASES.length - 1 ? () => setOpen(open + 1) : undefined}
          position={{ index: open, of: CASES.length }}
        />
      )}
    </Section>
  );
}
