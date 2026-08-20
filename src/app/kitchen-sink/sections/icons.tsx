'use client';

/* REWRITTEN AGAINST RUN'S OWN ICON SYSTEM (2026-08-20). The ported version was base's verbatim:
 * it imported seven raw `lucide-react` components, called them bare, and its intro claimed they
 * "read the same LucideProvider context the rest of the app does". Run has no such provider — the
 * string was true of the boilerplate and false here, which is the worst kind of rack row: it
 * asserted a mechanism that does not exist and demoed four marks Run's registry does not contain.
 *
 * Run's mechanism is different in kind, not degree. `ui/icon.tsx` holds a REGISTRY of named marks,
 * mostly hand-drawn and ported from `run-trading@v2`, with lucide as a named fallback for the few
 * v2 never drew. Every call site spells a NAME, never a component, and the wrapper fixes the stroke
 * per render. So the thing worth proving here is not "a provider is configured" but "every name in
 * the registry renders, at one size and one stroke, and none has gone missing".
 *
 * DRIVEN OFF `ICON_NAMES`, WHICH IS DERIVED FROM `MARKS` ITSELF. That export exists for this page
 * (see its own note): a name added to the registry and never grouped below appears in the
 * "unplaced" row rather than being silently absent, so this section cannot quietly stop being the
 * full inventory. Base's `sections.ts` comment makes the same argument about its own manifest.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon, ICON_NAMES, ICON_SIZE, ICON_STROKE, type IconName } from '@/components/ui/icon';
import { Note, Row, Section } from '../_components/section';

/* The registry grouped by the surface each mark serves, mirroring the comment blocks in
   `icon.tsx`. Grouping is documentation: a mark's neighbours say what it is for. */
const GROUPS: { label: string; names: IconName[] }[] = [
  { label: 'The shell', names: ['today', 'accounts', 'trades', 'read', 'settings'] },
  /* `filter` and `eye` sit side by side ON PURPOSE. They are the two marks most at risk of being
     used for each other — and were, until 2026-08-20, when the Columns control wore `filter` beside
     the Filters control on one page. Filters changes WHICH TRADES the tape holds; the eye changes
     WHICH FACTS about them are drawn. Adjacent here so the next person choosing between them sees
     both at once. */
  { label: 'Chrome and controls', names: ['collapse', 'expand', 'menu', 'search', 'close', 'check', 'chevron', 'copy', 'filter', 'eye'] },
  { label: 'Theme', names: ['moon', 'sun'] },
  { label: 'The intake flow', names: ['upload', 'file', 'files', 'unmet', 'back', 'add', 'warn'] },
  { label: 'The account menu', names: ['bolt', 'sign-out'] },
];

/* THE THREE THAT ARE NOT HAND-DRAWN, named rather than hidden. CLAUDE.md states the rule and these
   exact three as its whole exception list, so showing them keeps the page honest about a set that
   is not uniformly one thing. */
const LUCIDE_FALLBACKS: IconName[] = ['read', 'expand', 'warn'];

const placed = new Set(GROUPS.flatMap((g) => g.names));
const unplaced = ICON_NAMES.filter((n) => !placed.has(n));

export function IconsSection() {
  const host = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ sizes: string[]; strokes: string[] } | null>(null);

  // The point of a single wrapper is that every mark agrees. Reading it back off the rendered SVGs
  // is the only way to know that it did, rather than that it was supposed to.
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const svgs = Array.from(node.querySelectorAll('svg'));
    setMeasured({
      sizes: [...new Set(svgs.map((s) => String(Math.round(s.getBoundingClientRect().width))))],
      strokes: [...new Set(svgs.map((s) => getComputedStyle(s).strokeWidth))],
    });
  }, []);

  const agrees = measured && measured.sizes.length === 1 && measured.strokes.length === 1;

  return (
    <Section
      id="icons"
      title="Icons"
      intro="One registry, one wrapper, one stroke. A call site names a mark and never imports a component or passes a weight, so the set cannot drift by a call site forgetting something. Most are hand-drawn and ported from run-trading@v2; three are lucide, and they are named below rather than blended in."
    >
      <Row label="The whole registry" note="every name in MARKS, grouped by the surface it serves">
        <div ref={host} className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-caption text-muted mb-2">{g.label}</p>
              <div className="flex flex-wrap items-center gap-5">
                {g.names.map((name) => (
                  <div key={name} className="flex flex-col items-center gap-1.5">
                    <Icon name={name} />
                    <span className="text-caption text-muted">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {measured && (
          <Note tone={agrees ? 'muted' : 'danger'}>
            {agrees
              ? `All ${ICON_NAMES.length} marks render at ${measured.sizes[0]}px with a ${measured.strokes[0]} stroke, from ICON_SIZE (${ICON_SIZE}) and ICON_STROKE (${ICON_STROKE}) in ui/icon.tsx.`
              : `Drift: ${measured.sizes.length} sizes (${measured.sizes.join(', ')}) and ${measured.strokes.length} stroke widths (${measured.strokes.join(', ')}) in one set. They should all agree.`}
          </Note>
        )}
        {/* THE COMPLETENESS ASSERTION. Renders nothing in the healthy case, which is the point: it
            only speaks up when the registry has grown and this page has not. */}
        {unplaced.length > 0 && (
          <Note tone="danger">
            {unplaced.length} name{unplaced.length === 1 ? '' : 's'} in MARKS with no group on this
            page: {unplaced.join(', ')}. Add them above, or this section has stopped being the full
            inventory.
          </Note>
        )}
      </Row>

      <Row label="The three that are not hand-drawn" note="lucide, by exception and by name">
        <div className="flex flex-wrap items-center gap-5">
          {LUCIDE_FALLBACKS.map((name) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <Icon name={name} />
              <span className="text-caption text-muted">{name}</span>
            </div>
          ))}
        </div>
        <Note>
          Hand-drawn is the default and lucide is the stated fallback for the marks run-trading@v2
          never drew. They go through the same wrapper, so they carry the same 24 viewBox, the same
          1.5 stroke and the same round caps as everything above, and nothing at a call site knows
          which kind it is asking for.
        </Note>
      </Row>

      <Row label="Size is a context decision, stroke is not" note="deliberate overrides">
        <div className="flex flex-wrap items-end gap-6">
          <Icon name="accounts" />
          <Icon name="accounts" size={20} />
          <Icon name="accounts" size={24} />
        </div>
        <Note>
          The default pairs with body text. A nav row takes 20 because it is read at a glance rather
          than aimed at, and an empty state or a hero mark may go further, but none of them touch the
          weight: size is what a context legitimately changes, stroke is what has to hold across the
          set. The wrapper enforces that split by taking a size prop and no stroke prop at all.
        </Note>
      </Row>
    </Section>
  );
}
