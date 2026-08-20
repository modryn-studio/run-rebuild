'use client';

/* THE TAPE'S COLUMN CONTROL, and the bare switch track underneath it.
 *
 * A CLIENT COMPONENT, because the menu is one: it holds open state and it is the open state that
 * needs reviewing. A rack row showing only the closed trigger has looked at a third of it.
 *
 * DRIVEN BY `useState`, NOT `useTapeColumns`. The real hook writes `localStorage`, and a rack that
 * quietly rewrote the trader's own column preference just by being scrolled past would be a demo
 * with a side effect. `ColumnsMenu` takes `hidden`/`onToggle` as props precisely so its storage and
 * its rendering can be separated, and this is that separation being used.
 */

import { useState } from 'react';
import { ColumnsMenu, type TapeColumn } from '@/components/views/trades/columns-menu';
import { Track } from '@/components/ui/switch';
import { Note, Row, Section } from '../_components/section';

export function ColumnsMenuSection() {
  const [hidden, setHidden] = useState<TapeColumn[]>([]);
  const [hiddenDotted, setHiddenDotted] = useState<TapeColumn[]>(['time']);

  const toggle = (set: typeof setHidden) => (key: TapeColumn) =>
    set((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));

  return (
    <Section
      id="columns-menu"
      title="Columns menu"
      intro="Which columns the tape draws. It sits in the tape card's own header, where the reference product puts its equivalent, and it replaced a trade count that the summary rail beside it was already showing."
    >
      <Row label="Rest, and open" note="click either; the right one starts with a column hidden">
        {/* A ROW, NOT A CARD. The control lives against a card header in the product, and it is
            `ml-auto` internally, so it needs a container with a right edge to sit against or it
            renders wherever the flow leaves it. */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface flex items-center gap-4 rounded-[var(--radius)] p-4 shadow-[var(--shadow-card)]">
            <span className="text-body-lg font-medium">Trades</span>
            <ColumnsMenu hidden={hidden} onToggle={toggle(setHidden)} />
          </div>
          <div className="bg-surface flex items-center gap-4 rounded-[var(--radius)] p-4 shadow-[var(--shadow-card)]">
            <span className="text-body-lg font-medium">Trades</span>
            <ColumnsMenu hidden={hiddenDotted} onToggle={toggle(setHiddenDotted)} />
          </div>
        </div>
        <Note>
          The trigger is `Button variant=&quot;secondary&quot;`, not a bespoke chip and not
          `HeaderControl`, which is the SHELL band&apos;s control class and this is inside a card.
          It stays visibly pushed in for as long as the panel is up, which is what says which
          control the panel belongs to. That took a real CSS rule
          (`.btn-secondary[data-active=&apos;true&apos;]`): Button&apos;s variants are Tailwind
          pseudo-class utilities, which have no data-attribute form, so setting the attribute alone
          did nothing and the trigger sprang back the instant the pointer lifted.
        </Note>
        <Note>
          The dot on the second one is the same corner badge Search, Date and Filters wear: `size-2`
          at the corner of a `relative` control, not an item in the label. Inline it read as
          punctuation after the word AND it moved the label every time a column was hidden.
        </Note>
      </Row>

      <Row label="The panel" note="a menu, not a modal, and the difference is the row">
        <Note>
          The rows have NO hover ground, at rest or under the pointer. That is the distinction
          between a pop-up menu and a settings sheet: a `Switch` row carries `slotSurface`, a
          recessed ground that steps up on hover, which is right when each row IS its own slot in a
          modal and wrong when the rows are a short list inside a small popover. Measured on the
          reference&apos;s own columns popover: its row carries exactly one rule, `cursor: default`,
          and no background in any state. The panel itself takes `Menu`&apos;s chrome (bordered,
          `p-1`, `pop-in`) because the system already had a reviewed answer for a small popover
          hanging off a header-row trigger, and there was no reason for this one to disagree
          with it.
        </Note>
        <Note>
          Only two columns are offered, and that is the honest set. The tape has four; the instrument
          is the row&apos;s SUBJECT and the result is the reason a tape exists, so a toggle for
          either would be a control that can empty the row. Account and time are the two a trader
          genuinely might not need.
        </Note>
      </Row>

      <Row label="Track" note="the switch without its row">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Track on />
            <span className="text-small text-muted">on</span>
          </div>
          <div className="flex items-center gap-2">
            <Track on={false} />
            <span className="text-small text-muted">off</span>
          </div>
        </div>
        <Note>
          Exported from `switch.tsx` for exactly this: a row that is not a title/note pair still
          needs the house toggle, and a caller that hand-rolls a second one is how two switches end
          up in a product. `Switch` is the full row and lives in its own section; this is the piece
          it is built from. The thumb is `surface` rather than white, because on a dark card #fff is
          a light bulb.
        </Note>
      </Row>
    </Section>
  );
}
