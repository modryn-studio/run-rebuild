import type { Metadata } from 'next';
import { requireTrader, getSessionUser } from '@/lib/trader';
import { SettingsCard } from '@/components/views/settings/settings-card';
import { DownloadTrades, DeleteAccount } from '@/components/views/settings/data-actions';

export const metadata: Metadata = { title: 'Data' };

/* YOUR DATA: out, or gone. Copied in shape from the reference's `/settings/data` - a column of
 * cards, the exports first and the destructive actions last, each destructive card saying exactly
 * what it removes and what it leaves. Two cards rather than their five, because Run has one kind of
 * record and one kind of leaving.
 *
 * THE ERASURE CARD IS THE PRIVACY POLICY'S "HOW". `build-plan.md` §3: "the Privacy Policy has to
 * describe the erasure path", and until this page there was no path for it to describe. */
export default async function DataSettingsPage() {
  const [, user] = await Promise.all([requireTrader(), getSessionUser()]);

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Download your trades"
        description="Everything in your record, in a file you can open anywhere. The numbers match what you see here to the cent."
      >
        <DownloadTrades />
      </SettingsCard>
      <SettingsCard
        title="Delete your account"
        description="Removes every import, every trade, every account, and your sign-in. Nothing is kept, and it cannot be undone. Download your trades first if you want them."
      >
        <DeleteAccount email={user?.email ?? ''} />
      </SettingsCard>
    </div>
  );
}
