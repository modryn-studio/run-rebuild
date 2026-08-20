'use client';

/* SWITCH AND MENU: the two Run-specific controls the boilerplate does not ship. Re-homed here from
 * the original rack (2026-08-20) rather than rewritten, so the reasoning each one earned survives
 * the move.
 *
 * ONE SECTION FOR BOTH, because neither is large enough to earn a nav row alone and they answer
 * adjacent questions: a Switch commits a setting immediately, a Menu picks one of a few.
 */

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Menu } from '@/components/ui/menu';
import { Note, Row, Section } from '../_components/section';

const GRAIN = [
  { value: 'day', label: 'By day' },
  { value: 'week', label: 'By week' },
  { value: 'month', label: 'By month' },
] as const;

export function SwitchMenuSection() {
  const [excludeQuarantined, setExcludeQuarantined] = useState(false);
  const [showFees, setShowFees] = useState(true);
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>('day');

  return (
    <Section
      id="switch-menu"
      title="Switch and menu"
      intro="Two controls the boilerplate has no equivalent for. A Switch is a setting that takes effect the moment it moves, so it never sits beside a Save button. A Menu picks one of a short, known list and shows the current choice as its own label, so the band says what you are looking at rather than only that a control exists."
    >
      <Row label="Switch" note="a setting that commits on the spot">
        <div className="border-border max-w-md divide-y divide-[var(--color-rule)] rounded-md border">
          <div className="p-4">
            <Switch
              on={excludeQuarantined}
              onToggle={() => setExcludeQuarantined((v) => !v)}
              title="Exclude quarantined trades"
              note="They stay visible on the tape and countable in the notice above it."
            />
          </div>
          <div className="p-4">
            <Switch
              on={showFees}
              onToggle={() => setShowFees((v) => !v)}
              title="Show fees separately"
              note="Off, the rail shows one net figure and says so in the label."
            />
          </div>
          <div className="p-4">
            <Switch
              on
              onToggle={() => {}}
              disabled
              title="Locked setting"
              note="Disabled reads as inert rather than faded: the track keeps its ground."
            />
          </div>
        </div>
        <Note>
          A title and a note, not a bare label, because a setting whose consequence is not stated is
          one a trader toggles twice to find out what it does. The third is disabled while ON, which
          is the state that is easy to get wrong: it has to still read as on, not merely as off and
          greyed.
        </Note>
      </Row>

      <Row label="Menu" note="the trigger names the current choice, not the control">
        <div className="flex flex-wrap items-center gap-4">
          <Menu value={grain} options={GRAIN} onChange={setGrain} label="Group trades by" />
        </div>
        <Note>
          The visible text is always the current choice and `label` names the control for a screen
          reader, so the band reads &ldquo;By week&rdquo; rather than &ldquo;Grain&rdquo;. It holds
          its trigger width across choices, so a menu in a right-aligned row does not shove
          everything beside it when the selection changes. Arrow keys open on the CURRENT choice
          rather than the top of the list, so the first Down moves from where you already are. It
          stays pressed while the panel is up, which is the same `data-active` the Date and Filters
          controls use.
        </Note>
      </Row>
    </Section>
  );
}
