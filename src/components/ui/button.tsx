import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Uses the brand tokens defined in globals.css @theme:
//   accent / accent-fg / surface / text / muted / border
/* THE THREE STATES, TAKEN OFF THEIR BUTTON'S OWN CLASS LIST (2026-07-31). Their newer component
 * spells the whole contract out and it answers both of Luke's notes at once:
 *
 *   rest    border-border-primary  bg-background-primary  shadow-sm
 *   hover   not-disabled:hover:border-border-primary-hover        <- THE BORDER, AND NOTHING ELSE
 *   active  active:shadow-inset  active:bg-background-secondary   <- IT PUSHES IN
 *   off     disabled:bg-background-secondary disabled:text-content-secondary disabled:shadow-none
 *
 * "monarch doesn't highlight the entire button on hover. i think its just the border. and its
 * subtle." Correct, and it is why a filled hover felt wrong: a raised object that already has a
 * ground cannot announce hover by changing that ground without looking like a different object.
 *
 * "when buttons are clicked, they need to look like they've been pushed in. this is a big one for
 * me." It used to be `active:scale-[0.98]`, which is a SHRINK, not a push - the object gets smaller
 * and stays flat. `--shadow-press` is the inset the icon chips have always used, so the whole app
 * now has one press gesture instead of two. */
const variantClasses: Record<ButtonVariant, string> = {
  // Their primary has no shadow and darkens on hover (orange -> orangeDark); pine gets the same
  // treatment through --color-accent-hover rather than an opacity wash, which greys the fill.
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover active:shadow-[var(--shadow-press)] disabled:opacity-50',
  secondary:
    'border-border bg-surface text-text border shadow-[var(--shadow-sm)] hover:border-border-strong active:bg-[var(--pressed-bg)] active:shadow-[var(--shadow-press)] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:opacity-100',
  // The quiet, always-accent-colored outline (a header "add" control, a secondary CTA beside a
  // primary one) - distinct from `secondary`, whose edge only firms up on hover.
  outline:
    'border border-accent/40 text-accent hover:border-accent active:shadow-[var(--shadow-press)] disabled:opacity-50',
  ghost:
    'text-muted hover:text-text hover:bg-[var(--pressed-bg)] active:bg-[var(--pressed-bg)] active:text-text active:shadow-[var(--shadow-press)] disabled:opacity-50',
};

// Sizes reflect the app's real button scale, not an invented one: sm = a compact header control,
// md = a modal/inline primary action, lg = a full-width hero CTA. Text sizes are the locked
// type-scale roles (text-body / text-body-lg), never a hand-picked size.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-body',
  md: 'px-6 py-3 text-body-lg',
  // min-h-12 (48px), not py-3.5: 3.5 is a banned half-step, and 48px is already the app's de-facto
  // full-width CTA height (import-method-modal, file-upload-step both hand-set min-h-12). Now one
  // height for one control class, and it matches the Input primitive so stacked pairs agree.
  lg: 'px-6 py-3 min-h-12 text-body-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Every CTA that triggers an async action uses this - the label swaps for a spinner and the
  // button disables, so no async action ever fires twice from a double-click. App-wide rule
  // (Luke, 2026-07-18): every CTA gets this, not just the ones already wired to something async.
  loading?: boolean;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'rounded-[var(--radius-sm)] focus-visible:ring-accent/30 inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-100 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
