import type { Metadata } from 'next';
import { SettingsCard } from '@/components/views/settings/settings-card';
import { DisplayForm } from '@/components/views/settings/display-form';

export const metadata: Metadata = { title: 'Display' };

/* Copied from the reference's `/settings/display`: one card, one control. The form is the client
 * island; this file is the frame. */
export default function DisplaySettingsPage() {
  return (
    <SettingsCard title="Display">
      <DisplayForm />
    </SettingsCard>
  );
}
