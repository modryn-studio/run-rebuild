'use client';

/* THE LABEL FORM'S OWN VOCABULARY (`S6d` C3).
 *
 * The FORM is not here and cannot be: it holds a screen stack, fires a PATCH and calls
 * `router.refresh()`, so racking it would mean racking a write path. What is rackable is the three
 * controls it is assembled from, each in every state it actually reaches - including the two that
 * only appear when the data is odd.
 *
 * `FirmPicker` IS racked live, because its interesting states are all reachable by typing: the
 * resting "Most popular" list, a match, and the dead end. That last one is the state nobody renders
 * deliberately and everybody ships.
 */

import { useState } from 'react';
import { Chip, Field, SizeField, TypeRows } from '@/components/views/accounts/account-fields';
import { FirmPicker } from '@/components/views/accounts/firm-picker';
import { EndingChoice } from '@/components/views/accounts/shared';
import { ACCOUNT_ENDINGS } from '@/lib/prop-firms';
import type { AccountStatus, AccountType } from '@/lib/db/schema';
import { Note, Row, Section } from '../_components/section';

export function AccountFieldsSection() {
  const [type, setType] = useState<AccountType | null>('sim_funded');
  const [size, setSize] = useState<number | null>(100_000);
  const [offScale, setOffScale] = useState<number | null>(104_300);
  const [picked, setPicked] = useState<string | null>(null);
  /* ONE ANSWERED AND ONE NOT, side by side, because the resting state of this control is the one
     that ships wrong: an unpicked list has to read as a question rather than as a disabled row. */
  const [ending, setEnding] = useState<Record<string, AccountStatus | null>>({
    evaluation: 'passed',
    sim_funded: null,
  });

  return (
    <Section
      id="account-fields"
      title="Account fields"
      intro="The three questions Tradovate cannot answer, as the label form asks them. Two forms use these and must ask identically, which is why they are a module rather than three functions inside one screen."
    >
      <Row label="Type" note="rows with a chevron, not chips: pressing one is the answer AND the navigation">
        <div className="max-w-md">
          <TypeRows current={type} onPick={setType} />
        </div>
        <Note>
          A chip is a FILTER affordance, a thing you toggle beside other things. This is &ldquo;pick
          one, continue&rdquo;, so the row is the honest shape and the screen needs no footer button.
          The current value is ticked, because an editor that does not show what you picked is a form
          that makes you remember.
        </Note>
      </Row>

      <Row
        label="Ending"
        note="the question the close confirmation asks, and the editor asks again after a type change"
      >
        <div className="grid max-w-2xl gap-8 sm:grid-cols-2">
          {(['evaluation', 'sim_funded'] as const).map((t) => (
            <div key={t}>
              <p className="text-body text-muted mb-2 font-medium">How did it end?</p>
              <div className="flex flex-col gap-2">
                {ACCOUNT_ENDINGS[t].map((o) => (
                  <EndingChoice
                    key={o.value}
                    label={o.label}
                    on={ending[t] === o.value}
                    onPick={() => setEnding((e) => ({ ...e, [t]: o.value }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Note>
          One answered and one not, side by side, because the resting state is the one that ships
          wrong: an unpicked list has to read as a question rather than as a disabled row. The
          selected row carries a border and a tinted ground, not just accent ink: an accent border
          with no width behind it emits nothing, and the picked row ended up reading lighter than the
          two beside it.
        </Note>
        <Note>
          The words are the whole screen. There is no sub-copy under the options and no sentence
          explaining why the question appeared: an evaluation passes or fails, a funded account ends
          in good standing or blown, and which token the database stores for either is not something
          a trader should be told. Personal is not racked here because it never asks: a personal
          account only closes, and a list of one is not a choice.
        </Note>
      </Row>

      <Row label="Size" note="chips over a closed list of SKUs, never a number field">
        <div className="max-w-md">
          <SizeField value={size} onChange={setSize} hint="(read from your import)" />
        </div>
        <Note>
          Prop accounts sell in a handful of round SKUs, and a typed &ldquo;5000&rdquo; would silently
          make every percentage in the app wrong. The write path refuses an off-list size for the
          same reason, so this control cannot produce a value the server would take.
        </Note>
      </Row>

      <Row label="Size, off-scale" note="a derived value that is not a SKU keeps its own chip">
        <div className="max-w-md">
          <SizeField value={offScale} onChange={setOffScale} />
        </div>
        <Note>
          A 100K account reading 100,000 is fine; one reading 104,300 means the derivation was wrong
          about something. Snapping it to the nearest SKU would hide a broken assumption behind a
          plausible answer, so it gets a chip of its own instead.
        </Note>
      </Row>

      <Row label="Chip" note="the selected state is select-pop plus accent, never an inline color-mix">
        <div className="flex flex-wrap gap-2">
          <Chip on onClick={() => {}}>
            Selected
          </Chip>
          <Chip on={false} onClick={() => {}}>
            Not selected
          </Chip>
        </div>
        <Note>
          44px tall below <code>sm</code> and its natural height above it. Every screen that renders
          these is a modal a trader will fill in on a phone, where 29px is under the touch floor; a
          row of seven 44px chips on a desktop would read as seven buttons rather than one choice.
        </Note>
      </Row>

      <Row label="Field" note="the label over its control, shared by both forms">
        <div className="max-w-md">
          <Field label="Product" hint="(optional)">
            <div className="border-border text-body text-muted flex min-h-12 items-center rounded-[var(--radius-sm)] border px-4">
              Growth
            </div>
          </Field>
        </div>
      </Row>

      <Row label="Firm picker" note="type a name to reach the match and the dead-end states">
        <div className="max-w-md">
          <FirmPicker onPick={setPicked} />
          {picked && <p className="text-body text-muted mt-3">Picked: {picked}</p>}
        </div>
        <Note>
          A picker should open on an ANSWER, not on a list: five names a trader recognises beats
          twenty-three they have to read. Type something absent (try &ldquo;topstep&rdquo;) to see the
          dead end, which says the true thing rather than offering a request button with nothing
          behind it.
        </Note>
        <Note>
          The list is closed, and the reason is not tidiness: it is every firm on Tradovate, so a
          firm not on it is one whose accounts cannot reach Run through this rail at all. The write
          path is deliberately looser and length-caps the firm instead, because prop firms launch
          monthly and a server that hard-refuses an unlisted name turns &ldquo;we have not heard of
          yours yet&rdquo; into &ldquo;you cannot use Run&rdquo;.
        </Note>
      </Row>
    </Section>
  );
}
