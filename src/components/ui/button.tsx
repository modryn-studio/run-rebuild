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
  /* DISABLED IS A REAL SWAP, not an opacity drop (2026-08-13). `secondary` already did this and it
   * is the considered version: opacity fades the control's EDGES as well as its ink, so a filled
   * button goes soft and blurry rather than reading as off. A ground change keeps the shape crisp
   * and says "inert" instead of "faded". Both filled variants now answer the same way.
   *
   * `ghost`, `Input` and `Textarea` keep opacity, deliberately: a bare or bordered control has no
   * fill to swap, and this palette has only two ink tiers (`faint` is an alias of `muted`), so
   * there is no quieter ink to move them to. Opacity is the only lever they have. */
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover active:shadow-[var(--shadow-press)] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:opacity-100',
  secondary:
    'border-border bg-surface text-text border shadow-[var(--shadow-sm)] hover:border-border-strong active:bg-[var(--pressed-bg)] active:shadow-[var(--shadow-press)] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:opacity-100',
  // The quiet, always-accent-colored outline (a header "add" control, a secondary CTA beside a
  // primary one) - distinct from `secondary`, whose edge only firms up on hover.
  outline:
    'border border-accent/40 text-accent hover:border-accent active:shadow-[var(--shadow-press)] disabled:opacity-50',
  ghost:
    'text-muted hover:text-text hover:bg-[var(--pressed-bg)] active:bg-[var(--pressed-bg)] active:text-text active:shadow-[var(--shadow-press)] disabled:opacity-50',
};

/* Sizes reflect the app's real button scale: sm = a compact header control, md = the standard
 * action, lg = a full-width CTA. Text sizes are locked type-scale roles, never hand-picked.
 *
 * HEIGHTS ARE EXPLICIT, NOT PADDING PLUS LINE-HEIGHT, and that is the fix rather than the style.
 * Derived from padding, `md` and `lg` BOTH CAME OUT AT 48px — two named sizes rendering one
 * height, which no call site could have detected and which the rack showed the moment all three
 * sat in a row. A stated height cannot silently equal its neighbour.
 *
 * 36px FOR `md` IS THE MEASURED REFERENCE, not a preference. Read live 2026-08-13:
 *   Monarch's labelled button   39px, 7.5px/12px padding, 16px/400, 8px radius
 *   the previous build          36px, both flavours ("Refresh" 12px/500, "Add account" 14px/500)
 * The old `md` at 48px was a third taller than either, which is why the app read heavier than the
 * thing it is derived from.
 *
 * `lg` STAYS 48 and that is deliberate: it is the full-width CTA, it is what the import flow
 * already hand-sets, and it matches the Input primitive so a stacked field-and-button pair agrees.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small',
  md: 'h-9 px-4 text-body',
  lg: 'h-12 px-6 text-body-lg',
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
      /* FOCUS IS THE GLOBAL RULE, not a local ring. This carried
       * `focus-visible:ring-accent/30 focus-visible:ring-2 focus-visible:outline-none`, which
       * suppressed the app-wide `:focus-visible` outline and replaced it with the accent at 30%
       * alpha and no offset — measured at roughly 2.05:1 against its own ground, on the most
       * common control in the product. IconButton and the Menu trigger kept the global 2px solid
       * accent, so a labelled button and an icon button in one header showed two different focus
       * treatments and the weaker one was on the button people actually tab to.
       *
       * `truncate` because the label has nowhere to go. Measured at every width, a long label
       * pushed this to 1008px and never reflowed — 2.9x its container at 375. A button that
       * overflows breaks the layout around it; one that truncates is ugly and contained. Labels
       * here are short by design, so this is the failure mode, not the normal path. */
      className={cn(
        'rounded-[var(--radius-sm)] inline-flex items-center justify-center gap-2 truncate font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-100 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {/* THE LABEL KEEPS ITS WIDTH WHILE LOADING. Swapping children outright collapsed the button
          from 81px to 50px at the exact moment of the click, shifting every control beside it in a
          right-aligned footer. `Menu` already reserves its trigger width for the same reason, so
          this is the system's existing answer rather than a new one. */}
      {loading ? (
        <span className="relative inline-flex items-center">
          <span className="invisible">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
