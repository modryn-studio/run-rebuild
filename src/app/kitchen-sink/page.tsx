import type { Metadata } from 'next';
import { SinkShell } from './_components/shell';
import { ColorsSection } from './sections/colors';
import { EdgesSection } from './sections/edges';
import { TypeSection } from './sections/type';
import { SurfacesSection } from './sections/surfaces';
import { SpacingSection } from './sections/spacing';
import { MotionSection } from './sections/motion';
import { IconsSection } from './sections/icons';
import { ButtonsSection } from './sections/buttons';
import { InputsSection } from './sections/inputs';
import { CodeSection } from './sections/code';
import { ControlsSection } from './sections/controls';
import { CardSection } from './sections/card';
import { SwitchMenuSection } from './sections/switch-menu';
import { FiltersSection } from './sections/filters';
import { BrandSection } from './sections/brand';
import { InstrumentMarkSection } from './sections/instrument-mark';
import { ColumnsMenuSection } from './sections/columns-menu';
import { TradeDetailSection } from './sections/trade-detail';
import { V2ReferenceSection } from './sections/v2-reference';
import { TradesSection } from './sections/trades';
import { IntakeSection } from './sections/intake';
import { NavRowSection } from './sections/nav-row';
import { FeedbackSection } from './sections/feedback';
import { PatternsSection } from './sections/patterns';
import { OverflowSection } from './sections/overflow';
import { VoiceSection } from './sections/voice';

/* THE KITCHEN SINK: every token and every component in every state, on one route.
 *
 * WHY IT IS IN THE BOILERPLATE. The lint rule in eslint.config.mjs proves a class EXISTS. It
 * cannot prove the value is any good: an accent that fails AA against its own foreground, a
 * display face that never loaded, a danger colour that vanishes in dark mode all pass lint, pass
 * tsc, and are obvious within seconds of something rendering. This page is the other half of
 * that enforcement.
 *
 * WHY IT DOES NOT MAKE EVERY PROJECT LOOK ALIKE. It contains no literal values. No hex, no px,
 * no font name, no arbitrary Tailwind. It renders whatever is in @theme, so recolouring the
 * system recolours this page, and it has no look of its own to impose. What it carries is the
 * section list, the state matrix and the bad-day cases: method, not style.
 *
 * KEEP IT THAT WAY. The moment a value is hardcoded here, this stops being a mirror of the
 * system and starts being a second opinion about it.
 *
 * SECTIONS ARE RENDERED AS LITERAL JSX, not mapped from an array of component references. Two of
 * them are Client Components, and collecting those into a data structure for a Server Component
 * to map over is a boundary this route does not need to test. See sections.ts.
 *
 * BEFORE THE APP GOES PUBLIC: delete src/app/kitchen-sink/ (the whole directory, nothing else
 * imports it) or put it behind the admin check. The /launch gate asks.
 */

export const metadata: Metadata = {
  title: 'Kitchen sink',
};

export default function KitchenSinkPage() {
  return (
    // SinkShell owns <main> and the scroll container, so this page renders a column, not a page.
    <SinkShell>
      <div className="mx-auto max-w-4xl px-6 pb-24">
        <header className="pb-12">
          <h1 className="text-h1 text-balance">Kitchen sink</h1>
          <p className="text-body-lg mt-4 max-w-2xl text-pretty">
            Every token and every component, in every state, in both modes. Recolour the system and
            check this page before building a screen: it measures what lint cannot see.
          </p>
          <p className="text-small mt-6 max-w-2xl text-pretty">
            It is the floor, not the inventory. Every primitive added to the project gets a section
            here in the same commit, or this page quietly starts claiming to be the whole system
            while showing part of it.
          </p>
        </header>

        <ColorsSection />
        <EdgesSection />
        <TypeSection />
        <SurfacesSection />
        <SpacingSection />
        <MotionSection />
        <IconsSection />
        <ButtonsSection />
        <InputsSection />
        <CodeSection />
        <ControlsSection />
        <CardSection />
        <SwitchMenuSection />
        <FiltersSection />
        <NavRowSection />
        <FeedbackSection />
        <BrandSection />
        <InstrumentMarkSection />
        <TradesSection />
        <ColumnsMenuSection />
        <TradeDetailSection />
        <IntakeSection />
        <PatternsSection />
        <OverflowSection />
        <VoiceSection />
        <V2ReferenceSection />
      </div>
    </SinkShell>
  );
}
