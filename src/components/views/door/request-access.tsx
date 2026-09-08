'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* THE DOOR'S ONE FORM. An address, a button, a sentence back. Posts to `/api/access`, which emails
 * Luke and records the domain; adding the person is then one edit to `BETA_ALLOWLIST`.
 *
 * IT DOES NOT SAY WHETHER THE ADDRESS WAS NEW, THROTTLED, OR ALREADY INVITED - the route answers 200
 * for every well-formed address for the same reason `beta-invite.ts` gives one refusal sentence: a
 * public form that answers differently is an oracle. The trader's next step is the same either way.
 *
 * `Input`, NOT `TextField`: this is a hero control with the label carried by the sentence above it
 * and the placeholder, the way the reference's landing forms are. A visible "Email" label over a
 * hero input is a form, and this is a door.
 */
export function RequestAccess() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function submit() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  if (state === 'sent') {
    return (
      <p className="text-body-lg text-pretty" role="status">
        Thanks. You will hear from us at <span className="font-medium">{email.trim()}</span> when a
        place opens up.
      </p>
    );
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder="Your email"
        aria-label="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" size="lg" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending' : 'Request access'}
      </Button>
      {state === 'failed' && (
        <p className="text-body text-neg sm:basis-full" role="alert">
          That did not go through. Try again.
        </p>
      )}
    </form>
  );
}
