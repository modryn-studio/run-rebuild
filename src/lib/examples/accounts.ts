/* EXAMPLE DATA FOR `/accounts`' EMPTY STATE. See `examples/trades.ts` for what "example" means here
 * and the fence around it: invented numbers, legal only at 40% under the "Let's begin" card.
 *
 * THREE ACCOUNTS BECAUSE THE PAGE'S POINT IS THE ROSTER: one funded, one evaluation that ended, one
 * personal. The mix shows the three chips, the excluded switch, and a closed row's shorter window -
 * which is what a prop trader with several accounts will actually see, and what a single example
 * row could not show. Firms are ones the seed already knows so the logos resolve.
 *
 * DATES IN 2027, like every example, so nothing here can be mistaken for a live session.
 */
import type { DayPoint, RosterAccount } from '@/lib/accounts/read';

export const EXAMPLE_ROSTER: RosterAccount[] = [
  {
    id: 'example-acct-1',
    externalAccountId: 'APEX150K04873',
    platform: 'tradovate',
    propFirm: 'Apex',
    firmSource: 'detected',
    sizeDollars: 150_000,
    accountType: 'sim_funded',
    productName: null,
    displayName: null,
    status: 'active',
    closedOn: null,
    hidden: false,
    excludedFromTotals: false,
    trades: 184,
    netCents: 1_284_650,
    lastSessionDate: '2027-03-19',
  },
  {
    id: 'example-acct-2',
    externalAccountId: 'TDFY50K05120',
    platform: 'tradovate',
    propFirm: 'Tradeify',
    firmSource: 'detected',
    sizeDollars: 50_000,
    accountType: 'evaluation',
    productName: null,
    displayName: null,
    status: 'failed',
    closedOn: '2027-03-02',
    hidden: false,
    excludedFromTotals: false,
    trades: 41,
    netCents: -212_400,
    lastSessionDate: '2027-03-02',
  },
  {
    id: 'example-acct-3',
    externalAccountId: 'DEMO7731',
    platform: 'tradovate',
    propFirm: null,
    firmSource: null,
    sizeDollars: null,
    accountType: 'personal',
    productName: null,
    displayName: 'Personal',
    status: 'active',
    closedOn: null,
    hidden: false,
    excludedFromTotals: false,
    trades: 26,
    netCents: 38_900,
    lastSessionDate: '2027-03-18',
  },
];

/** A month of sessions across the three accounts, folding to a line that goes somewhere. */
export const EXAMPLE_DAYS: DayPoint[] = [
  ['2027-02-24', 41_250, 6, 'example-acct-1'],
  ['2027-02-25', -18_800, 11, 'example-acct-1'],
  ['2027-02-25', -96_000, 9, 'example-acct-2'],
  ['2027-02-26', 7_400, 3, 'example-acct-3'],
  ['2027-03-01', 84_000, 9, 'example-acct-1'],
  ['2027-03-02', -61_025, 14, 'example-acct-1'],
  ['2027-03-02', -116_400, 12, 'example-acct-2'],
  ['2027-03-04', 12_600, 4, 'example-acct-3'],
  ['2027-03-05', -3_450, 7, 'example-acct-1'],
  ['2027-03-08', 1_284_000, 21, 'example-acct-1'],
  ['2027-03-09', -22_100, 5, 'example-acct-1'],
  ['2027-03-11', 9_900, 3, 'example-acct-3'],
  ['2027-03-12', -7_250, 8, 'example-acct-1'],
  ['2027-03-16', 33_400, 6, 'example-acct-1'],
  ['2027-03-18', -14_050, 9, 'example-acct-3'],
  ['2027-03-19', 52_775, 12, 'example-acct-1'],
].map(([day, cents, trades, accountId]) => ({
  day: day as string,
  cents: cents as number,
  trades: trades as number,
  accountId: accountId as string,
}));
