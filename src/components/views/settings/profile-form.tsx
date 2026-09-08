'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Menu, type MenuOption } from '@/components/ui/menu';
import { SettingsRow } from './settings-card';

/* PROFILE: the display name and the display timezone. Copied from the reference's
 * `/settings/profile` (2026-09-08): a form with Full Name, Display Name ("We'll address you by this
 * name in the app and emails"), Birthday, and a Timezone combobox, under an `Update Profile` button
 * that is disabled until something changes. Run keeps the two it has a use for.
 *
 * THE TIMEZONE IS DISPLAY ONLY, AND THIS IS THE SCREEN WHERE THAT RULE GETS BROKEN (`CLAUDE.md`,
 * `build-plan.md` §S8b). A timezone control looks like it should change what a session date means.
 * It must not, and it cannot from here: the POST goes to `/api/trader/timezone`, which writes
 * `trader.display_timezone` and nothing else, and the bucketer reads `SESSION_BOUNDARY_ZONE` from
 * `lib/time/session.ts`, which nothing on this page can reach. The note under the control says so
 * to the trader in their own terms.
 *
 * `source: 'chosen'` IS THE WHOLE DIFFERENCE from `DetectTimezone`'s report. A chosen zone wins
 * permanently over the browser's detection; the server enforces that ordering, not this form.
 *
 * `Intl.supportedValuesOf('timeZone')` FOR THE LIST. The runtime already knows every IANA zone it
 * can format in, and shipping a hand-typed list would be the one that goes stale. Grouped by region
 * so America/Chicago is findable among four hundred entries.
 *
 * THE NAME GOES THROUGH BETTER AUTH, not a route of ours: `authClient.updateUser` is the sanctioned
 * writer for `auth_user.name`, and inventing a second one would be a second place a name can change.
 */
export function ProfileForm({
  email,
  initialName,
  initialZone,
}: {
  email: string;
  initialName: string;
  initialZone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [zone, setZone] = useState(initialZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const zones = useMemo<readonly MenuOption<string>[]>(() => {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf('timeZone');
    } catch {
      list = [initialZone];
    }
    if (!list.includes(initialZone)) list = [initialZone, ...list];
    // The label is the zone itself: a trader who knows they are in America/Chicago is not helped by
    // "Central Time", which is ambiguous across a continent and wrong half the year.
    return list.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
  }, [initialZone]);

  const dirty = name.trim() !== initialName || zone !== initialZone;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const jobs: Promise<unknown>[] = [];
      if (name.trim() !== initialName) {
        jobs.push(
          authClient.updateUser({ name: name.trim() }).then((res) => {
            if (res?.error) throw new Error('name');
          })
        );
      }
      if (zone !== initialZone) {
        jobs.push(
          fetch('/api/trader/timezone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone, source: 'chosen' }),
          }).then((res) => {
            if (!res.ok) throw new Error('zone');
          })
        );
      }
      await Promise.all(jobs);
      /* The server is the source of truth for both values, and every surface that shows them is a
         Server Component - so a refresh is the update, not a second copy in local state. */
      router.refresh();
      setSaved(true);
    } catch {
      setError('Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <TextField
        label="Display name"
        hint="How you are addressed in the app and in email."
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        autoComplete="name"
        maxLength={80}
      />
      {/* Read-only, and shown rather than hidden: the address is how you sign in, and a profile
          that does not say which one would send a trader to their inbox to find out. Changing it
          is an auth flow with a verification step, not a text field, and it is not built. */}
      <TextField label="Email" value={email} readOnly disabled />
      <SettingsRow
        title="Time zone"
        note="Sets how times are displayed. Session dates always follow the exchange's 5:00pm Chicago boundary, whatever you choose here."
        control={<Menu label="Time zone" value={zone} options={zones} onChange={(z) => { setZone(z); setSaved(false); }} />}
      />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? 'Saving' : 'Update profile'}
        </Button>
        {error && <p className="text-body text-neg">{error}</p>}
        {saved && !dirty && <p className="text-body text-muted">Saved.</p>}
      </div>
    </form>
  );
}
