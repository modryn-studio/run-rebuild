/* WHAT IS ON THE TAPE AND OUT OF THE FIGURES, said out loud.
 *
 * `spec.md` §S3: "WHEN a trade is quarantined, THE SYSTEM SHALL show it visibly excluded rather than
 * omitting it silently." The rows are already visible in the tape, marked and muted. This is the
 * other half — the count, stated above them, so the difference between the tape's rows and the
 * rail's figures is a fact the trader was told rather than one they have to notice.
 *
 * IT DOES NOT APPEAR WHEN THERE IS NOTHING TO SAY (`spec.md` §S9b: "Empty: nothing quarantined — the
 * surface doesn't appear at all"). A permanent "0 quarantined" row would be a status light for a
 * condition that has never occurred.
 *
 * THE TWO ACTIONS ARE NOT HERE YET. `S9b` gives a quarantined trade re-sync and
 * exclude-with-a-reason, and neither writes to the trade. Until that lands this states the fact
 * without offering a control that does nothing — a bin with no door is a broken promise, and a door
 * that does not open is a worse one.
 */

import { Icon } from '@/components/ui/icon';

export function QuarantineNotice({
  quarantined,
  excluded,
}: {
  quarantined: number;
  excluded: number;
}) {
  if (quarantined === 0 && excluded === 0) return null;

  const parts: string[] = [];
  if (quarantined > 0) parts.push(`${quarantined.toLocaleString('en-US')} quarantined`);
  if (excluded > 0) parts.push(`${excluded.toLocaleString('en-US')} excluded`);

  return (
    <div className="border-border bg-surface flex items-start gap-2.5 rounded-[var(--radius)] border px-4 py-3">
      <Icon name="warn" size={16} className="text-neg mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-body text-text font-medium">
          {parts.join(', ')}, and left out of every figure on this page.
        </p>
        {/* NAMES THE CONSEQUENCE, not just the state. A trader who reads "2 quarantined" and nothing
            else does not know whether the numbers beside it are affected. */}
        <p className="text-small text-muted mt-0.5">
          {quarantined > 0
            ? 'These are still listed below. Open one to see what could not be reconciled.'
            : 'These are still listed below, with the reason you gave.'}
        </p>
      </div>
    </div>
  );
}
