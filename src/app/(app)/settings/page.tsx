import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

/* THE BARE `/settings`, and it renders nothing in the content column on purpose.
 *
 * The reference does exactly this: its `/settings` shows the sub-nav over an empty column, and its
 * sidebar gear skips the question by linking straight to `/settings/profile`. Run's gear and account
 * menu do the same (`SETTINGS_HOME`), so the only way here is a typed URL or a phone - and on a
 * phone this IS the page: the nav renders full-width as the index and there is nothing else to show.
 *
 * NOT A REDIRECT TO PROFILE, because a redirect would take the phone's index away from it.
 */
export default function SettingsIndexPage() {
  return null;
}
