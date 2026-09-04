/* HOW A NUMBER IS WRITTEN DOWN. One copy, so two surfaces can never render one figure two ways.
 *
 * A LEAF, AND THAT IS THE POINT. These lived in `lib/desk/tape.ts`, which is right about the
 * principle — "one place, so verifiedNumbers and the rendered tape cannot disagree" — and wrong
 * about the address once a UI needs them: that module is a thousand lines of desk-call machinery,
 * and a `'use client'` row importing `fmtPrice` from it would ship the whole resolver, the fee
 * allocator and the episode walk to the browser to format a price.
 *
 * So the formatters moved and the property did not: `desk/tape.ts` re-exports them, every caller
 * still reaches one implementation, and a client component can import this file alone. Nothing
 * here touches the database, the environment, or anything server-only, and nothing may.
 */

import { PRICE_SCALE } from '@/lib/csv/shared';

/** Money, from integer cents. Money is ALWAYS cents in this codebase; a quote never is. */
export const fmtMoney = (cents: number): string => {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? '-' : ''}$${abs}`;
};

/* THE SAME MONEY, WITH ITS SIGN SHOWN BOTH WAYS - `+$212.00` and `-$563.50`.
 *
 * A RESULT NEEDS THE PLUS AND A BALANCE DOES NOT, which is the whole distinction: `fmtMoney` prints
 * a level, this prints a CHANGE, and a gain rendered as a bare `$212.00` beside a loss rendered as
 * `-$340.50` makes the reader supply the missing sign from the colour alone.
 *
 * ONE COPY, ADDED 2026-09-04 WHEN A FOURTH WAS ABOUT TO BE WRITTEN. It existed identically in
 * `trades-tape.tsx` and `accounts-rail.tsx`, and `/today`'s `Last session` card needed the same
 * three lines. That is the `accountLabel` lesson from the day before, arriving again in a different
 * file: a formula copied into every surface that needs it is a formula that will eventually be
 * copied WRONG, and the copies here already differed from each other in nothing but luck.
 *
 * HERE BECAUSE THIS MODULE'S HEADER ALREADY CLAIMS IT - "one copy, so two surfaces can never render
 * one figure two ways" - and because it is a leaf a `'use client'` row can import without dragging
 * a server module behind it. */
export const signed = (cents: number): string =>
  cents > 0 ? `+${fmtMoney(cents)}` : fmtMoney(cents);

/* A QUOTE, from micro-units. NEVER a fixed two decimals: that was the second half of the price bug,
 * and fixing only the storage would have left every 6E quote rendering as 1.09 from a perfectly
 * stored 1085000. Trailing zeros are trimmed but never below two decimals, so an index future still
 * reads 19204.25 rather than 19204.25000.
 *
 * Trim the padding first, THEN restore the two-decimal floor. The other order lets the trim eat the
 * floor: 29312.500000 became "29312.5" sitting in a column beside "29318.00", which is the same
 * number rendered two ways in one table. */
export const fmtPrice = (micros: number): string => {
  let s = (micros / PRICE_SCALE).toFixed(6).replace(/0+$/, '');
  if (s.endsWith('.')) s = s.slice(0, -1);
  const dot = s.indexOf('.');
  const decimals = dot === -1 ? 0 : s.length - dot - 1;
  if (decimals < 2) s += (dot === -1 ? '.' : '') + '0'.repeat(2 - decimals);
  return s;
};

/** A quote already stored as `numeric(19,6)`, which arrives from the driver as a string. The same
 *  rendering as `fmtPrice`, from the other representation — `trade.entry_price` is a decimal
 *  string, not micros, and parsing it back into micros to format it would be a round trip through
 *  the float this column exists to avoid. */
export const fmtPriceDecimal = (value: string): string => {
  const [whole, frac = ''] = value.split('.');
  const trimmed = frac.replace(/0+$/, '');
  const padded = trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed;
  return `${whole}.${padded}`;
};

export const fmtDuration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
};
