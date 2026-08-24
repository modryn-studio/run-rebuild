import { Section } from '../_components/section';
import { Palette } from '../_components/palette';

export function ColorsSection() {
  return (
    <Section
      id="colour"
      title="Colour"
      intro="Every role in both modes, side by side, with the contrast of each pair measured off the rendered element. This is the first thing to check after recolouring @theme."
    >
      <Palette />
    </Section>
  );
}
