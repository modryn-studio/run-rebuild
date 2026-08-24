'use client';

/* THE DATE FIELD, LIVE, because its whole reason for existing is a state you cannot photograph:
 * what an EMPTY native date input says. Static markup would show two boxes; only a real one shows
 * that the UA's `mm/dd/yyyy` has been replaced by a word, and that the word goes away the moment a
 * date lands and comes back when it is cleared.
 *
 * `'use client'` and its own state, because `inputs.tsx` is a Server Component and cannot hand a
 * client component an `onChange`. */

import { useState } from 'react';
import { DateInput } from '@/components/ui/date-input';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-muted font-medium">{label}</span>
      {children}
    </label>
  );
}

export function DateFieldDemo() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>('2026-08-21');

  return (
    <div className="grid max-w-xl gap-6">
      {/* THE PAIR, AS THE FILTER SHEET USES IT: one end empty, one end set, each bounding the other
          so the window cannot invert. Type into the first and watch "Earliest" leave. */}
      <Field label="Start date">
        <DateInput value={from} max={to} placeholder="Earliest" onChange={setFrom} aria-label="Start date" />
      </Field>
      <Field label="End date">
        <DateInput value={to} min={from} placeholder="Latest" onChange={setTo} aria-label="End date" />
      </Field>

      {/* THE COMPACT SIZE, on the ground the desktop popover actually gives it. `bg-bg` is passed
          through `className` at the call site, which is the one override this component takes. */}
      <Field label="Compact, on a surface panel">
        <div className="border-border bg-surface rounded-[var(--radius)] border p-4">
          <DateInput
            size="sm"
            value={null}
            placeholder="Earliest"
            onChange={() => {}}
            aria-label="Compact date"
            className="bg-bg"
          />
        </div>
      </Field>

      <Field label="Disabled">
        <DateInput value={null} placeholder="Earliest" onChange={() => {}} aria-label="Disabled date" disabled />
      </Field>
    </div>
  );
}
