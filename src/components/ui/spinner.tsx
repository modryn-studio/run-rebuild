import { cn } from '@/lib/cn';

// A subtle loading spinner in the current text color - drop it into a button (replacing the label)
// while an async action is in flight. Inherits `color` via currentColor, so it reads correctly on
// the accent CTA and on neutral surfaces alike.
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
