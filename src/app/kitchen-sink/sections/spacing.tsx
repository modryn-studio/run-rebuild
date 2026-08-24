import { Row, Section } from '../_components/section';
import { SPACING_STEPS } from '../_components/tokens';

export function SpacingSection() {
  return (
    <Section
      id="spacing"
      title="Spacing"
      intro="The allowed steps and no others. Rendered as bars because the useful information is the gaps: there is no 5, no 7, no 9, and nothing in between."
    >
      <Row label="Scale" note="4 8 12 16 24 32 40 48 64 80 96px">
        <div className="flex flex-col gap-2">
          {SPACING_STEPS.map((step) => (
            <div key={step.step} className="flex items-center gap-4">
              <code className="text-caption text-muted w-8 shrink-0 tabular-nums">{step.step}</code>
              <div className={`bg-accent h-2 rounded-sm ${step.cls}`} />
              <span className="text-caption text-muted tabular-nums">{step.px}px</span>
            </div>
          ))}
        </div>
      </Row>

      <Row label="Rhythm" note="8 is the base, 4 only for tight internals">
        <div className="border-border rounded-md border p-6">
          <p className="text-h3">A card at the default rhythm</p>
          <p className="text-body text-muted mt-2 text-pretty">
            Label to body is 8. Body to the next block is 24. The card pads at 24. Nothing here
            picks a number, it picks a step.
          </p>
          <div className="mt-6 flex gap-3">
            <div className="bg-surface h-10 w-24 rounded-sm" />
            <div className="bg-surface h-10 w-24 rounded-sm" />
          </div>
        </div>
      </Row>
    </Section>
  );
}
