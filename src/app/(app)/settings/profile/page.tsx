import type { Metadata } from 'next';
import { requireTrader, getSessionUser } from '@/lib/trader';
import { SettingsCard } from '@/components/views/settings/settings-card';
import { ProfileForm } from '@/components/views/settings/profile-form';

export const metadata: Metadata = { title: 'Profile' };

/* Copied from the reference's `/settings/profile`: one card, one form. This file reads the two
 * values and hands them to the client island as DATA (`CLAUDE.md`: never a function across the
 * boundary). `getSessionUser` and `requireTrader` are both request-cached, so this costs the layout's
 * reads nothing extra. */
export default async function ProfileSettingsPage() {
  const [trader, user] = await Promise.all([requireTrader(), getSessionUser()]);

  return (
    <SettingsCard title="Profile">
      <ProfileForm
        email={user?.email ?? ''}
        initialName={user?.name ?? ''}
        initialZone={trader.displayTimezone}
      />
    </SettingsCard>
  );
}
