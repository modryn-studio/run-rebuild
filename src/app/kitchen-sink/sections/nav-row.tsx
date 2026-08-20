import { AccountMenu } from '@/components/shell/account-menu';
import { Note, Row, Section } from '../_components/section';

/* The sidebar's own rows, reproduced here rather than linked to, because the sink's job is to show
 * every state side by side and a real sidebar only ever shows one active row at a time. */
const ROWS = ['Colour', 'Type', 'Surfaces', 'Spacing'];

export function NavRowSection() {
  return (
    <Section
      id="nav-row"
      title="Sidebar"
      intro="The rail every project gets: nav rows, and the account row pinned to the bottom. A nav row is a place to go, as opposed to a control that acts on the shell. The rule that matters is which channel carries rank: the ground does, alone."
    >
      <Row label="Rank is the GROUND, not the ink" note="every row is full ink, including inactive">
        <div className="border-border max-w-xs rounded-md border p-3">
          <div className="flex flex-col gap-1">
            {ROWS.map((label, i) => (
              <span
                key={label}
                aria-current={i === 1 ? 'true' : undefined}
                className={
                  i === 1
                    ? 'text-small bg-selected text-text flex h-10 items-center rounded-sm px-3'
                    : 'text-small text-text hover:bg-selected flex h-10 items-center rounded-sm px-3 transition-colors'
                }
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <Note>
          Inactive rows are full ink, not muted. Demoting them makes ink and ground both say the
          same thing, which is one channel more than a short list needs, and it leaves the nav
          competing with the content it points at. Muted is this system&apos;s METADATA role, and a
          destination is not metadata.
        </Note>
      </Row>

      <Row label="Hover is the active fill" note="hover the rows above: the same ground, on purpose">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="border-border h-8 w-8 rounded-sm border" />
            <code className="text-caption text-muted">rest (page)</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-selected border-border h-8 w-8 rounded-sm border" />
            <code className="text-caption text-muted">hover and active</code>
          </div>
        </div>
        <Note>
          Two grounds, not three: a hovered row takes the exact fill an active row has. An earlier
          version gave hover its own quieter ground so that two rows could never look identical, and
          that is the more defensive choice, but this one is simpler and it is the call. The cost is
          named rather than hidden: while the pointer is in the nav, two rows carry the same fill, so
          for that moment the pointer rather than the ground is what says which row is your location.
        </Note>
      </Row>
      {/* THE ACCOUNT ROW SITS UNDER REAL NAV ROWS, WHICH IS THE WHOLE POINT OF THIS SPECIMEN
          (2026-08-20). It used to render alone in its own box, and the rack therefore showed both
          halves of the rail without ever showing them ADJACENT - so the account row sat 8px taller
          than every nav row, in production, unnoticed, until Luke put the real sidebar next to
          itself and asked. A component reviewed on its own is reviewed against nothing; the rail's
          rows have to be stacked in one column or the one thing worth checking is the one thing you
          cannot see. Same reason `filter` and `eye` are adjacent in the Icons section. */}
      <Row label="Account menu" note="the last row of the rail, so it is stacked under real nav rows">
        <div className="bg-bg max-w-xs rounded-md p-3">
          {/* Two nav rows above it, at the real geometry, purely so the boxes can be compared. */}
          <div className="mb-1 flex flex-col gap-1">
            {ROWS.slice(0, 2).map((label) => (
              <span
                key={label}
                className="text-small text-text hover:bg-selected flex h-10 items-center rounded-sm px-3 transition-colors"
              >
                {label}
              </span>
            ))}
          </div>
          {/* `image: null` is Run's shape, not base's — this build resolves the session on the
              SERVER and passes it down (avatar included), so the type carries all three fields.
              Null here is the real fallback path: no provider avatar, so the row draws the
              initial. */}
          <AccountMenu user={{ name: 'Ada Lovelace', email: 'ada@example.com', image: null }} />
        </div>
        <Note>
          Every row in this column is the same box: 40px tall, 12px of inset, a 12px gap between the
          mark and the label. The account row carried 48/8/8 and the menu items 40/10/10, which was
          three answers to one question inside a 224px column. The avatar is 28px rather than 32
          because 32 in a 40px row leaves 4px above and below and reads as wedged in.
        </Note>
        <Note>
          Pinned to the bottom of the rail with no divider above it, because spacing and a shared
          hover fill already do that job. This is the only theme control in the app: a second one
          floating in a page corner is the same job done twice, and a corner control belongs to no
          surface. The live one in the sidebar to the left is signed out, which is what
          user={'{null}'} renders.
        </Note>
      </Row>
    </Section>
  );
}
