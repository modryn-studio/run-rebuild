/* The prop firm a Tradovate account belongs to — the one piece of identity the platform does not
 * carry. Ported from `run-trading@v2:src/lib/prop-firms.ts` (2026-08-15, S4e). The full finding and
 * the trader-reality it is shaped around: `docs/docs from run-trading/prop-firm-identity.md`.
 *
 * Verified 2026-07-29 against real exports from two firms, all six Tradovate export types each: the
 * firm's name appears in NONE of them, zero occurrences across all twelve files. Only the account
 * NAME does, and its prefix encodes the firm. OAuth returns the same account object, so this is not
 * a gap the live socket closes later — it is the shape of Tradovate's model, where the firm is a
 * separate company sitting above the account.
 *
 * NO DATABASE, NO `server-only`. Every consumer is a client component (the labelling step, the
 * firm picker), and this is the vocabulary layer: it must not import the data layer.
 */

/* THE ONE IMPORT, AND IT IS ERASED. `import type` compiles to nothing, so the rule above still
   holds: no drizzle reaches a client bundle through this line. The alternative was re-declaring the
   four status strings here, which is the drift this file's own comments spend paragraphs warning
   about. */
import type { AccountStatus } from '@/lib/db/schema';

/* THE PREFIX IS A LOOKUP, NEVER AN INFERENCE. This distinction cost a real mistake on 2026-07-30
 * and is the reason this file reads the way it does.
 *
 * The table below originally had one entry, `ELTD -> Elite Trader Funding`, reasoned from the
 * letters. `ELTDENF260623134425853685` is a **TradeDay** account. The second, `FTDFYL100183704873`,
 * decodes to nothing at all by eye and is **Tradeify**. So the letters are not a code anyone can
 * read: a confident-looking guess was wrong on the first and unreadable on the second, which is the
 * worst possible pair of outcomes on the one screen whose entire job is proving Run pays attention
 * to this trader's own accounts.
 *
 * Nobody has published a decoder either. Searched 2026-07-30: no repo, no forum thread, no vendor
 * doc maps Tradovate prop account prefixes to firms. There is nothing to import.
 *
 * SO THE RULE IS ABSOLUTE: an entry appears here only because a real trader confirmed a real
 * account from that firm. Never because the letters look like a name. A missing prefix asks the
 * trader a one-tap question; a wrong one tells them something false about their own money.
 *
 * This is also why the table gets BETTER on its own, which is the point. Every trader who labels an
 * account writes `firm_source = 'stated'`, so confirmed (prefix → firm) pairs sit in the corpus and
 * need no new schema to harvest:
 *
 *   select substring(external_account_id from '^[A-Z]+') as prefix, prop_firm, count(*)
 *     from account where firm_source = 'stated' and prop_firm is not null
 *    group by 1, 2 order by 3 desc;
 *
 * Each answer makes the next trader's intake shorter. Add confirmed rows here as they accumulate.
 */
const CONFIRMED_PREFIXES: Record<string, string> = {
  ELTDENF: 'TradeDay', // Luke's own account, confirmed by him 2026-07-30
  FTDFYL: 'Tradeify', // Luke's own account, confirmed by him 2026-07-30
};

/* The firm a Tradovate account name is KNOWN to belong to, or null — and null is the normal answer,
 * not a failure. Longest match wins, so a prefix that extends another still resolves once both are
 * confirmed.
 *
 * A hit is written with `firm_source: 'detected'`, never `'stated'`: the prefix was confirmed on
 * somebody else's account, not on this one, and two firms sharing a prefix is unproven rather than
 * impossible. The trader's own answer always overwrites it.
 */
export function knownFirmForAccount(externalAccountId: string): string | null {
  const name = externalAccountId.trim().toUpperCase();
  let best: string | null = null;
  for (const prefix of Object.keys(CONFIRMED_PREFIXES)) {
    if (name.startsWith(prefix) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best ? CONFIRMED_PREFIXES[best] : null;
}

/* `pending:<uuid>` is Run's own bookkeeping, not a name Tradovate gave anything: an account added
 * by hand, waiting to reconcile with a real name at first import. It must never be shown to a
 * trader, and it is not a real prefix — which matters more than it looks, because uppercased it
 * yields "PENDING", so without this check two unrelated hand-added accounts would offer each other
 * as same-firm siblings.
 *
 * v2 had a second one, `default-<uuid>`, for a row whose export named no account. This build has no
 * equivalent and must not grow one: an unnamed row is a BLOCKING preflight finding here
 * (`rows_unnamed`), because v2's own comment admits the fallback only ever produced a junk row that
 * then showed up in the roster as a phantom account.
 */
export function isPlaceholderAccountName(externalAccountId: string): boolean {
  return externalAccountId.startsWith('pending:');
}

/* The leading letters of a Tradovate account name — the grain the firm question is asked at.
 *
 * A copy-trader's export holds many accounts sharing one prefix, and one prefix is one firm (each
 * firm issues its own Tradovate credential, see the doc), so asking per prefix instead of per
 * account turns eleven questions into two. Null for a placeholder key, and for any name with no
 * letter prefix. */
export function accountPrefix(externalAccountId: string): string | null {
  if (isPlaceholderAccountName(externalAccountId)) return null;
  return externalAccountId.trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? null;
}

/* Firms that run on Tradovate. Source: `prop.tradovate.com/find-a-prop-firm`, read 2026-07-30.
 * Order is Tradovate's own page order, kept rather than alphabetised or re-ranked — it is their
 * signal about their own partners, and any reordering here would be our guess replacing their fact.
 *
 * `tradovate` records whether a firm's accounts can reach Run through this rail TODAY. It does not
 * filter the label picker — a trader labelling an Apex account is entitled to name it correctly
 * whether or not Apex has finished migrating — but it is the flag any future OAuth source list must
 * read, because offering a connect that cannot work is worse than omitting it.
 *
 * TOPSTEP IS DELIBERATELY ABSENT, and it is the one omission worth explaining. Topstep pulled every
 * third-party platform in July 2025 and moved all accounts to its own TopstepX; the ProjectX
 * backend that still routed legacy Tradovate-hosted Topstep accounts was shut down for third-party
 * firms on 2026-02-28. There is no Topstep account on Tradovate any more, so a Topstep trader
 * cannot reach Run through this rail at all. It arrives with a ProjectX/TopstepX rail, not here.
 *
 * `domain` is the firm's own root domain. Root domains, NOT the outbound links on Tradovate's page —
 * those are affiliate/campaign URLs, and one of them (Tradeify's) points at ninjatrader.com, so
 * they identify a marketing deal rather than the firm.
 *
 * `logo` IS THE EXTENSION ACTUALLY ON DISK, and recording it fixed a real bug rather than tidying
 * one: the logo component used to GUESS — request `<slug>.png`, wait for the 404, then request
 * `<slug>.jpeg` — and fifteen of these twenty-three are `.jpeg`, so the common case was a failed
 * round trip before the real one started. `null` means no file sourced yet, which is a normal state
 * rather than an error: these are third-party marks gathered one at a time, and the logo component
 * falls back to the firm's initial.
 */
export const PROP_FIRMS = [
  { name: 'Take Profit Trader', domain: 'takeprofittrader.com', tradovate: 'live', logo: 'png' },
  { name: 'Tradeify', domain: 'tradeify.co', tradovate: 'live', logo: 'jpeg' },
  { name: 'Funded Futures Family', domain: 'fundedfuturesfamily.com', tradovate: 'live', logo: null },
  { name: 'BluSky Trading Company', domain: 'blusky.pro', tradovate: 'live', logo: 'jpeg' },
  { name: 'TradeDay', domain: 'tradeday.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'Lucid Trading', domain: 'lucidtrading.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'FundedNext Futures', domain: 'fundednext.com', tradovate: 'live', logo: 'png' },
  { name: 'Top One Futures', domain: 'toponefutures.com', tradovate: 'live', logo: 'png' },
  { name: 'Legends Trading', domain: 'thelegendstrading.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'The Trading Pit', domain: 'thetradingpit.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'Elite Trader Funding', domain: 'elitetraderfunding.com', tradovate: 'live', logo: 'png' },
  { name: 'Blue Guardian Futures', domain: 'blueguardianfutures.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'FuturesElite', domain: 'futureselite.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'Phidias', domain: 'phidiaspropfirm.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'HolaPrime', domain: 'holaprime.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'AquaFutures', domain: 'aquafutures.io', tradovate: 'live', logo: 'jpeg' },
  { name: 'EmergeProfit', domain: 'emergeprofit.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'FXify', domain: 'fxifyfutures.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'Goat Funded Futures', domain: 'goatfundedfutures.com', tradovate: 'live', logo: 'jpeg' },
  { name: 'LifeUp Trading', domain: 'lifeuptrading.com', tradovate: 'live', logo: null },
  { name: 'Apex Trader Funding', domain: 'apextraderfunding.com', tradovate: 'soon', logo: 'jpeg' },
  { name: 'My Funded Futures', domain: 'myfundedfutures.com', tradovate: 'soon', logo: 'png' },
  { name: 'Purdia Capital', domain: 'purdia.com', tradovate: 'soon', logo: 'png' },
] as const satisfies readonly {
  name: string;
  domain: string;
  tradovate: 'live' | 'soon';
  logo: 'png' | 'jpeg' | null;
}[];

export type PropFirm = (typeof PROP_FIRMS)[number];

export const PROP_FIRM_NAMES: readonly string[] = PROP_FIRMS.map((f) => f.name);

const BY_NAME = new Map<string, PropFirm>(PROP_FIRMS.map((f) => [f.name, f]));

/** The listed firm behind a name, or undefined for one the trader typed themselves. Undefined is a
 *  normal outcome, not an error — free-typed firms are accepted everywhere. */
export function findPropFirm(name: string): PropFirm | undefined {
  return BY_NAME.get(name);
}

export function firmSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Logo file for a firm, or null when none has been sourced. One request, always the right one —
 *  the extension is recorded per firm above rather than guessed at, for the reason written there. */
export function firmLogoSrc(name: string): string | null {
  const firm = findPropFirm(name);
  return firm?.logo ? `/firms/${firmSlug(name)}.${firm.logo}` : null;
}

/* The picker opens on these five instead of on all twenty-three. A picker should open on an answer,
 * not on a list: five names a trader recognises beats twenty-three they have to read, and for most
 * people their firm is in the five.
 *
 * THIS IS EDITORIAL AND IT GOES STALE. A judgement call about someone else's market, made on one
 * day (2026-07-30, web research crossed with Luke's own read, which agreed independently), and prop
 * firms rise and die fast. Re-check it when the firm list is next touched. Two of the five are
 * Tradovate "coming soon" rather than live, and that is correct here: this list labels an account a
 * trader already has, it does not offer a connection.
 *
 * NOT A PAID SLOT, and if it ever becomes one it cannot keep this name. The mechanic is fine; the
 * label is the problem — "Most popular" that is actually "paid" is a lie told on the screen whose
 * job is proving Run is straight with this trader. The deeper question to settle first is whether
 * Run takes money from prop firms AT ALL, given the product exists to stand between this trader and
 * the account they are about to blow. Recorded in the doc, not decided.
 */
export const POPULAR_PROP_FIRMS: readonly string[] = [
  'Tradeify',
  'Take Profit Trader',
  'Lucid Trading',
  'Apex Trader Funding',
  'My Funded Futures',
];

/** The sizes prop accounts are actually sold in. Offered as chips rather than a free number field
 *  because this is a product SKU with a handful of real values, not a quantity — and a typo'd
 *  "5000" silently makes every drawdown percentage in the app wrong. */
export const ACCOUNT_SIZES = [25_000, 50_000, 75_000, 100_000, 150_000, 250_000, 300_000] as const;

/* WHAT `account.prop_firm` HOLDS FOR AN ACCOUNT THAT HAS NO FIRM.
 *
 * A personal account is the trader's own money and has no prop firm at all. This literal is a
 * SENTINEL, not a firm name, and the distinction stopped being academic on 2026-07-31: v2's label
 * form seeded its firm field from `propFirm`, so re-opening a personal account and switching it to
 * Evaluation produced a firm row reading "Personal" with a "P" avatar — Run offering the trader a
 * prop firm that does not exist.
 *
 * Anything reading `propFirm` as a firm must ask this first. */
export const PERSONAL_FIRM = 'Personal';

export function isPersonalFirm(propFirm: string | null): boolean {
  return propFirm === PERSONAL_FIRM;
}

/* THE TRADER-FACING NAME FOR EACH ACCOUNT TYPE.
 *
 * The stored key is `sim_funded` too (see `ACCOUNT_TYPES` in `db/schema.ts` for why the longer word
 * is the honest one), so this map is a thin one today. It still exists, and everything still goes
 * through it: a stored key is a machine token and a label is a sentence fragment, and the day one of
 * them needs to change without the other, a map is the difference between an edit and a migration.
 */
export const ACCOUNT_TYPE_LABELS = {
  evaluation: 'Evaluation',
  sim_funded: 'Sim Funded',
  personal: 'Personal',
} as const;

export type AccountTypeKey = keyof typeof ACCOUNT_TYPE_LABELS;

/** The keys as a VALUE, for controls that offer them as options. Taken from the label map rather
 *  than from `db/schema`, which is the same three strings but drags drizzle into any client bundle
 *  that touches it — and every picker is a client component. The two cannot drift, because a key
 *  with no label could not be rendered. */
export const ACCOUNT_TYPE_KEYS = Object.keys(ACCOUNT_TYPE_LABELS) as AccountTypeKey[];

/* THE ORDER THE ROSTER READS IN, and it lives here because THREE surfaces have to agree on it: the
 * roster's group cards, the summary rail's breakdown, and the phone's scope chips. It was declared
 * separately in the first two - the same three strings, twice - and adding a third copy is how the
 * chips would eventually list Personal above Evaluation while the cards under them did not.
 *
 * CONSEQUENCES FIRST, which is why it is not `ACCOUNT_TYPE_KEYS`' declaration order: a sim-funded
 * account's result is money, an evaluation's is a pass or a fail, and a personal account is
 * whatever the trader wants it to be. */
export const ACCOUNT_TYPE_ORDER: AccountTypeKey[] = ['sim_funded', 'evaluation', 'personal'];

/* HOW EACH KIND OF ACCOUNT CAN END, and it is `schema.ts`'s CHECK constraint `account_type_status_
 * check` restated in the vocabulary layer. The constraint stays the authority - a screen cannot be
 * trusted to hold the line on what is coherent data - but a constraint can only REFUSE, and it
 * refuses in the shape of a driver error. This table is what lets a screen ask the question before
 * the answer becomes a 500.
 *
 * IT SHIPPED AS A MISSING QUESTION (2026-08-28, Luke, on his own corpus): a CLOSED sim-funded
 * account relabelled as an evaluation. The type row offered Evaluation, Save sent it alone, and
 * Postgres refused the pair `evaluation + closed` - correctly, because an evaluation is passed or
 * failed and has no third ending. The trader saw "Could not save the account" and no way forward.
 * Two facts had to move together and only one of them was on screen.
 *
 * THE LABELS ARE NOT v2'S, and `close-account-modal.tsx` carries the reasoning: there is no target
 * on a funded account, so "you dont pass really" - it ends in good standing, or blown.
 *
 * `active` IS DELIBERATELY ABSENT. Every type permits it, and an unlabelled account permits
 * NOTHING ELSE, so it is not an ending and belongs in `accountStatusFits` rather than in a row
 * here. */
export const ACCOUNT_ENDINGS: Record<
  AccountTypeKey,
  readonly { value: AccountStatus; label: string }[]
> = {
  evaluation: [
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
  ],
  sim_funded: [
    { value: 'closed', label: 'Ended in good standing' },
    { value: 'failed', label: 'Blown' },
  ],
  /* ONE ENDING, WHICH IS NOT THE SAME AS NO QUESTION. A personal account just closes, so nothing is
     asked - but the single value still has to be READABLE, because the relabelling path needs to
     know what to write when it stops asking. An empty array said "do not ask" and lost the answer
     with it. */
  personal: [{ value: 'closed', label: 'Closed' }],
};

/* HOW EACH TYPE ENDS, AS PROSE, and it is a second string rather than the button labels joined
 * (2026-08-28, postcheck). The labels were written for a 56px pick row - "Ended in good standing" -
 * and reading them back inside a sentence produced "Sim Funded accounts are ended in good standing
 * or blown, not passed", which is not English. This sentence is shown in the editor AND returned as
 * the 409 body, so it is two user-facing surfaces on one string and it has to read like one. */
const ENDING_PROSE: Record<AccountTypeKey, string> = {
  evaluation: 'An evaluation is passed or failed.',
  sim_funded: 'A sim-funded account ends in good standing, or blown.',
  personal: 'A personal account is closed.',
};

/** The trader's word for a status, lowercase, for use inside a sentence. `active` never appears in
 *  one of these, because a live account has not ended. */
const ENDING_WORD: Record<AccountStatus, string> = {
  active: 'open',
  passed: 'passed',
  failed: 'failed',
  closed: 'closed',
};

/* WHETHER A (TYPE, STATUS) PAIR IS ONE THE DATABASE WILL ACCEPT. The CHECK in four lines:
     null type       -> active only, because nothing has happened to it yet
     any real type    -> active, plus that type's own endings. */
export function accountStatusFits(type: AccountTypeKey | null, status: AccountStatus): boolean {
  if (status === 'active') return true;
  if (type === null) return false;
  return ACCOUNT_ENDINGS[type].some((o) => o.value === status);
}

/* WHY THE PAIR WAS REFUSED, in the trader's own vocabulary, built from the same table so the
 * sentence can never describe endings the picker does not offer. ONE SENTENCE, TWO SURFACES: the
 * editor states it beside the question, and the route sends it back on the 409 for anything that
 * reaches the write path without having asked. */
export function accountEndingMismatch(type: AccountTypeKey | null, status: AccountStatus): string {
  if (type === null) return 'An account with no type yet can only be open.';
  return `${ENDING_PROSE[type]} This one is ${ENDING_WORD[status]}.`;
}

/* AN ACCOUNT WITH NO TYPE YET, and it is an ABSENCE rather than a fourth type - `trades/facets.ts`
 * says the same thing about the firm axis for the same reason. It gets a key so a control can
 * select it, and a title so a group header can print it.
 *
 * IT USED TO READ "Not yet labelled" (2026-08-27, Luke: "im not a fan of the account title 'Not yet
 * labelled'. sounds unprofessional. there has got to be a better option"). Two things were wrong
 * with it. The register: "not yet" is a progress report on the trader, and this build's own rule is
 * that NO STATE MAY REPRESENT ABSENCE - no backlog, no catch-up, nothing that says you are behind.
 * An unlabelled account is a normal state (`db/schema.ts` says so where the column is declared), not
 * an unfinished chore. And the consistency: the filter panel's firm axis has always called the same
 * absence `Unlabelled` (`UNLABELLED_FIRM` below), so the page was using two words for one idea on
 * two surfaces a tap apart. One word, and it is the one that was already shipped. */
export const UNLABELLED_TYPE = 'unlabelled';
export const UNLABELLED_TYPE_TITLE = 'Unlabelled';

/* WHAT AN ACCOUNT'S STATUS IS CALLED, and it is a MAP rather than a derivation on purpose.
 *
 * `run-trading@v2` had three stored values and computed the word from the account's phase, so
 * "Closed" existed only as a label over a stored `failed`. That is the thing this build refused:
 * see `ACCOUNT_STATUSES` in `db/schema.ts` for the bug it caused. With four stored values the word
 * is just the value, and nothing has to know an account's type to name its state.
 *
 * "FAILED" STAYS, and it was researched rather than chosen (`run-trading/docs/prop-firm-identity.md`
 * §5, 2026-07-30): "blown" is the trader's own informal word, "breached" is the firm's word for the
 * rule violation, and "failed" is what the firms themselves print on their dashboards. An earlier
 * pass there softened it to "Ended", which is the product being squeamish about the trader's life
 * on the one page that promises to hold the record without flinching. */
export const ACCOUNT_STATUS_LABELS = {
  active: 'Active',
  passed: 'Passed',
  failed: 'Failed',
  closed: 'Closed',
} as const;

export type AccountStatusKey = keyof typeof ACCOUNT_STATUS_LABELS;

export function statusLabel(status: string): string {
  return ACCOUNT_STATUS_LABELS[status as AccountStatusKey] ?? status;
}

/** Whether an account is still being traded. The roster groups on it, and the chart uses it to
 *  decide whether "1 month" means the last month or the last month THIS ACCOUNT was alive. */
export function isOpenAccount(status: string): boolean {
  return status === 'active';
}

type AccountName = {
  propFirm: string | null;
  sizeDollars: number | null;
  externalAccountId: string;
  displayName?: string | null;
};

/* THE NAME AN ACCOUNT IS SHOWN UNDER, in one place because more than one surface prints it. Two
 * copies would drift the first time either changed, and a trader clicking "TradeDay 100K (...3685)"
 * and landing on a page headed something else would be right to distrust both.
 *
 * "TradeDay 100K (...3685)" when named; the raw Tradovate name when not — never a guess dressed as
 * a fact. The last four separate five accounts at one firm that would otherwise read identically;
 * an UNLABELLED row keeps its full name instead, because the prefix is the only firm hint anyone
 * has and there is no other name to carry.
 */
export function accountRowTitle(a: AccountName): string {
  // THE TRADER'S OWN NAME WINS OUTRIGHT. Everything else derives a name from facts Run collected;
  // a display name is the one the trader typed, and there is nothing to combine it with.
  if (a.displayName) return a.displayName;
  if (!a.propFirm) return placeholderAccountTitle(a.externalAccountId);
  const size = a.sizeDollars ? ` ${sizeLabel(a.sizeDollars)}` : '';
  return `${a.propFirm}${size}${accountLast4(a.externalAccountId)}`;
}

/** What an UNLABELLED account groups under in the filter panel's tree. A real firm name would be a
 *  claim; this is visibly not one, and it sorts to the end beside the named firms. */
export const UNLABELLED_FIRM = 'Unlabelled';

/**
 * The same title WITHOUT the firm, for a row that already sits under its firm.
 *
 * THE FIRM IS THE ROW ABOVE. In the filter panel's tree an account is nested under its firm, so
 * repeating it gives "Tradeify / Tradeify 50K (...4873)" — the one word the trader just read,
 * printed twice, eating the width that the size and the last four actually need.
 *
 * Falls back to the full title when there is no firm to strip, which is exactly the unlabelled case:
 * there the prefix is the only hint anyone has and `accountRowTitle`'s own note says to keep it.
 */
export function accountShortTitle(a: AccountName): string {
  if (a.displayName) return a.displayName;
  if (!a.propFirm) return placeholderAccountTitle(a.externalAccountId);
  const size = a.sizeDollars ? sizeLabel(a.sizeDollars) : '';
  const last4 = accountLast4(a.externalAccountId).trim();
  // Both halves can be empty (no size, placeholder key), which would leave a blank row — so the
  // firm comes back rather than printing nothing.
  return [size, last4].filter(Boolean).join(' ') || a.propFirm;
}

/* THE TITLE, SPLIT WHERE IT IS ALLOWED TO BREAK. One definition, because more than one surface has
 * to truncate this string and each of them must cut in the SAME place.
 *
 *   head  the firm - "Apex Trader Funding". This is the half that gives way.
 *   tail  "50K (...4021)" - the size and the last four. This NEVER truncates.
 *
 * WHY THE TAIL IS SACRED: a plain `truncate` eats from the RIGHT, taking exactly the characters
 * that say WHICH account. A copy-trader running one strategy across twelve Apex accounts is reading
 * those four digits and nothing else; the firm is the half they already know.
 *
 * NOT A CHARACTER COUNT. The tape shipped `name.slice(0, -4)` / `name.slice(-4)` for one release,
 * which split "Apex Trader Funding 50K (...4021)" into head "…50K (...4" and tail "021)" - so a
 * squeezed row lost the size AND half the digits while the code comment above it claimed the digits
 * could not truncate. Splitting at the composition boundary cannot do that, because the boundary is
 * where `accountRowTitle` JOINED the two halves in the first place.
 *
 * A DISPLAY NAME HAS NO TAIL. It is the name the trader typed; there is nothing to protect from
 * truncation and no boundary to split on. Same for a placeholder key.
 */
export function accountTitleParts(a: AccountName): { head: string; tail: string } {
  if (a.displayName) return { head: a.displayName, tail: '' };
  if (!a.propFirm) return { head: placeholderAccountTitle(a.externalAccountId), tail: '' };
  const size = a.sizeDollars ? sizeLabel(a.sizeDollars) : '';
  const last4 = accountLast4(a.externalAccountId).trim();
  return { head: a.propFirm, tail: [size, last4].filter(Boolean).join(' ') };
}

/** " (...3685)", or nothing for one of Run's own placeholder keys — those digits are a uuid
 *  fragment and would read as an account number the trader could go and check. */
export function accountLast4(externalAccountId: string): string {
  if (isPlaceholderAccountName(externalAccountId)) return '';
  const digits = externalAccountId.replace(/\D/g, '');
  return digits.length >= 4 ? ` (...${digits.slice(-4)})` : '';
}

/** An unlabelled account's title. Run's own placeholder key never reaches a trader's eyes;
 *  everything else IS the real Tradovate account name and shows verbatim, because the trader may
 *  want to compare it against Tradovate. */
export function placeholderAccountTitle(externalAccountId: string): string {
  if (!isPlaceholderAccountName(externalAccountId)) return externalAccountId;
  /* "Set on first import", not "Awaiting first import": every other value on that card is a FACT
     about the account, and a status report standing in a value's place reads as though something
     were stuck. The account number genuinely does not exist yet — Tradovate assigns it, and the
     first import is when Run learns it — so say what will happen rather than describe a wait. */
  return 'Set on first import';
}

/** "50K", "150K" — how the firms themselves write it and how a trader says it out loud. */
export function sizeLabel(dollars: number): string {
  return dollars % 1000 === 0 ? `${dollars / 1000}K` : `$${dollars.toLocaleString('en-US')}`;
}
