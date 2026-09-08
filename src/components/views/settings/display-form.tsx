'use client';

import { useTheme, type ThemePreference } from '@/components/theme-provider';
import { Menu, type MenuOption } from '@/components/ui/menu';
import { SettingsRow } from './settings-card';

/* VISUAL APPEARANCE. The reference's `Display` page is one card holding one control - a combobox
 * labelled "Visual Appearance" whose stored value reads `s:light`, i.e. system / light / dark
 * (`app.monarch.com/settings/display`, 2026-09-08). This is that control on Run's theme provider.
 *
 * `Menu` RATHER THAN `Segmented`, to match the reference's control and because the account menu
 * already offers the one-tap flip; a three-way segmented control here would be a second way to do
 * the same thing with a different gesture. One list, one setting.
 *
 * NO SAVE BUTTON. A theme applies as it is chosen or the screen is lying about what was picked, and
 * the reference's page has no button either. The provider writes storage on the same call.
 */
const OPTIONS: readonly MenuOption<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function DisplayForm() {
  const { preference, setPreference } = useTheme();
  return (
    <SettingsRow
      title="Visual appearance"
      note="System follows your device. Light and dark stay put."
      control={<Menu label="Visual appearance" value={preference} options={OPTIONS} onChange={setPreference} />}
    />
  );
}
