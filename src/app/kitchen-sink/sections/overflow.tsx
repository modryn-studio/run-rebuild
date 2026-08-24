import { Row, Section } from '../_components/section';

const LONG_TITLE =
  'A title nobody planned for that keeps going well past the width of the card it was supposed to sit inside';
const LONG_TOKEN = 'supercalifragilisticexpialidocious-deployment-identifier-0f3a91c4e77b2d';

const ROWS = [
  { name: 'Ada Lovelace', email: 'ada@analyticalengine.example' },
  { name: 'A person with a considerably longer display name than the column expects', email: 'this.is.a.very.long.address.that.will.not.fit@a-long-domain-name.example' },
  { name: 'Grace', email: 'g@n.example' },
];

export function OverflowSection() {
  return (
    <Section
      id="overflow"
      title="The bad day"
      intro="Every state that shipped broken on the last build sat on this path: the long title, the unbroken token, the list that got big. It is not the exception, it is the day the user shows up."
    >
      <Row label="Long title in a card" note="wraps and balances, never clips">
        <div className="border-border max-w-sm rounded-md border p-6">
          <h4 className="text-h3 text-balance">{LONG_TITLE}</h4>
          <p className="text-small text-muted mt-2 text-pretty">
            Set with text-balance so the last line is never one orphaned word.
          </p>
        </div>
      </Row>

      <Row label="Unbroken token" note="no spaces, so nothing can wrap it without help">
        <div className="border-border max-w-sm rounded-md border p-6">
          <p className="text-small break-all">{LONG_TOKEN}</p>
          <p className="text-caption text-muted mt-4">
            break-all above. Without it this pushes the card wider than the viewport and the whole
            page scrolls sideways on a phone.
          </p>
        </div>
      </Row>

      <Row label="Truncating row" note="when the layout matters more than the full value">
        {/* border-border bounds the whole group; divide-rule separates the rows inside it - the
              outer edge and the inner lines are different jobs and now different weights. */}
        <div className="border-border divide-rule max-w-md divide-y rounded-md border">
          {ROWS.map((row) => (
            <div key={row.email} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-small truncate">{row.name}</p>
                <p className="text-caption text-muted truncate">{row.email}</p>
              </div>
              <span className="text-caption text-muted shrink-0">Active</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-muted mt-2">
          truncate needs min-w-0 on the flex child. Without it the text refuses to shrink and blows
          the row out instead, which is the single most common flexbox overflow bug.
        </p>
      </Row>

      <Row label="The list at scale" note="60 rows, standing in for 400">
        <div className="border-border divide-rule max-h-96 max-w-md divide-y overflow-y-auto rounded-md border">
          {Array.from({ length: 60 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3">
              <span className="text-small tabular-nums">Item {String(i + 1).padStart(3, '0')}</span>
              <span className="text-caption text-muted tabular-nums">{(i * 137) % 1000}</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-muted mt-2">
          tabular-nums on both columns, so nothing shifts sideways as the digits change. At four
          figures of rows this needs virtualising, and that is a decision to make before the screen
          is built, not after it stutters.
        </p>
      </Row>
    </Section>
  );
}
