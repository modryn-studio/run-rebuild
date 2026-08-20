'use client';

import { useEffect, useRef, useState } from 'react';
import { Note, Row, Verdict } from './section';
import { captureBothModes, contrastRatio, parseRgb, toHex } from './measure';
import { COLOR_ROLES, CONTRAST_PAIRS } from './tokens';

type Reading = { roles: string[]; pairs: { fg: string; bg: string }[] };

/* Rows are computed as FINISHED DATA before the JSX, deliberately.
 *
 * The first version reached into nullable state from inside the markup
 * (`value={data?.light.roles[i]}`, a child component that early-returned a different element
 * shape depending on it). It measured correctly and never appeared: the effect ran, the values
 * were right, the component re-rendered with them, and the DOM never changed. Computing plain
 * arrays first and rendering one shape or the other made it work, so the markup below stays
 * dumb on purpose. If a cell ever needs to know about `data`, compute it up here instead. */
type RoleRow = { name: string; use: string; light: string; dark: string };
type PairRow = { label: string; detail: string; threshold: number; light: number | null; dark: number | null };

function ratioOf(sample: { fg: string; bg: string } | undefined): number | null {
  if (!sample) return null;
  const fg = parseRgb(sample.fg);
  const bg = parseRgb(sample.bg);
  return fg && bg ? contrastRatio(fg, bg) : null;
}

function hexOf(value: string | undefined): string {
  const rgb = value ? parseRgb(value) : null;
  return rgb ? toHex(rgb) : (value ?? '');
}

export function Palette() {
  const probes = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ light: Reading; dark: Reading } | null>(null);

  useEffect(() => {
    const host = probes.current;
    if (!host) return;

    const roleNodes = Array.from(host.querySelectorAll<HTMLElement>('[data-role]'));
    const pairNodes = Array.from(host.querySelectorAll<HTMLElement>('[data-pair]'));

    const read = (): Reading => ({
      roles: roleNodes.map((node) => getComputedStyle(node).backgroundColor),
      pairs: pairNodes.map((node) => {
        const style = getComputedStyle(node);
        return { fg: style.color, bg: style.backgroundColor };
      }),
    });

    setData(captureBothModes(read));
  }, []);

  const roleRows: RoleRow[] = data
    ? COLOR_ROLES.map((role, i) => ({
        name: role.name,
        use: role.use,
        light: data.light.roles[i] ?? '',
        dark: data.dark.roles[i] ?? '',
      }))
    : [];

  const pairRows: PairRow[] = data
    ? CONTRAST_PAIRS.map((pair, i) => ({
        label: pair.label,
        detail: `${pair.threshold.toFixed(1)}:1 minimum${pair.note ? `, ${pair.note}` : ''}`,
        threshold: pair.threshold,
        light: ratioOf(data.light.pairs[i]),
        dark: ratioOf(data.dark.pairs[i]),
      }))
    : [];

  const failures = pairRows.filter(
    (row) =>
      (row.light !== null && row.light < row.threshold) ||
      (row.dark !== null && row.dark < row.threshold)
  );

  return (
    <>
      {/* The probes. Rendered with the real utility classes so the measurement comes from the
          system rather than from a copy of it, and hidden from sight and from assistive tech
          because they are instruments, not content. */}
      <div ref={probes} className="sr-only" aria-hidden>
        {COLOR_ROLES.map((role) => (
          <div key={role.name} data-role={role.name} className={role.swatch} />
        ))}
        {CONTRAST_PAIRS.map((pair) => (
          <span key={pair.label} data-pair={pair.label} className={pair.probe}>
            probe
          </span>
        ))}
      </div>

      <Row label="Colour roles" note="both modes at once, no toggling">
        {roleRows.length === 0 ? (
          <Note>Measuring.</Note>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-caption text-muted hidden gap-4 sm:grid sm:grid-cols-3">
              <span>Token</span>
              <span>Light</span>
              <span>Dark</span>
            </div>
            {roleRows.map((row) => (
              <div key={row.name} className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                <div>
                  <code className="text-small">{row.name}</code>
                  <p className="text-caption text-muted">{row.use}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="border-border h-10 w-10 shrink-0 rounded-sm border"
                    // Not a hardcoded colour: the token's own computed value, read back off a
                    // probe rendered with the real utility class. Inline is the only way to show
                    // the other mode's value while the page sits in this one.
                    style={{ backgroundColor: row.light }}
                  />
                  <code className="text-caption text-muted">{hexOf(row.light)}</code>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="border-border h-10 w-10 shrink-0 rounded-sm border"
                    style={{ backgroundColor: row.dark }}
                  />
                  <code className="text-caption text-muted">{hexOf(row.dark)}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </Row>

      <Row label="Contrast" note="WCAG 2.2 AA, measured on the rendered pair">
        {pairRows.length === 0 ? (
          <Note>Measuring.</Note>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-caption text-muted hidden gap-4 sm:grid sm:grid-cols-3">
              <span>Pair</span>
              <span>Light</span>
              <span>Dark</span>
            </div>
            {pairRows.map((row) => (
              <div key={row.label} className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                <div>
                  <code className="text-small">{row.label}</code>
                  <p className="text-caption text-muted">{row.detail}</p>
                </div>
                <span className="flex items-center gap-2">
                  <span className="text-small tabular-nums">
                    {row.light === null ? 'not measured' : row.light.toFixed(2)}
                  </span>
                  {row.light !== null && (
                    <Verdict pass={row.light >= row.threshold}>
                      {row.light >= row.threshold ? 'AA' : 'fails'}
                    </Verdict>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-small tabular-nums">
                    {row.dark === null ? 'not measured' : row.dark.toFixed(2)}
                  </span>
                  {row.dark !== null && (
                    <Verdict pass={row.dark >= row.threshold}>
                      {row.dark >= row.threshold ? 'AA' : 'fails'}
                    </Verdict>
                  )}
                </span>
              </div>
            ))}
            {failures.length === 0 ? (
              <Note>Every pair clears AA in both modes.</Note>
            ) : (
              <Note tone="danger">
                {failures.length} pair{failures.length === 1 ? '' : 's'} below AA in at least one
                mode. Fix the token, not the component that uses it.
              </Note>
            )}
          </div>
        )}
      </Row>
    </>
  );
}
