'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Input } from './input';
import { FieldError } from './field-error';

/* A FIELD IS A LABEL PLUS A CONTROL PLUS ITS ERROR, and shipping those three separately is how a
 * screen ends up with an unlabelled input. This repo's /login did: the email field carried an
 * `aria-label` and no <label> element at all, so the whole screen rendered zero labels. The
 * kitchen sink independently grew a private `Field` wrapper to demo inputs, which was the tell —
 * the missing primitive had already been written twice in two places rather than once here.
 *
 * COMPOSES Input and FieldError rather than redrawing the box. The height, the 16px floor and the
 * border-as-focus-indicator all stay in one place, so a project that retunes the field box gets it
 * here for free.
 *
 * `label` IS REQUIRED, and `labelHidden` is the escape hatch rather than the label being optional.
 * A visually hidden label is still a label; a missing one is a bug, and making it a required prop
 * is the only version of that rule the type system can enforce.
 *
 * The error wires itself: aria-invalid on the control, aria-describedby pointing at the message,
 * and the message announced via role="alert" when it appears. A call site passes a string.
 */
export function TextField({
  label,
  labelHidden = false,
  hint,
  error,
  id,
  className,
  ...props
}: {
  label: string;
  labelHidden?: boolean;
  hint?: string;
  error?: string | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { id?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={labelHidden ? 'sr-only' : 'text-small block font-medium'}>
        {label}
      </label>

      {/* The hint is guidance, so it takes ink rather than muted. Muted is for metadata. */}
      {hint && (
        <p id={hintId} className={cn('text-caption', labelHidden ? '' : 'mt-1')}>
          {hint}
        </p>
      )}

      <Input
        id={fieldId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={labelHidden && !hint ? undefined : 'mt-2'}
        {...props}
      />

      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
