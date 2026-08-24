import { Section } from '../_components/section';
import { TypeMetrics } from '../_components/type-metrics';

export function TypeSection() {
  return (
    <Section
      id="type"
      title="Type"
      intro="Every step set as a real sentence, with what the token declares checked against what the browser actually rendered. A step that disagrees with itself is a class that compiled to nothing."
    >
      <TypeMetrics />
    </Section>
  );
}
