/* THE INSTRUMENT MARK: seven hues, one per product root, at the two sizes the product uses.
 *
 * A SERVER COMPONENT. The mark is pure — a root in, a hue and a tint out — so there is nothing
 * here to hydrate.
 *
 * WHY IT EARNS A SECTION RATHER THAN A ROW INSIDE `Trades`. Two surfaces render it at two sizes
 * (28 on the tape, 64 in the drawer), and it carries an INVARIANT that no screen states: a micro
 * and its full-size sibling never share a hue. An invariant that only lives in a comment is one
 * nobody can see break, and this one broke — see the proof at the foot of this section.
 */

import { InstrumentMark } from '@/components/views/trades/instrument-mark';
import { MICRO_PAIRS, markHue, productName } from '@/lib/instruments';
import { Note, Row, Section, Verdict } from '../_components/section';

/* One root per hue, so all seven `--mark-N` tokens are on screen at once. Picked from the PINNED
   list where possible, because those are the marks a trader actually learns. */
const ONE_PER_HUE = ['MNQ', 'MYM', 'ES', 'NQ', 'MGC', 'YM', 'MES'];

/* Roots that render at their full width, plus the three-letter and two-letter shapes and the
   6-series, whose leading digit is the case a font's tabular figures can get wrong. */
const SHAPES = ['ES', 'MNQ', '6E', 'M6E', 'SR3', 'XYZ'];

export function InstrumentMarkSection() {
  const collisions = MICRO_PAIRS.filter(([full, micro]) => markHue(full) === markHue(micro));

  return (
    <Section
      id="instrument-mark"
      title="Instrument mark"
      intro="A hue per product root, so a scan down a tape can tell one instrument from another without reading. The size is a prop; the hue and the tint are not, because nothing may change which colour a product is."
    >
      <Row label="All seven hues" note="every --mark-N token, at tape size">
        <div className="flex flex-wrap items-center gap-3">
          {ONE_PER_HUE.map((root) => (
            <div key={root} className="flex flex-col items-center gap-1.5">
              <InstrumentMark symbol={root} />
              <span className="text-caption text-muted tabular-nums">{markHue(root)}</span>
            </div>
          ))}
        </div>
        <Note>
          Seven, not more: the mark is a scan aid, and past about seven a reader stops recognising a
          colour and starts comparing it to its neighbour. Roots beyond the pinned list hash into the
          same seven, so a product nobody has traded still gets a stable mark rather than a blank.
        </Note>
      </Row>

      <Row label="Two sizes" note="28 on the tape, 64 in the drawer">
        <div className="flex items-end gap-6">
          <div className="flex flex-col items-center gap-2">
            <InstrumentMark symbol="MNQZ7" />
            <span className="text-caption text-muted">tape</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <InstrumentMark symbol="MNQZ7" className="text-body-lg size-16" />
            <span className="text-caption text-muted">drawer</span>
          </div>
        </div>
        <Note>
          The drawer passes its size through `className` and the type scale with it, which is the
          whole reason `size` is a prop and the hue is not: a context legitimately changes how big a
          mark is, and none may change what colour a product wears. Both take a CONTRACT string
          (`MNQZ7`) rather than a root, because the expiry is stripped inside, so no caller has to
          remember to strip it, and none can forget.
        </Note>
      </Row>

      <Row label="Label shapes" note="two letters, three, and a leading digit">
        <div className="flex flex-wrap items-center gap-3">
          {SHAPES.map((root) => (
            <InstrumentMark key={root} symbol={root} />
          ))}
        </div>
        <Note>
          Three characters is the cap and the mark takes the first three, so `SR3` fits and a longer
          root truncates rather than shrinking the circle. `XYZ` is the unknown case: an unlisted
          root still gets a hue and still renders, because a trade that quarantines is one a trader
          most needs to find in a list.
        </Note>
      </Row>

      <Row label="The tint is opaque" note="the same mark on three grounds">
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-surface flex items-center gap-3 rounded-[var(--radius)] p-4 shadow-[var(--shadow-card)]">
            <InstrumentMark symbol="MNQ" />
            <span className="text-small text-muted">on a card</span>
          </div>
          <div className="bg-hover flex items-center gap-3 rounded-[var(--radius)] p-4">
            <InstrumentMark symbol="MNQ" />
            <span className="text-small text-muted">on a hovered row</span>
          </div>
          <div className="bg-surface-2 flex items-center gap-3 rounded-[var(--radius)] p-4">
            <InstrumentMark symbol="MNQ" />
            <span className="text-small text-muted">in a slot</span>
          </div>
        </div>
        <Note>
          The three read as one colour, and that is the specimen. The tint is the hue mixed into
          `surface`, NOT into transparency: mixing into transparency would make the mark
          translucent, so the row&apos;s hover ground would show through it and the instrument would
          change colour under the pointer. A mark whose colour depends on what is behind it has
          stopped being an identifier.
        </Note>
      </Row>

      {/* ─── THE INVARIANT, MEASURED ────────────────────────────────────────────────────────── */}
      <Row label="Micro and full size never match" note="every pair on the list, checked here">
        <div className="flex flex-col gap-2">
          {MICRO_PAIRS.map(([full, micro]) => {
            const clash = markHue(full) === markHue(micro);
            return (
              <div
                key={full}
                className="border-rule flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-2 last:border-b-0"
              >
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <InstrumentMark symbol={full} />
                  <span className="text-small">{productName(full) ?? full}</span>
                </div>
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <InstrumentMark symbol={micro} />
                  <span className="text-small">{productName(micro) ?? micro}</span>
                </div>
                <span className="text-caption text-muted tabular-nums">
                  {markHue(full)} / {markHue(micro)}
                </span>
                {clash && <Verdict pass={false}>Same hue</Verdict>}
              </div>
            );
          })}
        </div>
        {collisions.length === 0 ? (
          <Note>
            All {MICRO_PAIRS.length} pairs distinct. This is the one assignment in the mark that is
            about risk rather than looks: `MNQ` and `NQ` differ by 10x per point, and this corpus
            already holds the session where that exact substitution cost $2,331 in twenty minutes.
            Two products a stop distance means something different on must not look alike in a list.
          </Note>
        ) : (
          <Note tone="danger">
            {collisions.length} pair{collisions.length === 1 ? '' : 's'} share a hue:{' '}
            {collisions.map(([f, m]) => `${f}/${m}`).join(', ')}. Pin the micro to a free hue in
            `PINNED` (src/lib/instruments.ts). Every pair must differ.
          </Note>
        )}
        <Note>
          THIS ROW IS WHY THE SECTION EXISTS. `instruments.ts` claimed the rule in a comment while
          pinning only six pairs by hand; the other nine fell through to the hash, and five of them
          collided by chance (NG/MNG, HG/MHG, 6B/M6B, 6A/M6A, 6J/M6J): one mark for two products
          that differ by 10x per point. Nothing on any screen would have shown it, because a
          collision looks exactly like a correct mark until you hold the pair side by side. Found on
          2026-08-20 by rendering the invariant instead of restating it.
        </Note>
      </Row>
    </Section>
  );
}
