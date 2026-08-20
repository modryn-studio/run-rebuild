import { AlertCircle } from 'lucide-react';

// The error message under a form field. Renders nothing when there is no error, so a call site
// can mount it unconditionally and never branch.
//
// role="alert" so the message is announced the moment it appears — a field that turns red
// silently is invisible to a screen reader. Pair it with the field:
//   <Input aria-invalid={!!error} aria-describedby={error ? 'email-error' : undefined} />
//   <FieldError id="email-error">{error}</FieldError>
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;

  return (
    <p id={id} role="alert" className="text-danger text-small mt-2 flex items-start gap-2">
      <AlertCircle size={16} aria-hidden className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}
