'use client';

/* THE CHECK THIS WHOLE PAGE WAS WORTH BUILDING FOR.
 *
 * `text-body-lg` once shipped on a landing page as a token that did not exist. It compiled to
 * nothing, the line silently inherited 16px, and nobody noticed for days. The lint rule catches
 * that case now, and only that case. It cannot catch a token that exists and renders at the wrong
 * size, a scale step edited in @theme but not picked up, or a --font-heading pointing at a face
 * the browser never loaded. Those are invisible to tsc and to eslint and obvious the moment
 * something renders.
 *
 * So: read what the token DECLARES off :root, read what the element ACTUALLY renders at, and put
 * the two numbers next to each other. A step where they disagree is a step that is lying.
 *
 * Rows are computed as finished data before the JSX for the reason documented in palette.tsx:
 * reaching into nullable state from inside the markup measured correctly and never rendered.
 */

import { useEffect, useRef, useState } from 'react';
import { Note, Row, Verdict } from './section';
import { TYPE_STEPS } from './tokens';

type Metric = {
  name: string;
  declaredPx: number | null;
  renderedPx: number;
  lineHeight: string;
  weight: string;
  tracking: string;
};

function toPx(value: string, rootPx: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  return trimmed.endsWith('rem') || trimmed.endsWith('em') ? n * rootPx : n;
}

export function TypeMetrics() {
  const host = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [family, setFamily] = useState<string | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const rootPx = parseFloat(rootStyle.fontSize) || 16;

    setFamily(rootStyle.getPropertyValue('--font-heading').trim());

    const samples = Array.from(node.querySelectorAll<HTMLElement>('[data-step]'));
    setMetrics(
      samples.map((sample) => {
        const style = getComputedStyle(sample);
        const name = sample.dataset.step ?? '';
        return {
          name,
          declaredPx: toPx(rootStyle.getPropertyValue(`--text-${name}`), rootPx),
          renderedPx: parseFloat(style.fontSize),
          lineHeight: style.lineHeight,
          weight: style.fontWeight,
          tracking: style.letterSpacing,
        };
      })
    );
  }, []);

  // A face that never loaded is the most common reason a locked design system still looks
  // unstyled, and it looks entirely normal on screen if you are not comparing it to anything.
  const usingDefaultFace = family === 'system-ui';

  const rows = TYPE_STEPS.map((step, i) => {
    const metric = metrics ? metrics[i] : null;
    const missing = metric ? metric.declaredPx === null : false;
    const mismatch =
      metric && metric.declaredPx !== null
        ? Math.abs(metric.declaredPx - metric.renderedPx) > 0.5
        : false;
    return { step, metric, missing, mismatch };
  });

  return (
    <>
      <Row label="Type scale" note="declared token vs what the browser actually rendered">
        <div ref={host} className="flex flex-col gap-8">
          {rows.map(({ step, metric, missing, mismatch }) => (
            <div key={step.name}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="text-caption text-muted">{step.cls}</code>
                {metric && (
                  <span className="text-caption text-muted tabular-nums">
                    {metric.renderedPx}px / {metric.lineHeight} / {metric.weight}
                    {metric.tracking === 'normal' ? '' : ` / ${metric.tracking}`}
                  </span>
                )}
                {missing && <Verdict pass={false}>no --text-{step.name} token</Verdict>}
                {mismatch && metric && (
                  <Verdict pass={false}>
                    declares {Math.round(metric.declaredPx ?? 0)}px, renders {metric.renderedPx}px
                  </Verdict>
                )}
              </div>
              <p data-step={step.name} className={`${step.cls} mt-2 text-pretty`}>
                {step.sample}
              </p>
            </div>
          ))}
        </div>
      </Row>

      <Row label="Display face" note="--font-heading">
        {family === null ? (
          <Note>Measuring.</Note>
        ) : usingDefaultFace ? (
          <Note tone="danger">
            Still system-ui. The boilerplate ships that as a placeholder with a TODO on it, and
            shipping a framework default as the brand face is what unstyled output looks like.
            Pick a real display face and point --font-heading at it.
          </Note>
        ) : (
          <Note>
            Resolved to {family}. Confirm the glyphs above are actually that face, not a fallback.
          </Note>
        )}
      </Row>
    </>
  );
}
