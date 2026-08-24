import { Note, Row, Section } from '../_components/section';
import { RADIUS_STEPS } from '../_components/tokens';

export function SurfacesSection() {
  return (
    <Section
      id="surfaces"
      title="Surfaces and radius"
      intro="The three background layers stacked as they appear in a real screen. Dark mode almost always breaks here first: the layers collapse into each other and the depth disappears."
    >
      <Row label="Elevation" note="bg, then surface on it, then elevated on that">
        <div className="bg-bg border-border rounded-md border p-6">
          <p className="text-caption text-muted">bg</p>
          <div className="bg-surface border-border mt-3 rounded-md border p-6">
            <p className="text-caption text-muted">surface</p>
            <div className="bg-elevated border-border mt-3 rounded-md border p-6">
              <p className="text-caption text-muted">elevated</p>
            </div>
          </div>
        </div>
      </Row>

      <Row label="Radius" note="three steps, and one that is not for general use">
        <div className="flex flex-wrap gap-6">
          {RADIUS_STEPS.map((step) => (
            <div key={step.name}>
              <div className={`bg-surface border-border h-20 w-20 border ${step.cls}`} />
              <p className="text-caption mt-2">
                <code>{step.cls}</code>
              </p>
              <p className="text-caption text-muted max-w-24 text-pretty">{step.use}</p>
            </div>
          ))}
        </div>
      </Row>

      <Row label="Elevation" note="two values, and the split is drop vs inset">
        <div className="flex flex-wrap gap-6">
          <div className="bg-elevated shadow-card rounded-md p-6">
            <code className="text-caption">shadow-card</code>
            <p className="text-caption text-muted mt-1">a sheet above the page</p>
          </div>
          <div className="bg-bg shadow-press rounded-md p-6">
            <code className="text-caption">shadow-press</code>
            <p className="text-caption text-muted mt-1">a control pushed into the page</p>
          </div>
        </div>
        <Note>
          The split is DROP versus INSET, not a ramp of depths. A drop shadow claims &quot;I float
          above the page&quot;, and only Card may claim it - no button-class control ever carries
          one. An inset claims the opposite, that the surface went down, which is exactly what a
          press should say, so every button does use it. Check both in dark mode: the dark values
          are not the light ones at a different opacity, because a card and the page sit far closer
          in value on a dark ground and the alpha has to climb to say anything at all.
        </Note>
        <Note>
          THE PRESS SWATCH SITS ON <code>bg-bg</code>, NOT <code>bg-surface</code> (2026-08-20).
          Ported verbatim from base at first, where <code>surface</code> is a third, visibly grey
          tier between the page and <code>elevated</code> - so base&apos;s swatch showed a
          different FILL as well as a different shadow. Run has no such middle tier
          (<code>elevated</code> is aliased to <code>surface</code>, the one raised-card ground),
          so the same class landed the swatch on pure white, identical to the shadow-card box
          beside it, with only the shadow direction differing - true but far more subtle than what
          this row exists to show. <code>bg-bg</code> is not a stand-in: it is the exact ground
          <code>.lift-press:active</code> actually uses, since a real press transitions BOTH the
          background (to <code>--pressed-bg</code>, which equals the page in this palette) and the
          shadow at once. This demos the combined real effect instead of the shadow in isolation.
        </Note>
      </Row>

      <Row label="Border and rule" note="two weights, two jobs: a control edge is found, a divider only separates">
        {/* `bg-elevated` ON THE GROUP, AND THAT IS THE RULE RATHER THAN THE DEMO'S PREFERENCE
            (2026-08-20). This box had a border and no fill, so it sat on the PAGE - and
            `design-rules.md` is explicit that a hairline "survives INSIDE a raised object" and that
            `rule` is "measured relative to `elevated`". Drawn on the page it is out of spec, and in
            this palette it is not merely faint: `--color-rule` and `--color-bg` are the SAME value
            in light (#f6f5f3), so the dividers had exactly zero contrast and vanished. Reviewing a
            token on the one ground it is never used on is how that survives - the same failure the
            skeleton had, found the same way. */}
        <div className="border-border bg-elevated rounded-md border">
          {/* border-rule, NOT border-border, inside the box: this line separates two rows rather
              than bounding a control, which is a quieter job and gets a quieter weight. The outer
              edge above stays border-border because it bounds the whole group. */}
          <div className="border-rule border-b p-4">
            <p className="text-body">A row</p>
          </div>
          <div className="border-rule border-b p-4">
            <p className="text-body">Another row</p>
          </div>
          <div className="p-4">
            <p className="text-body">The last row carries no divider</p>
          </div>
        </div>
      </Row>
    </Section>
  );
}
