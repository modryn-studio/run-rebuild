import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/ui/text-field';
import { Textarea } from '@/components/ui/textarea';
import { Note, Row, Section } from '../_components/section';

export function InputsSection() {
  return (
    <Section
      id="inputs"
      title="Text field"
      intro="TextField is what a screen reaches for: a label, the control, and its error, wired together. Input and Textarea are the boxes underneath, for the rare case that composes its own arrangement. A screen that uses the raw box owes it a label of its own."
    >
      <Row label="States" note="every one a real screen will hit">
        <div className="grid max-w-xl gap-6">
          <TextField label="Empty" />
          <TextField label="Placeholder" placeholder="you@company.com" />
          <TextField label="Filled" defaultValue="luke@modrynstudio.com" />
          <TextField
            label="With a hint"
            hint="We only use this to send the sign-in code."
            placeholder="you@company.com"
          />
          <TextField label="Disabled" defaultValue="luke@modrynstudio.com" disabled />
          <TextField
            label="Error"
            defaultValue="luke@modryn"
            error="That address is missing a domain."
          />
          <TextField
            label="Error, long message"
            defaultValue="luke@modryn"
            error="We could not reach that address. Check the spelling, or try the account you signed in with last time, and if it keeps failing the code can be sent somewhere else."
          />
          <TextField
            label="Label hidden"
            labelHidden
            placeholder="Search"
            defaultValue="Still labelled, just not visibly"
          />
        </div>
        <Note>
          The label is a required prop, and labelHidden is the escape hatch. A field with no label is
          a bug rather than a style, and a required prop is the only version of that rule the type
          system can enforce: /login shipped an aria-label and zero label elements before this
          existed.
        </Note>
      </Row>

      <Row label="Height is stated, not derived" note="the reason this rule exists">
        <div className="flex max-w-xl items-end gap-3">
          <TextField label="Email" labelHidden placeholder="you@company.com" className="flex-1" />
          <Button size="lg">Continue</Button>
        </div>
        <Note>
          Both are 48px because both say so, not because padding and line-height happened to add up.
          They did not: this field was 46px against a 56px button on /login, in the same card,
          with nothing in the code claiming they should match.
        </Note>
      </Row>

      <Row label="The raw boxes" note="Input and Textarea, unlabelled on purpose">
        <div className="grid max-w-xl gap-6">
          <Input placeholder="An Input with no label. Do not ship this." aria-label="Bare input" />
          <Textarea rows={3} placeholder="Say what happened." aria-label="Bare textarea" />
          <Textarea
            rows={4}
            defaultValue={
              'The content overflows the box rather than growing it, because resize is off by design. If a screen needs it to grow, that is an autosize behaviour to add at the call site, not a resize handle to turn back on.'
            }
            aria-label="Filled textarea"
          />
          <Textarea rows={3} defaultValue="Locked while sending." disabled aria-label="Disabled textarea" />
        </div>
        <Note>
          Both sit at 16px, and that is a floor rather than a preference: below it, iOS Safari zooms
          the viewport when the field takes focus and never zooms back. Tab into any of these to see
          focus, which is the border changing value rather than a ring appearing. That substitution
          is declared once in globals.css, so a new field cannot forget to opt out of the global
          outline and end up wearing two indicators.
        </Note>
      </Row>
    </Section>
  );
}
