'use client';

/* THE TWO PROOFS THE BOILERPLATE'S PALETTE DOES NOT MAKE: which INK a string takes, and what floor
 * a LINE has to clear.
 *
 * PORTED FROM THE ORIGINAL RACK (2026-08-20, S5 step 2), unchanged in substance. The `Colour`
 * section's palette proves SC 1.4.3 — ink on ground — and it does that well. It says nothing about
 * either of these, and `design-system.md` cites both by name ("the rack's Edges proof", "the rack's
 * Ink roles specimen"), so retiring the old route without bringing them across would have made the
 * document describe a page that no longer existed.
 *
 * A CLIENT COMPONENT, because the edge table MEASURES rather than lists: it composites each line
 * over each ground on a canvas and reads the pixel back.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/components/ui/card';
import { Note, Row, Section } from '../_components/section';

const GROUNDS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['hover', 'bg-hover'],
  ['band', 'bg-band'],
] as const;

/* EVERY LINE THIS SYSTEM CAN DRAW, AND THE JOB THAT SETS ITS FLOOR.
 *
 * Nothing proved SC 1.4.11 — the non-text contrast of a control's own edge — and that omission is
 * why a census of this build found every single border painted at one value (`--color-border`,
 * 1.30:1 on a white card in light) while `--color-rule` had zero call sites and
 * `--color-border-strong` had one. A ramp that exists only in the token file is not a ramp.
 *
 * THE FLOOR IS SET BY THE JOB, NOT BY THE TOKEN, which is the whole point of the `job` column:
 *
 *   divider   separates siblings inside a container      decoration, WCAG exempts it, no floor
 *   edge      bounds an object, or rests under a         not required information, no floor
 *             LABELLED control (a secondary button)
 *   hover     firms an edge up under the pointer         no floor: you already found the control
 *   control   IS the control — the only thing saying     SC 1.4.11, 3:1
 *             one is there (a field, a focus ring, a switch track)
 *
 * So `rule` at 1.09 is CORRECT, `border` under a labelled button at 1.30 is CORRECT, and `border`
 * on an input at 1.30 is a defect. One number, three verdicts, and the same table has to be able to
 * say all three. Read the `job` column before you read the number.
 *
 * The first pass got this wrong in the direction that looks safe: it read "interactive" as the
 * category and put the secondary button on the 3:1 edge, which is a floor that does not reach it
 * and which took its hover from a 1.47x step to 2.94x. A rule over-applied is still a rule broken.
 */
const EDGES = [
  ['border', 'border-border', 'edge', 0],
  ['rule', 'border-rule', 'divider', 0],
  ['chart-axis', 'border-[var(--chart-axis)]', 'divider', 0],
  ['border-strong', 'border-border-strong', 'hover', 0],
  /* BACK IN THE TABLE, because it is now measurable. This row is what caught the parser bug: it
     was reported at 1.09:1 in dark, which is what an oklab lightness looks like when it is read as
     a red channel. Composited properly it is 2.20, and the two modes agree. */
  ['accent/40', 'border-accent/40', 'edge', 0],
  ['accent-hover', 'border-accent-hover', 'hover', 0],
  ['field', 'border-field', 'control', 3],
  ['accent', 'border-accent', 'control', 3],
  ['neg', 'border-neg', 'control', 3],
  ['switch-off', 'border-[var(--switch-off)]', 'control', 3],
] as const;

export function EdgesSection() {
  return (
    <Section
      id="edges"
      title="Ink roles and edges"
      intro="The palette above proves an ink is legible. Nothing there proves it is in the right ROLE, and nothing there measures a LINE at all. These two do, and both floors come from the job rather than from the token."
    >
      <Row label="Ink roles" note="two tiers, and which one a string takes is a question about its job">
        {/* `max-w-md`, because a specimen has to be legible as the thing it describes. Full-bleed,
            the right-aligned metadata sat 900px from the name it is a property of, so the one
            comparison this specimen exists to make was the one thing you could not see. It is also
            the honest width: these appear in the product as a row inside a card. */}
        <div className={cn(cardSurface, 'max-w-md p-6')}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-body-lg">Continental ES</span>
            {/* METADATA: a property of the row it sits on. Scanned, never read as a sentence. */}
            <span className="num text-small text-muted">7 trades · 14 Aug</span>
          </div>
          {/* PROSE: an explanation. Meant to be read, so full ink at a size from the ramp. */}
          <p className="text-small mt-3 max-w-prose">
            Fees resolved to the cent against Cash History, so this net is the broker&rsquo;s number
            and not ours. Nothing here is derived from the commission column.
          </p>
        </div>
        <Note>
          Read the two together: the date and count recede because they are properties of the name
          beside them, and the paragraph does not, because someone has to read it. If the paragraph
          looks heavy, the fix is a smaller step on the type ramp, never a quieter ink. Muted was
          never carrying hierarchy here; it was only making sentences harder to read.
        </Note>
        <Note>
          Nothing proved this before, which is how thirty explanatory passages in the original rack
          came to be set in the ink reserved for properties. The tell was in the markup: both prose
          helpers carried `max-w-prose` and then set themselves `muted`, so the code named the job
          correctly and coloured it wrong.
        </Note>
      </Row>

      <Row label="Edges" note="only a line that IS the control carries a floor, and only those rows are marked">
        <div className="overflow-x-auto">
          <table className="text-small w-full border-collapse">
            <thead>
              <tr>
                {/* `w-px` on the two label columns, or `w-full` splits the columns evenly and the
                    five grounds - the part being measured - get squeezed. A width of 1px on a table
                    cell is the idiom for "shrink to your content". */}
                <th className="text-caption text-muted w-px p-2 text-left">line</th>
                <th className="text-caption text-muted w-px p-2 text-left">job</th>
                {GROUNDS.map(([g]) => (
                  <th key={g} className="text-caption text-muted p-2 text-left">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EDGES.map(([edge, edgeCls, job, floor]) => (
                <tr key={edge}>
                  <td className="text-caption text-muted w-px p-2 whitespace-nowrap">{edge}</td>
                  <td className="text-caption text-muted w-px p-2 whitespace-nowrap">{job}</td>
                  {GROUNDS.map(([g, groundCls]) => (
                    <EdgeCell key={g} groundCls={groundCls} edgeCls={edgeCls} floor={floor} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          The swatch is unfilled on purpose, so the number is the edge against the ground it sits on
          rather than against a fill that happens to be lighter. A control carrying its own `surface`
          fill has to clear the floor against both, and `surface` is a column here. `switch-off` is a
          FILL rather than a line and is drawn as one anyway: the track carries no edge, so the fill
          is that control&rsquo;s boundary and the same 3:1 lands on it. A switch keeps its floor
          where a button gives its back, because a switch has no label inside it to do the
          identifying.
        </Note>
      </Row>
    </Section>
  );
}

/* IT COMPOSITES ON A CANVAS RATHER THAN PARSING THE COMPUTED STRING, and that is a fix rather than
 * a flourish. Tailwind emits an alpha like `accent/40` as `color-mix`, which `getComputedStyle`
 * returns as `oklab(0.476 -0.079 0.012 / 0.4)`. An audit script read the first three numbers in
 * that string as RGB channels — an oklab LIGHTNESS of 0.476 became a red channel of 0.476/255 —
 * and reported near-black, which nearly cost `Button outline` its quiet resting edge. Painting the
 * ground, painting the edge over it and reading the pixel back lets the browser do the conversion,
 * so any colour syntax comes out right and a translucent edge reports the composite the eye gets. */
function EdgeCell({
  groundCls,
  edgeCls,
  floor,
}: {
  groundCls: string;
  edgeCls: string;
  floor: number;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const cell = ref.current;
    const swatch = cell?.querySelector('div');
    if (!cell || !swatch) return;
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const paint = (over: string, under: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = over;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((n) => {
        const x = n / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const groundStr = getComputedStyle(cell).backgroundColor;
    const ground = paint(groundStr, groundStr);
    const edge = paint(getComputedStyle(swatch).borderTopColor, groundStr);
    const x = lum(edge);
    const y = lum(ground);
    setRatio((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05));
  }, [groundCls, edgeCls]);

  const fail = floor > 0 && ratio !== null && ratio < floor;
  return (
    <td ref={ref} className={cn(groundCls, 'p-2 whitespace-nowrap')}>
      <div className={cn(edgeCls, 'mb-1 h-5 w-10 rounded-[var(--radius-xs)] border')} />
      <span className={cn('num text-micro', fail ? 'text-neg' : 'text-muted')}>
        {ratio === null ? '' : `${ratio.toFixed(2)}${fail ? ' FAIL' : ''}`}
      </span>
    </td>
  );
}
