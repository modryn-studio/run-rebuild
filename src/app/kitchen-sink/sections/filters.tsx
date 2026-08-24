'use client';

/* THE FILTER PANEL'S THREE PRIMITIVES. Added 2026-08-20, closing a house-rule violation rather than
 * adding a nicety: `Head`, `Row` and `Chip` shipped with the S5c filter panel and had no rack
 * section at all, and the standing rule is that a primitive without one has not been looked at.
 *
 * THEY ARE HERE AS A SET, NOT THREE SECTIONS, because none of them is legible alone. A tri-state
 * row only reads beside a two-state one; a chip only reads beside the row that put it there.
 */

import { useState } from 'react';
import { Head, Row as PickRow, Chip } from '@/components/ui/filter-rows';
import { Note, Row, Section } from '../_components/section';

export function FiltersSection() {
  const [picked, setPicked] = useState<string[]>(['MNQ']);
  const toggle = (v: string) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  return (
    <Section
      id="filters"
      title="Filter rows"
      intro="The three pieces a filter panel is built from: a column head, a tickable row, and a chip for something already picked. A row is a real button rather than a checkbox input, because the whole row is the target and the three-state mark is one no native checkbox draws without JS anyway."
    >
      <Row label="The three states" note="off, on, and a parent that is neither">
        <div className="border-border max-w-sm rounded-md border">
          <Head>Product</Head>
          <div className="p-2">
            <PickRow
              label="Tradeify"
              trailing="3"
              state={picked.length === 0 ? 'off' : picked.length > 1 ? 'on' : 'some'}
              onClick={() => setPicked(picked.length ? [] : ['MNQ', 'NQ'])}
              strong
            />
            <PickRow
              label="Micro Nasdaq-100"
              trailing="297"
              state={picked.includes('MNQ') ? 'on' : 'off'}
              onClick={() => toggle('MNQ')}
              indent
            />
            <PickRow
              label="E-mini Nasdaq-100"
              trailing="63"
              state={picked.includes('NQ') ? 'on' : 'off'}
              onClick={() => toggle('NQ')}
              indent
            />
          </div>
        </div>
        <Note>
          The parent row is a bulk toggle over its children, so it has a third state the children do
          not: SOME. It draws a dash rather than a tick, because a partially-ticked group rendered as
          ticked is a lie the trader has to click twice to unpick. Tick one child and watch the
          parent change without either child moving.
        </Note>
      </Row>

      <Row label="Dead rows" note="nothing left to select under the other axes">
        <div className="border-border max-w-sm rounded-md border p-2">
          <PickRow label="Micro Nasdaq-100" trailing="149" state="on" onClick={() => {}} />
          <PickRow label="E-mini Nasdaq-100" trailing="0" state="off" onClick={() => {}} dead />
          <PickRow label="Micro Russell" trailing="0" state="on" onClick={() => {}} dead />
        </div>
        <Note>
          A row with nothing behind it under the current selection stays, greyed and inert, rather
          than vanishing. ONLY THE LONG LISTS get this: a list that shrinks under the cursor is a
          list you misclick, because ticking one thing moves the next thing you were about to press.
          The short token lists drop their empties instead, and nothing jumps. THE THIRD ROW IS THE
          case that matters: it is dead AND ticked, so it stays live. Hiding the way back out of a
          filter the trader applied is worse than any of this.
        </Note>
      </Row>

      <Row label="Chip" note="one thing you picked, with its own way off">
        <div className="border-border max-w-xs rounded-md border p-2">
          <Chip label="Tradeify" tail="50K (...4873)" onRemove={() => {}} />
          <Chip label="Micro Nasdaq-100" onRemove={() => {}} />
          <Chip label="Wins" onRemove={() => {}} />
        </div>
        <Note>
          Removing from HERE rather than hunting the row back down in the centre column is the whole
          reason the panel has a third column. The account chip splits its label: the head truncates
          and the tail never does, because a plain truncate eats from the RIGHT and the four digits
          are the only thing identifying the account, while the firm is what the trader already knew.
        </Note>
      </Row>
    </Section>
  );
}
