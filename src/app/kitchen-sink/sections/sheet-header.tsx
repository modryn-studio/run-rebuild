'use client';

/* THE ONE PHONE HEADER BAR (`ui/sheet-header.tsx`), racked (2026-08-28, postcheck).
 *
 * It moved out of `views/trades/` into `ui/` when /accounts' sheets started wearing it, and moving a
 * component into the primitives without racking it is how the primitive stops being one. §8: "A
 * component is not done until it appears in the rack in every state, in the same commit."
 *
 * THE LONG TITLE IS THE SPECIMEN THAT MATTERS. The bar centres its title inside `px-12`, which is
 * the clearance for a control at either end - and the bug this component was last fixed for was an
 * Edit control wide enough to run into that clearance. A title that truncates is the state nobody
 * renders deliberately and everybody ships.
 *
 * IT IS SHOWN AT DESKTOP WIDTH ON PURPOSE. The component deliberately does not carry its own
 * `md:hidden` (its own header says why), which is exactly what makes a specimen possible here.
 */

import { SheetHeader, SHEET_CONTROL_ICON } from '@/components/ui/sheet-header';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { Note, Row, Section } from '../_components/section';

/** The bar draws on `bg-bg`, so the specimen sits on a bordered box rather than on a card. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="border-border max-w-sm overflow-hidden rounded-[var(--radius)] border">{children}</div>;
}

const Back = (
  <IconButton aria-label="Back">
    <Icon name="chevron" size={SHEET_CONTROL_ICON} className="rotate-90" />
  </IconButton>
);

const Close = (
  <IconButton aria-label="Close">
    <Icon name="close" size={SHEET_CONTROL_ICON} />
  </IconButton>
);

const Edit = (
  <IconButton aria-label="Edit account">
    <Icon name="edit" size={SHEET_CONTROL_ICON} />
  </IconButton>
);

export function SheetHeaderSection() {
  return (
    <Section
      id="sheet-header"
      title="Sheet header"
      intro="One bar for every full-screen sheet on a phone: 64px tall, one control at the far left, the title centred, no bottom border. The header is the one thing that does not change as a trader moves between a trade, a filter and an account."
    >
      <Row label="Lead only" note="a drill-in: the one control is the way back">
        <Frame>
          <SheetHeader title="Filters" lead={Back} />
        </Frame>
        <Note>
          A screen reached by drilling INTO a row has one exit, so it has one control. Adding a
          second would make the trader guess which of them abandons the flow.
        </Note>
      </Row>

      <Row label="Lead and trail" note="a flow's screen has two exits that mean different things">
        <Frame>
          <SheetHeader title="Edit account" lead={Back} trail={Close} />
        </Frame>
        <Note>
          Back one question, or abandon the whole flow. Both have to be visible, or the arrow is
          doing a job the trader cannot see it doing.
        </Note>
      </Row>

      <Row label="Trail that acts" note="not every trail is an exit">
        <Frame>
          <SheetHeader title="TradeDay 150K" lead={Back} trail={Edit} />
        </Frame>
        <Note>
          The account panel puts Edit here. It is a mark rather than a button because a word in this
          slot at this size competes with the title it sits beside, and because every other control
          in a phone bar in this product is a {SHEET_CONTROL_ICON}px mark.
        </Note>
      </Row>

      <Row label="A title too long for the bar" note="the state nobody renders deliberately">
        <Frame>
          <SheetHeader
            title="Tradeify Advanced 150K Straight to Sim Funded"
            lead={Back}
            trail={Edit}
          />
        </Frame>
        <Note>
          It truncates rather than wrapping or pushing the controls, and the ends stay clear because
          the title is padded by the clearance the two controls need. This is the specimen the bar
          was last fixed for: a wider control ran into that clearance and the title sat off-centre.
        </Note>
      </Row>

      <Row label="No lead" note="a confirmation has nothing to go back to">
        <Frame>
          <SheetHeader title="Close this account?" lead={null} trail={Close} />
        </Frame>
        <Note>
          A confirmation interrupts rather than being a step you walked through, so there is no
          previous screen and no arrow. Its title stays a question rather than being renamed to a
          place.
        </Note>
      </Row>
    </Section>
  );
}
