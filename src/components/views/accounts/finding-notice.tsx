'use client';

/* THE THIRTEEN REFUSALS, IN WORDS. This is the only surface `PreflightCode` ever reaches.
 *
 * The copy lives HERE and not in `wireframes.md`, deliberately (Luke, 2026-08-15): a finding carries
 * a code plus its numbers precisely so the screen can shape a sentence around what actually fits,
 * and whether a number leads or trails, whether it is one row or twelve, is a question only the
 * built component can answer. Drafting all thirteen in a document first would make a second copy of
 * one truth, authored at a different time from the one that ships.
 *
 * THE RULES EVERY LINE HERE FOLLOWS, and they are the reason findings are structured rather than
 * thrown strings:
 *
 *   1. SAY WHAT IS WRONG, THEN WHAT TO DO. A trader who cannot act on a refusal will retry the
 *      identical upload, which is the worst outcome available: it looks like the product is broken
 *      rather than careful.
 *   2. NAME THE NUMBER. "12 of your 87" and "none of them" are different problems with different
 *      remedies, and a message that cannot tell them apart sends both traders to the same place.
 *   3. NEVER BLAME THE TRADER, and never blame the file either when the honest answer is that two
 *      files disagree. The export dialog has separate date pickers; picking two different ranges is
 *      a normal slip, not carelessness.
 *   4. NO EM DASHES (CLAUDE.md). Comma, colon, parentheses, or a plain hyphen.
 *   5. THE APP NEVER NAMES ITSELF. "Your fees", not "Run could not match your fees".
 */

import type { PreflightFinding } from '@/lib/intake/preflight';
import { Icon } from '@/components/ui/icon';

const usd = (cents: number | undefined) => {
  const v = (cents ?? 0) / 100;
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** A headline and the action under it. Two fields rather than one paragraph, because the headline
 *  is what a trader reads at a glance and the second line is what they act on. */
export interface FindingCopy {
  title: string;
  detail: string;
}

export function findingCopy(f: PreflightFinding): FindingCopy {
  const d = f.detail;
  switch (f.code) {
    /* The upload had nothing in it. Not an error the trader caused, and the fix is simply the step
       they thought they had done. */
    case 'nothing_to_import':
      return {
        title: 'These files have no trades in them.',
        detail: 'Check you exported the right range, then drop them again.',
      };

    /* Position History with no Fills. Distinguished from the partial case below because the remedy
       is different: this trader has to upload a file, that one has to re-export a window. Telling
       them the same thing sends the second trader to fetch a file they already gave you. */
    case 'fills_empty':
      return {
        title: 'Your Fills export is missing.',
        detail: `Position History alone cannot be dated. ${plural(d.total ?? 0, 'trade')} are waiting on it.`,
      };

    /* The exports are from different accounts. Checked before the unmatched count, because every
       round trip is unmatched in this case and "187 of 187 have no fills" describes the symptom
       while hiding the cause. */
    case 'accounts_differ':
      return {
        title: 'These files are from different accounts.',
        detail:
          d.fillAccounts && d.fillAccounts.length > 1
            ? `They cover ${plural(d.fillAccounts.length, 'account')}. Export one account at a time.`
            : 'Re-export both from the same account.',
      };

    // Every real Tradovate export names its account, so a row that does not is a file that is not
    // what it claims to be. Never swept into a default: that invents an account.
    case 'rows_unnamed':
      return {
        title: 'Some rows do not name an account.',
        detail: `${plural(d.blocked ?? 0, 'row')} of ${(d.total ?? 0).toLocaleString()} have no account on them. Re-export from the Reports tab.`,
      };

    /* The windows do not line up. The count matters: a handful is a slightly different range, all
       of them is the wrong export entirely. */
    case 'round_trips_unmatched':
      return {
        title: 'Some trades have no matching fills.',
        detail: `${plural(d.blocked ?? 0, 'trade')} of ${(d.total ?? 0).toLocaleString()} cannot be matched${
          d.fillRange && d.otherRange ? `. Your fills cover ${d.fillRange}, these cover ${d.otherRange}` : ''
        }. Re-export both over the same range.`,
      };

    /* THE DANGEROUS ONE, and the copy says why. Not one fee matched, so every trade would price at
       zero fees and net would silently equal gross. On the reference export the fees exceeded the
       gross loss, so this is not "slightly optimistic": it reports about half the real loss. */
    case 'fees_unmatched':
      return {
        title: 'None of your fees matched a trade.',
        detail: `Importing now would report your P&L before costs${
          d.otherRange ? `. Your fees cover ${d.otherRange}, your trades do not` : ''
        }. Re-export Cash History over the same range.`,
      };

    // Cash History absent entirely. Same consequence as above, different cause, so a different
    // sentence: one is a missing file, the other is a mismatched window.
    case 'fees_empty':
      return {
        title: 'Your Cash History export is missing.',
        detail:
          'Tradovate bills fees on four separate lines and only Cash History carries them. Without it your P&L would read about twice as good as it was.',
      };

    // Partial coverage. The same failure as `fees_unmatched` in the half of the window it covers.
    case 'fees_partial':
      return {
        title: 'Your fees only cover part of these trades.',
        detail: `${plural(d.blocked ?? 0, 'fill')} of ${(d.total ?? 0).toLocaleString()} have no fees against them, so those trades would read before costs. Re-export Cash History over the full range.`,
      };

    /* A number, stated, because the whole point of this check is that the figure is absurd and
       seeing it is what makes that obvious. */
    case 'fees_implausible':
      return {
        title: 'These fees are too large to be real.',
        detail: `They work out at ${usd(d.perContractCents)} per contract per round turn, which is far above any broker's schedule. The export looks shifted by a column.`,
      };

    /* NOT BLOCKING. Cash History and Position History are two independent sources for the same
       gross figure, and they disagree. There is no remedy the trader can act on, so this warns. */
    case 'pnl_unreconciled':
      return {
        title: 'Two of your files disagree on P&L.',
        detail: `Cash History says ${usd(d.brokerCents)} and Position History says ${usd(d.ourCents)} across ${plural(d.comparedRoundTrips ?? 0, 'trade')}, a gap of ${usd(d.diffCents)}. Imported, and worth a look.`,
      };

    /* THE THIRD RECEIPT. Blocking, because unlike the gross mismatch this one has a remedy and
       because a misfiled day survives every later correction: the log is append-only and every read
       groups by session date. The days are named, not just counted. */
    case 'statement_unreconciled': {
      const days = d.days ?? [];
      const named = days.slice(0, 3).map((x) => x.sessionDate).join(', ');
      return {
        title: 'Your net does not match the broker statement.',
        detail: days.length
          ? `${plural(days.length, 'day')} of ${(d.daysCompared ?? 0).toLocaleString()} disagree (${named}${days.length > 3 ? ', and more' : ''}), by ${usd(d.absDiffCents)} in total. Re-export over the same range.`
          : 'The statement covers none of the days in these files. Re-export both over the same range.',
      };
    }

    /* NOT BLOCKING. The statement has its own date picker, so a trader exporting all history against
       a ten day fills file is in a legitimate and common state that looks identical in the data to a
       truncated export. Named and priced rather than refused. */
    case 'statement_uncovered':
      return {
        title: 'The statement covers days these files do not.',
        detail: `${plural(d.uncoveredDays?.length ?? 0, 'day')} worth ${usd(d.uncoveredCents)} are not in this import. If you meant to include them, re-export the other files over the same range.`,
      };

    // The file parsed to nothing usable, which is different from a statement that agrees.
    case 'statement_unreadable':
      return {
        title: 'Your Account Balance export could not be read.',
        detail: d.total
          ? `${plural(d.blocked ?? 0, 'row')} of ${(d.total ?? 0).toLocaleString()} have no readable date or amount. Re-export it from the Reports tab.`
          : 'It does not have the columns this check needs. Re-export it from the Reports tab.',
      };
  }
}

/* One finding, rendered. Terracotta for a refusal, muted for a warning — and the SHAPE differs too,
 * not only the colour: a refusal carries the alert mark, a warning does not. Colour alone would put
 * the whole distinction on the one axis a colourblind trader cannot use. */
export function FindingNotice({ finding }: { finding: PreflightFinding }) {
  const { title, detail } = findingCopy(finding);
  return (
    <div className="flex gap-2.5 text-left">
      {finding.blocking && (
        <Icon name="warn" size={16} className="text-neg mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <p className={`text-body font-medium ${finding.blocking ? 'text-text' : 'text-muted'}`}>{title}</p>
        <p className="text-small text-muted mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

/* THE LIST, AND IT SHOWS EVERY ONE. Preflight returns all its findings in one pass rather than the
 * first, because a trader who re-exports to fix one problem should not then discover a second — so
 * rendering only the first would throw that away at the last step. Capped at four with the rest
 * counted: past that it is a wall, and the fix for the first is usually the fix for all of them. */
export function FindingList({ findings }: { findings: PreflightFinding[] }) {
  if (findings.length === 0) return null;
  const shown = findings.slice(0, 4);
  const hidden = findings.length - shown.length;
  return (
    <div className="flex flex-col gap-3">
      {shown.map((f) => (
        <FindingNotice key={f.code} finding={f} />
      ))}
      {hidden > 0 && <p className="text-small text-muted">and {plural(hidden, 'other issue')}.</p>}
    </div>
  );
}
