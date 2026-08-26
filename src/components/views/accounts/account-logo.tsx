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

export function AccountLogo({
  propFirm,
  size = 40,
}: {
  propFirm: string | null;
  /** 40 on a roster row, 24 in the detail page's breadcrumb. */
  size?: number;
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
      className="border-border flex shrink-0 items-center justify-center overflow-hidden rounded-full border"
      style={{ width: size, height: size, background: 'var(--color-logo-tile)' }}
      aria-hidden
    >
      {/* A LOCAL ASSET, so `next/image` would need each firm host whitelisted for nothing — the same
          call `trade-detail.tsx` already makes for the same files. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ?? '/brokers/tradovate-logomark.png'}
        alt=""
        className="object-contain"
        style={{ width: size * 0.6, height: size * 0.6 }}
      />
    </span>
  );
}
