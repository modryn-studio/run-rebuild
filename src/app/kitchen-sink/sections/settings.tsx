'use client';

import { Note, Row, Section } from '../_components/section';
import { SettingsNav } from '@/components/views/settings/settings-nav';
import { SettingsCard, SettingsRow } from '@/components/views/settings/settings-card';
import { DisplayForm } from '@/components/views/settings/display-form';
import { DeleteAccount, DownloadTrades } from '@/components/views/settings/data-actions';
import { Button } from '@/components/ui/button';

/* THE SETTINGS PATTERN, racked in the same commit it shipped (`CLAUDE.md`: a component isn't done
 * until it appears here in every state).
 *
 * WHAT TO CHECK: the sub-nav's active row is the sidebar's `bg-selected` and nothing else changes
 * on it; the disabled `Notifications` row reads muted and explains itself on hover; the card's
 * heading row, rule and body match `Card`'s radius and shadow; a `SettingsRow` puts its control on
 * the right at the same y as a Visibility switch in the account editor; the destructive form's
 * button stays disabled until the field matches.
 *
 * THE NAV IS RENDERED AT ITS DESKTOP WIDTH regardless of viewport, because in the rack the question
 * is "does the row read right", not "does the page lay out" - `/settings` itself answers the second.
 * It shows every row inactive: the rack's pathname matches none of them, which is also the honest
 * state to inspect the resting treatment in.
 *
 * `DeleteAccount` IS GIVEN A FIXTURE ADDRESS, so its enabled state can be reached by typing it. The
 * form posts to `/api/trader/erase`, which compares against the SESSION's address, so a rack visitor
 * who types the fixture and presses the button gets a 400 - nothing can be erased from here. */
export function SettingsSection() {
  return (
    <Section
      id="settings"
      title="Settings"
      intro="The reference's settings shape on Run's tokens: a two-group sub-nav card, then a column of titled cards, each holding rows with one control on the right. Read from the live DOM on 2026-09-08 - 242px nav, 40px rows at 8px radius, 757px cards at 12px - and mapped onto the nearest named steps."
    >
      <Row label="Sub-nav" note="every row resting; the active treatment is the sidebar's own">
        <div className="max-w-xs">
          <SettingsNav className="!block" />
        </div>
      </Row>

      <Row label="Card with rows" note="title, optional sentence, rule, body">
        <div className="max-w-2xl">
          <SettingsCard
            title="Display"
            description="One control, applying as it is chosen."
            action={
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            }
          >
            <DisplayForm />
            <SettingsRow
              title="A second row"
              note="Sits under the first with the same rhythm as the account editor's switches."
              control={
                <Button variant="secondary" size="md">
                  Control
                </Button>
              }
            />
          </SettingsCard>
        </div>
      </Row>

      <Row label="Export" note="the trades CSV, built server-side for the whole record">
        <div className="max-w-2xl">
          <SettingsCard title="Download your trades">
            <DownloadTrades />
          </SettingsCard>
        </div>
      </Row>

      <Row label="Destructive" note="disabled until the field matches the fixture address">
        <div className="max-w-2xl">
          <SettingsCard
            title="Delete your account"
            description="Removes every import, every trade, every account, and your sign-in. Nothing is kept, and it cannot be undone."
          >
            <DeleteAccount email="trader@fixture.invalid" />
          </SettingsCard>
          <Note>Type trader@fixture.invalid to see the enabled state. The route compares against the session, so pressing it here answers 400.</Note>
        </div>
      </Row>
    </Section>
  );
}
