import { Card } from '@/components/ui/card';
import { Note, Row, Section } from '../_components/section';

export function CardSection() {
  return (
    <Section
      id="card"
      title="Card"
      intro="The one raised surface: a lighter ground plus a shadow, and no hairline. A drawn edge and a cast shadow are two claims about the same object, and running both is why a bordered-and-shadowed card always looks slightly cheap. Buttons keep their edge on purpose (see Button): a card is a region you read, a button is a thing you hit, and an edge is how a hit target says where it ends."
    >
      <Row label="On the page" note="bg-surface + shadow-card, no border">
        <Card className="max-w-sm p-6">
          <p className="text-h3">A raised object</p>
          <p className="text-body text-muted mt-2 text-pretty">
            Surface is lighter than the page in both modes, so the lift comes from the ground
            changing, not from an outline. Check this in dark mode: it still lifts.
          </p>
        </Card>
      </Row>

      {/* ADDED 2026-08-20, because the rack was showing a padding the product does not ship. The
          only specimen here was `p-6`, so a reader comparing this section against /trades found a
          4px difference and no way to tell which was right. Both are correct; they are different
          kinds of card, and the rack has to say so rather than pick one. */}
      <Row label="Padding is the caller's" note="24 for a form card, 20 for a card of rows">
        <div className="flex flex-wrap items-start gap-4">
          <Card className="max-w-xs p-6">
            <p className="text-body-lg">A form card</p>
            <p className="text-body text-muted mt-2 text-pretty">
              p-6. Stacked full-width controls want the room; /login is the one that ships.
            </p>
          </Card>
          <Card className="max-w-xs px-5 py-4">
            <p className="text-body-lg">A card of rows</p>
            <p className="text-body text-muted mt-2 text-pretty">
              px-5. The tape and the summary rail, and it is the reference&apos;s own figure.
            </p>
          </Card>
        </div>
        <Note>
          20px is the card gutter measured on `app.monarch.com/transactions`: its card header is
          `12px 20px`, its body `20px`, its footer `16px 20px`. Both of Run&apos;s /trades cards
          already sit on it. It is the one step this system uses that is NOT on the 4-point scale in
          `design-system.md`, and it is there on the reference&apos;s authority rather than by
          accident, which is why the scale now names it.
        </Note>
      </Row>

      <Row label="The hairline still exists" note="inside the object, not around it: border-rule">
        <Card className="max-w-sm">
          {/* border-rule, NOT border-border: this line separates two rows, it does not bound a
              control, and rule is a deliberately softer weight. See the token's own comment. */}
          <div className="border-rule border-b p-4">
            <p className="text-body">A row</p>
          </div>
          <div className="border-rule border-b p-4">
            <p className="text-body">Another row</p>
          </div>
          <div className="p-4">
            <p className="text-body">The last row carries no divider</p>
          </div>
        </Card>
      </Row>
    </Section>
  );
}
