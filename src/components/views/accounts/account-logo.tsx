/* THE MARK BESIDE AN ACCOUNT: the prop firm's logo, and the BROKER's when there is no firm.
 *
 * THE FALLBACK IS A FACT, NOT A PLACEHOLDER, and that is the whole design (ported from
 * `run-trading@v2`). Every account in Run arrived through a broker and Run knows which one, so a row
 * with no stated firm shows Tradovate's mark rather than an empty ring. A hole where a fact was
 * available is a worse answer than the fact.
 *
 * `isPersonalFirm` GUARDS A REAL BUG v2 SHIPPED: a personal account stores the literal string
 * `'Personal'` in `prop_firm`, and passing that to the firm logo drew a tile with a "P" in it —
 * Run inventing a prop firm called Personal. A personal account takes the broker mark, which is
 * true of it.
 *
 * ROUND, which is the one exception the design system grants a MARK rather than a control. It is
 * an identity, the same way `InstrumentMark` on the tape is, and both read as tokens rather than
 * as buttons.
 */

import { findPropFirm, firmLogoSrc, isPersonalFirm } from '@/lib/prop-firms';
import { cn } from '@/lib/cn';

export function AccountLogo({
  propFirm,
  size = 40,
  className,
}: {
  propFirm: string | null;
  /** 40 on a roster row, 24 in the detail page's breadcrumb. The DEFAULT; see `className`. */
  size?: number;
  /* FOR THE ONE THING A PROP CANNOT DO: change with the viewport. A call site overrides the size
     responsively with `max-sm:[--logo-size:32px]`, and the fallback mark's 0.6 inset follows it
     through `calc`. A JS width check would need a viewport the server does not have, and would
     settle on the wrong answer for one paint.
     WHY `size` SETS A *FALLBACK* VARIABLE AND NOT `--logo-size` ITSELF: an inline style beats every
     class, so a prop written straight into `--logo-size` could never be overridden by the utility
     that exists to override it - and it would fail SILENTLY, with the class present in the DOM and
     doing nothing. Measured exactly that way: the class was there and the mark stayed 40px. */
  className?: string;
}) {
  const firm = propFirm && !isPersonalFirm(propFirm) ? findPropFirm(propFirm) : undefined;
  const src = firm ? firmLogoSrc(firm.name) : null;

  return (
    /* `--color-logo-tile` RATHER THAN A HEX. v2 hard-coded `#fdfcf9` here, which is the light
       mode's paper and simply wrong in dark. The token exists for exactly this: a logo is drawn on
       its own ground, not on the app's, so it needs a value that does not invert.
       AS AN INLINE STYLE, matching `add-account-modal.tsx`, the only other consumer. The token
       lives in `@theme static` precisely because its readers are inline styles and hand-written
       CSS; reaching for a `bg-` utility here would be the one call site depending on Tailwind
       having generated one, and a utility with no token behind it emits NOTHING - no error, no
       warning, and `verify-css.mjs` cannot see it either. */
    <span
      className={cn(
        'border-border flex h-[var(--logo-size,var(--logo-fallback))] w-[var(--logo-size,var(--logo-fallback))] shrink-0 items-center justify-center overflow-hidden rounded-full border',
        className
      )}
      style={
        {
          '--logo-fallback': `${size}px`,
          background: 'var(--color-logo-tile)',
        } as React.CSSProperties
      }
      aria-hidden
    >
      {/* A LOCAL ASSET, so `next/image` would need each firm host whitelisted for nothing — the same
          call `trade-detail.tsx` already makes for the same files. */}
      {/* A FIRM'S MARK FILLS THE TILE; THE BROKER FALLBACK SITS AT 0.6 (v2's split, and it is not
          cosmetic). A prop firm's logo is already drawn with its own padding and reads as the
          account's identity, so shrinking it leaves a small mark adrift in a ring. The broker mark
          is a FALLBACK standing in for a fact nobody has stated yet, and inset it reads as
          secondary — which is exactly what it is. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ?? '/brokers/tradovate-logomark.png'}
        alt=""
        className={src ? 'h-full w-full object-contain' : 'object-contain'}
        style={
          src
            ? undefined
            : {
                width: 'calc(var(--logo-size, var(--logo-fallback)) * 0.6)',
                height: 'calc(var(--logo-size, var(--logo-fallback)) * 0.6)',
              }
        }
      />
    </span>
  );
}
