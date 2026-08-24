'use client';

// Client for the whole section: CodeInput is controlled, so every specimen needs an onChange, and
// a function prop cannot cross from a Server Component into a Client one.

import { useState } from 'react';
import { CodeInput } from '@/components/ui/code-input';
import { Row, Section } from '../_components/section';

function Static({ value, invalid, disabled }: { value: string; invalid?: boolean; disabled?: boolean }) {
  return <CodeInput value={value} onChange={() => {}} invalid={invalid} disabled={disabled} />;
}

export function CodeSection() {
  const [value, setValue] = useState('');

  return (
    <Section
      id="code"
      title="Code input"
      intro="Six drawn boxes over one real input. Paste a code into the live one, including a messy one like 'code: 123 456', and check that it lands correctly."
    >
      <Row label="Live" note="type, paste, and tab away to see focus leave">
        <div className="max-w-sm">
          <Static value="" />
          <div className="mt-6">
            <CodeInput value={value} onChange={setValue} />
          </div>
        </div>
      </Row>

      <Row label="States">
        <div className="grid max-w-sm gap-6">
          <Static value="" />
          <Static value="128" />
          <Static value="128394" />
          <Static value="128394" invalid />
          <Static value="128394" disabled />
        </div>
      </Row>
    </Section>
  );
}
