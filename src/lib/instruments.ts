/* Futures contract strings, and the product behind them. Ported from `run-trading@v2` (S5c).
 *
 * THE EXPIRY IS PARSED; THE NAME IS LOOKED UP. Those are two different kinds of fact and they get
 * two different treatments, which is the whole shape of this file.
 *
 * Stripping `MNQU6` down to `MNQ` needs no table — exchange symbols are `root + month code + year
 * digit(s)` and the twelve month codes have been fixed since the CBOT — so that rule holds for every
 * product that will ever list, with nobody maintaining it.
 *
 * Knowing that `MNQ` is the Micro Nasdaq-100 cannot be derived from anything. It is a NAME, and the
 * argument against a lookup table does not apply to names the way it applies to behaviour: names do
 * not change, an unlisted root costs nothing (it falls back to the contract string), and the whole
 * list is one screen.
 *
 * PURE AND DEPENDENCY-FREE. The tape is a Server Component and its row is a client one, so this must
 * drag nothing server-side along with it.
 */

// F G H J K M N Q U V X Z — January through December. Fixed since the CBOT, and the only part of a
// contract symbol whose alphabet is closed.
const MONTH_CODES = 'FGHJKMNQUVXZ';
const EXPIRY = new RegExp(`^(.+?)([${MONTH_CODES}])(\\d{1,2})$`);

/* "MNQU6" -> "MNQ", "ESZ5" -> "ES", "6EU6" -> "6E", "M2KZ5" -> "M2K".
 *
 * ANCHORED AT THE END, which is the whole trick: roots that themselves END in a month-code letter
 * (`ZN`, `NQ`, `MNQ`) would be mangled by any rule scanning forwards for the first month code.
 * Matching from the right means only the real expiry can satisfy the pattern.
 *
 * An unparseable string comes back whole rather than guessed at — a symbol this does not recognise
 * is one nobody has seen yet, and inventing a root for it would file two products under one mark. */
export function productRoot(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  return EXPIRY.exec(s)?.[1] ?? s;
}

/* WHAT THE ROOT IS, in the fewest words a trader would recognise.
 *
 * THE NAMES ARE SHORT ON PURPOSE. "Micro Nasdaq-100", not "Micro E-mini Nasdaq-100 Index Futures" —
 * this sets as the title of a tape row beside a money figure, and the exchange's full legal name
 * would truncate before it finished distinguishing itself from its own micro.
 *
 * MICRO IS ALWAYS THE FIRST WORD where a micro exists, because that is the one distinction on this
 * list that is about RISK: MNQ and NQ differ by 10x per point, and this corpus already holds the
 * session where that exact substitution cost $2,331 in twenty minutes (`problem-brief.md`). A trader
 * scanning titles should never have to reach the end of one to know which of the pair they held. */
const PRODUCTS: Record<string, string> = {
  // Equity index
  ES: 'E-mini S&P 500',       MES: 'Micro S&P 500',
  NQ: 'E-mini Nasdaq-100',    MNQ: 'Micro Nasdaq-100',
  YM: 'E-mini Dow',           MYM: 'Micro Dow',
  RTY: 'E-mini Russell 2000', M2K: 'Micro Russell 2000',
  NKD: 'Nikkei 225',          EMD: 'E-mini MidCap 400',
  // Energy
  CL: 'Crude Oil',            MCL: 'Micro Crude Oil',
  NG: 'Natural Gas',          MNG: 'Micro Natural Gas',
  QG: 'E-mini Natural Gas',   BZ: 'Brent Crude',
  RB: 'RBOB Gasoline',        HO: 'Heating Oil',
  // Metals
  GC: 'Gold',                 MGC: 'Micro Gold',
  SI: 'Silver',               SIL: 'Micro Silver',
  HG: 'Copper',               MHG: 'Micro Copper',
  PL: 'Platinum',             PA: 'Palladium',
  // FX. The 6-series is CME's own coding; a trader reads "6E" and thinks "euro", so the name says so.
  '6E': 'Euro FX',            M6E: 'Micro Euro',
  '6B': 'British Pound',      M6B: 'Micro Pound',
  '6A': 'Australian Dollar',  M6A: 'Micro Aussie Dollar',
  '6J': 'Japanese Yen',       M6J: 'Micro Yen',
  '6C': 'Canadian Dollar',    '6S': 'Swiss Franc',
  '6N': 'NZ Dollar',          '6M': 'Mexican Peso',
  // Rates
  ZT: '2-Year T-Note',        ZF: '5-Year T-Note',
  ZN: '10-Year T-Note',       TN: 'Ultra 10-Year T-Note',
  ZB: '30-Year T-Bond',       UB: 'Ultra T-Bond',
  ZQ: '30-Day Fed Funds',     SR3: '3-Month SOFR',
  // Ags
  ZC: 'Corn',                 ZS: 'Soybeans',
  ZW: 'Chicago Wheat',        KE: 'KC Wheat',
  ZL: 'Soybean Oil',          ZM: 'Soybean Meal',
  ZO: 'Oats',                 LE: 'Live Cattle',
  HE: 'Lean Hogs',            GF: 'Feeder Cattle',
  // Crypto
  BTC: 'Bitcoin',             MBT: 'Micro Bitcoin',
  ETH: 'Ether',               MET: 'Micro Ether',
};

/* The product's name, or null for a root nobody has listed here.
 *
 * NULL RATHER THAN THE ROOT ITSELF, so the caller can tell "I know what this is" from "I do not" and
 * lay the row out differently. Returning the root would make an unknown product render as
 * `MNQ / MNQU6`, the exact repetition this table exists to remove. */
export function productName(symbol: string): string | null {
  return PRODUCTS[productRoot(symbol)] ?? null;
}

/* Which roots a search term names, matched against the product NAME rather than the ticker.
 *
 * THIS IS WHY IT LIVES HERE AND NOT IN SQL. `MNQ` -> `Micro Nasdaq-100` is a mapping this table
 * owns, so a trader typing "nasdaq" can only be answered by something holding this table. The
 * alternative — putting the names in the database purely so a `LIKE` could reach them — would be a
 * second copy of a list that already has one home, and the two would drift.
 *
 * Resolving to ROOTS rather than filtering rows means the caller still narrows with an indexed
 * `symbol_root IN (...)`, so the search stays a column comparison instead of a scan over names. */
export function rootsMatchingName(needle: string): string[] {
  const n = needle.trim().toLowerCase();
  if (!n) return [];
  return Object.entries(PRODUCTS)
    .filter(([, name]) => name.toLowerCase().includes(n))
    .map(([root]) => root);
}

/* Which of the seven instrument marks a product wears.
 *
 * PINNED FOR THE ONES TRADED DAILY, hashed for everything else. The hash alone would be fine, but it
 * would also mean the familiar dozen shuffle the day the palette is re-tuned, and those are exactly
 * the marks a trader would have learned by then.
 *
 * A MICRO AND ITS FULL-SIZE SIBLING NEVER SHARE A HUE, and that is the one assignment here that is
 * about risk rather than looks. Two products a stop distance means something different on must not
 * look alike in a list.
 *
 * THAT SENTENCE WAS FALSE FOR FIVE PAIRS UNTIL 2026-08-20, and it was false in the way a claim in a
 * comment usually is: it described the six pairs somebody had pinned by hand and said nothing about
 * the rest, which fell through to the hash and collided by chance. NG/MNG, HG/MHG, 6B/M6B, 6A/M6A
 * and 6J/M6J each rendered ONE mark for two products that differ by 10x per point. Found by putting
 * `InstrumentMark` on the rack and measuring the invariant instead of restating it.
 * Every pair is pinned now, and `MICRO_PAIRS` below is what makes the guarantee checkable rather
 * than remembered. A new micro added to PRODUCTS gets a line there and a pin here, in the same
 * commit, or the rack goes red. */
const PINNED: Record<string, number> = {
  ES: 3, MES: 7,
  NQ: 4, MNQ: 1,
  YM: 6, MYM: 2,
  RTY: 5, M2K: 3,
  CL: 4, MCL: 7,
  GC: 6, MGC: 5,
  NG: 5, MNG: 2,
  HG: 1, MHG: 4,
  SI: 1, SIL: 7,
  '6E': 2, M6E: 1,
  '6B': 5, M6B: 1,
  '6A': 4, M6A: 7,
  '6J': 6, M6J: 3,
  BTC: 4, MBT: 3,
  ETH: 1, MET: 5,
  ZN: 1, ZB: 3,
};

/* EVERY FULL-SIZE PRODUCT ON THIS LIST AND ITS MICRO, so the no-shared-hue rule above can be
 * MEASURED. It lives here rather than in the rack that renders it because "MNG is the micro of NG"
 * is instrument knowledge, and a test whose fixture list lives somewhere else stops covering the
 * table the moment somebody adds a row to one and not the other.
 *
 * Ordered full-size first. Both members are roots, never contract strings. */
export const MICRO_PAIRS: readonly (readonly [string, string])[] = [
  ['ES', 'MES'], ['NQ', 'MNQ'], ['YM', 'MYM'], ['RTY', 'M2K'],
  ['CL', 'MCL'], ['NG', 'MNG'],
  ['GC', 'MGC'], ['SI', 'SIL'], ['HG', 'MHG'],
  ['6E', 'M6E'], ['6B', 'M6B'], ['6A', 'M6A'], ['6J', 'M6J'],
  ['BTC', 'MBT'], ['ETH', 'MET'],
];

/** 1..7, matching the `--mark-N` tokens in `globals.css`. */
export function markHue(root: string): number {
  const pinned = PINNED[root];
  if (pinned) return pinned;
  // Any stable spread will do: the letters are the identity and the hue is a scan aid. `| 0` keeps
  // it in int32 so the same root hashes the same everywhere.
  let h = 0;
  for (let i = 0; i < root.length; i++) h = (h * 31 + root.charCodeAt(i)) | 0;
  return (Math.abs(h) % 7) + 1;
}
