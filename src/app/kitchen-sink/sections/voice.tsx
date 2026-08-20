import { site } from '@/config/site';
import { Row, Section } from '../_components/section';

/* House rules, shown as pairs rather than described.
 *
 * This is the part of the system that carries no colour, no size and no radius, and it is the
 * part that travels furthest: the same rules hold whatever a project ends up looking like. It is
 * also the part that was being retyped from memory on every new build, which is most of why this
 * page exists in the boilerplate at all. */
const RULES = [
  {
    rule: 'No em dashes in user-facing copy',
    why: 'Headlines, subtitles, button labels, any UI text. Comma, colon, parentheses, or a plain hyphen. Code comments and docs are exempt, and lint enforces the rest.',
    // THE ONE SANCTIONED SUPPRESSION IN THE CODEBASE, and the escape hatch the rule's own config
    // documents. A style guide that cannot display the character it forbids is not showing you
    // the rule, it is describing it, and describing it is what was already failing.
    // eslint-disable-next-line no-restricted-syntax
    wrong: 'Everything syncs — automatically, in the background.',
    right: 'Everything syncs automatically, in the background.',
  },
  {
    rule: 'The app never names itself to the person using it',
    why: 'Naming yourself to the person already inside is the app describing someone else. Use you, your, we, or nothing. Marketing surfaces are the exception: a FAQ answering "What is this?" has to name it.',
    wrong: `Every file stays in ${site.name}.`,
    right: 'Every file stays where you put it.',
  },
  {
    rule: 'Say what to do, not what went wrong',
    why: 'An error the user cannot act on is decoration. Name the next move, and say whether anything was lost.',
    wrong: 'Error: request failed with status 500.',
    right: 'That did not send. Nothing was lost, so trying again is safe.',
  },
  {
    rule: 'Sentence case everywhere',
    why: 'Headings, buttons, labels, table headers. Title Case reads as a product from 2012 and makes every label look like a proper noun.',
    wrong: 'Create New Project',
    right: 'Create new project',
  },
  {
    rule: 'Empty states say what goes here',
    why: 'The default empty state is the first screen of a real session. "No items" is the version that reads as broken.',
    wrong: 'No items.',
    right: 'Nothing here yet. Anything you save shows up here.',
  },
];

export function VoiceSection() {
  return (
    <Section
      id="voice"
      title="Voice"
      intro="The rules that survive a recolour. Nothing here depends on what the project looks like, which is exactly why it belongs in the system rather than in someone's memory."
    >
      {RULES.map((item) => (
        <Row key={item.rule} label={item.rule}>
          <p className="text-small text-muted max-w-2xl text-pretty">{item.why}</p>
          <div className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
            <div className="border-danger rounded-md border p-4">
              <p className="text-caption text-danger uppercase">Not this</p>
              <p className="text-body mt-2 text-pretty">{item.wrong}</p>
            </div>
            <div className="border-success rounded-md border p-4">
              <p className="text-caption text-success uppercase">This</p>
              <p className="text-body mt-2 text-pretty">{item.right}</p>
            </div>
          </div>
        </Row>
      ))}
    </Section>
  );
}
