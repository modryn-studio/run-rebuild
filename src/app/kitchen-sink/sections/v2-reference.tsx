/* `run-trading@v2`'s COMPLETE HAND-DRAWN SET, all 34, as a reference sheet. Re-homed from the
 * original rack (2026-08-20).
 *
 * A REFERENCE SECTION, NOT A COMPONENT ONE, and the group it sits in says so. Every other section
 * on this page renders something the product ships; this one renders a SOURCE, so that the 17 marks
 * this build adopted can be checked against the set they came from and the 17 it did not are
 * visible rather than forgotten.
 *
 * `v2-icons.tsx` stays independent of `ui/icon.tsx` on purpose - the two hold separate copies of the
 * same path data. That is deliberate: the "one wrapper" rule is about the GEOMETRY being declared
 * once (stroke, viewBox, cap, join), never about zero duplication of paths across files with
 * different jobs. This file's job is to stay a faithful, complete snapshot of v2's whole set.
 */

import { V2_ICON_GROUPS } from './v2-icons';
import { Note, Row, Section } from '../_components/section';

export function V2ReferenceSection() {
  return (
    <Section
      id="v2-reference"
      title="v2's icon set"
      intro="The complete hand-drawn set from run-trading@v2, all 34 marks. Seventeen of these ARE the production marks in ui/icon.tsx, adopted by direct swap; the rest are here so the ones this build did not take are visible rather than quietly absent."
    >
      {V2_ICON_GROUPS.map(({ label, icons }) => (
        <Row key={label} label={label}>
          <div className="flex flex-wrap items-center gap-5">
            {icons.map(([name, V2Mark]) => (
              <span key={name} className="text-muted flex flex-col items-center gap-1.5">
                <V2Mark size={16} />
                <span className="text-micro">{name}</span>
              </span>
            ))}
          </div>
        </Row>
      ))}
      <Note>
        Every icon here is its own small component, copied in v2&apos;s own shape rather than reduced
        to a generic path-string table, so this file stays a straightforward `git diff` against the
        source instead of a re-derivation nothing else can check. Three names stayed on lucide
        because v2 draws nothing for them: `read`, `expand`, `warn`.
      </Note>
    </Section>
  );
}
