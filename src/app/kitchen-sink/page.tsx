'use client';

/* THE RACK. Every primitive, every state, both modes, one route.
 *
 * It is the enforcement mechanism for the system's central rule — *if a screen needs a value that
 * isn't in the system, add it to the system first* — because a rack of everything makes a new
 * one-off visible immediately: it will not have a home here.
 *
 * IT IS WHERE YOU SEE THE SYSTEM, NOT WHERE YOU DESIGN IT. When something looks wrong here, the
 * fix is a token in `globals.css`, never a patch on this page. This file is a mirror.
 *
 * WHY IT HAS TO EXIST BEFORE YOU CAN JUDGE: a design system cannot be evaluated one component at
 * a time. A button alone always looks fine; twelve side by side is what reveals that three of
 * them disagree about a radius, or that a muted gray vanishes on a card. `--color-band` exists in
 * this system precisely because "hover on a card was a difference you could prove and could not
 * see" — the kind of bug only an adjacency finds.
 *
 * THE STATES ARE THE POINT, AND SPECIFICALLY THE BAD ONES. Default and hover are what you see
 * every day and are therefore the two that are already right. Empty, error, loading, long-text
 * and the overlong list are the bad-day path, and the bad day is the day the user shows up.
 *
 * NO FIXTURE THAT COULD BE MISTAKEN FOR REAL DATA. Every value here is obviously synthetic —
 * never a plausible P&L figure that could be screenshotted and read as a real trade.
 */

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, cardSurface, slotSurface } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Menu } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { LoadingMark } from '@/components/ui/loading-mark';
import { Wordmark } from '@/components/ui/wordmark';
import { CodeInput } from '@/components/ui/code-input';
import { ThemeToggle } from '@/components/ui/theme-toggle';

// ── the bad-day fixtures ────────────────────────────────────────────────────────────────────
// Deliberately hostile, because the friendly version of each is what every demo already shows.
const SHORT = 'Session summary';
const LONG =
  'Session summary for the account nobody remembered to name before the import ran, covering a window that is longer than any label was designed to hold';
const ERROR_SHORT = 'That code has expired.';
const ERROR_LONG =
  'Cash History covers a window that does not overlap your Fills at all, so no fee could be resolved against any trade, and importing anyway would price every trade at zero fees and report a net that equals gross.';

type Density = 'normal' | 'long';
type ThemeMode = 'light' | 'dark' | 'both';
const WIDTHS = [375, 768, 1280, 1920] as const;
type Width = (typeof WIDTHS)[number];

export default function KitchenSinkPage() {
  // DEV-ONLY. Not shipped, not linked, not in the sitemap. `notFound()` rather than a redirect:
  // a 404 does not confirm the route exists.
  if (process.env.NODE_ENV === 'production') notFound();
  return <Rack />;
}

function Rack() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [width, setWidth] = useState<Width>(1280);
  const [density, setDensity] = useState<Density>('normal');

  const text = density === 'long' ? LONG : SHORT;
  const errorText = density === 'long' ? ERROR_LONG : ERROR_SHORT;

  return (
    <div className="min-h-dvh">
      {/* A review tool, not a product control. Lives here and nowhere else. */}
      <header className="border-border bg-bg sticky top-0 z-50 border-b">
        <div className="mx-auto flex w-full flex-wrap items-center gap-4 px-4 py-3">
          <h1 className="text-title mr-auto">Kitchen sink</h1>

          <Field label="Theme">
            {(['light', 'dark', 'both'] as const).map((t) => (
              <Chip key={t} on={theme === t} onClick={() => setTheme(t)}>
                {t}
              </Chip>
            ))}
          </Field>

          <Field label="Width">
            {WIDTHS.map((w) => (
              <Chip key={w} on={width === w} onClick={() => setWidth(w)}>
                {w}
              </Chip>
            ))}
          </Field>

          {/* The one that finds truncation bugs. Every string swaps for ~3x the length. */}
          <Field label="Density">
            {(['normal', 'long'] as const).map((d) => (
              <Chip key={d} on={density === d} onClick={() => setDensity(d)}>
                {d === 'long' ? 'long text' : 'normal'}
              </Chip>
            ))}
          </Field>
        </div>
      </header>

      {/* SIDE BY SIDE IS THE MODE THAT FINDS BUGS. This system's dark values are per-mode
          literals, not inversions — scrims, shadows and pressed grounds each have their own
          value, so each can be wrong in exactly one mode. Nobody finds that by using the app. */}
      <div className={cn('flex', theme === 'both' ? 'divide-border divide-x' : '')}>
        {(theme === 'both' ? (['light', 'dark'] as const) : ([theme] as const)).map((mode) => (
          <div key={mode} className={cn('min-w-0 flex-1', mode === 'dark' && 'dark')}>
            <div className="bg-bg text-text min-h-dvh">
              <div className="scroll-thin mx-auto overflow-x-auto" style={{ maxWidth: width }}>
                <div className="space-y-12 px-4 py-10" style={{ width }}>
                  <p className="text-caption text-muted">
                    {mode} · {width}px · {density}
                  </p>

                  <Primitives text={text} errorText={errorText} />
                  <TokenProofs />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── primitives ───────────────────────────────────────────────────────────────────────────────

function Primitives({ text, errorText }: { text: string; errorText: string }) {
  const [on, setOn] = useState(true);
  const [choice, setChoice] = useState<'net' | 'gross' | 'fees'>('net');
  const [code, setCode] = useState('');

  return (
    <>
      <Section
        title="Button"
        note="Three variants, three sizes. `loading` disables and swaps the label, so no async action fires twice from a double click."
      >
        <Row label="variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </Row>
        <Row label="sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row label="disabled">
          <Button variant="primary" disabled>
            Primary
          </Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
          <Button variant="ghost" disabled>
            Ghost
          </Button>
        </Row>
        <Row label="loading">
          <Button variant="primary" loading>
            Primary
          </Button>
          <Button variant="secondary" loading>
            Secondary
          </Button>
        </Row>
        <Row label="long label">
          <Button variant="primary">{text}</Button>
        </Row>
        <Note>
          Hover, focus and active are live: tab to a button to see the focus ring, hold the mouse
          down to see the pressed ground.
        </Note>
      </Section>

      <Section title="IconButton" note="A 36px square that acts ON the shell rather than navigating it. Rest is nothing; hover raises a chip; press pushes the same chip in.">
        <Row label="default">
          <IconButton aria-label="Collapse">
            <Icon name="collapse" />
          </IconButton>
          <IconButton aria-label="Expand">
            <Icon name="expand" />
          </IconButton>
          <IconButton aria-label="Close">
            <Icon name="close" />
          </IconButton>
        </Row>
        <Row label="disabled">
          <IconButton aria-label="Collapse" disabled>
            <Icon name="collapse" />
          </IconButton>
        </Row>
      </Section>

      <Section
        title="Icon"
        note="Every mark at the system stroke of 1.5. Lucide ships 2, which reads chunky against a 14px body face and a hairline border. One wrapper, one number, so two icons at the same size can never disagree."
      >
        <Row label="16px (default)">
          {(['today', 'accounts', 'trades', 'read', 'settings', 'collapse', 'expand', 'menu', 'close', 'check', 'chevron', 'moon', 'sun'] as const).map(
            (n) => (
              <span key={n} className="text-muted flex flex-col items-center gap-1">
                <Icon name={n} />
                <span className="text-micro">{n}</span>
              </span>
            ),
          )}
        </Row>
        <Row label="scale">
          <Icon name="today" size={13} />
          <Icon name="today" size={16} />
          <Icon name="today" size={20} />
          <Icon name="today" size={24} />
        </Row>
        <Note>
          On-screen weight scales with rendered size and that is intended: a 24-box mark drawn at
          16px paints a 1.0px stroke. What matters is that two icons at the SAME size agree.
        </Note>
      </Section>

      <Section title="Input" note="Empty, filled, disabled, and in error. The error state must survive text longer than the field.">
        <Row label="empty">
          <Input placeholder="Account name" />
        </Row>
        <Row label="filled">
          <Input defaultValue={text} />
        </Row>
        <Row label="disabled">
          <Input defaultValue="Locked" disabled />
        </Row>
        <div>
          <Input defaultValue="MNQZ9" aria-invalid />
          <p className="text-small text-neg mt-2">{errorText}</p>
        </div>
      </Section>

      <Section title="Textarea">
        <Row label="empty">
          <Textarea placeholder="Why this trade was excluded" />
        </Row>
        <Row label="filled">
          <Textarea defaultValue={text} />
        </Row>
        <Row label="disabled">
          <Textarea defaultValue="Locked" disabled />
        </Row>
      </Section>

      <Section title="Switch" note="A setting, not a form control: it names itself and states what happens.">
        <Switch on={on} onToggle={() => setOn(!on)} title="Exclude quarantined trades" note={text} />
        <Switch on={!on} onToggle={() => setOn(!on)} title="Show fees separately" />
        <Switch on={on} onToggle={() => {}} title="Locked setting" note="Disabled." disabled />
      </Section>

      <Section title="Menu" note="Keyboard driven: the cursor opens on the current choice, so the first Down moves from where you already are.">
        <Row label="closed">
          <Menu
            label="Metric"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'net', label: 'Net' },
              { value: 'gross', label: 'Gross' },
              { value: 'fees', label: 'Fees' },
            ]}
          />
        </Row>
        <Note>Click to open. Arrow keys move, Enter selects, Escape closes.</Note>
      </Section>

      <Section title="Tooltip" note="Hover or focus. `shortcut` renders quieter than the label.">
        <Row label="default">
          <Tooltip label="Collapse navigation" shortcut="[">
            <IconButton aria-label="Collapse">
              <Icon name="collapse" />
            </IconButton>
          </Tooltip>
          <Tooltip label={text}>
            <Button variant="secondary">Long label</Button>
          </Tooltip>
        </Row>
      </Section>

      <Section title="Card" note="`cardSurface` is the raised slot; `slotSurface` is the recessed one. A card is never both.">
        <Card className="p-6">
          <p className="text-body">{text}</p>
        </Card>
        <Card interactive className="p-6">
          <p className="text-body">Interactive: hover and press.</p>
        </Card>
        <div className={cn(slotSurface, 'p-6')}>
          <p className="text-body">Recessed slot, never raised.</p>
        </div>
      </Section>

      <Section title="Spinner · LoadingMark · Wordmark">
        <Row label="spinner">
          <Spinner />
        </Row>
        <Row label="loading mark">
          <LoadingMark />
        </Row>
        <Row label="wordmark">
          <Wordmark />
        </Row>
        <Note>
          The loading mark is the wordmark under `soft-pulse`, which the reduced-motion block
          already suppresses. Toggle reduced motion in the OS to check it still reads.
        </Note>
      </Section>

      <Section title="CodeInput" note="Six digits, one field per digit, paste-aware.">
        <CodeInput value={code} onChange={setCode} />
        <Note>Type or paste a six digit code.</Note>
      </Section>

      <Section
        title="The overlong list"
        note="400 rows. Named in the blueprint because a list that reads fine at six is where layout and performance both give out."
      >
        <div className={cn(cardSurface, 'scroll-thin max-h-64 overflow-y-auto')}>
          {Array.from({ length: 400 }, (_, i) => (
            <div
              key={i}
              className="border-border text-small flex items-center justify-between border-b px-4 py-2 last:border-b-0"
            >
              <span className="truncate">Row {i + 1}</span>
              <span className="num text-muted shrink-0">SAMPLE</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ── token proofs ─────────────────────────────────────────────────────────────────────────────
// Not decoration. Each is a claim in the system that can silently drift.

const TYPE_STEPS = [
  'micro',
  'caption',
  'small',
  'body',
  'body-lg',
  'nav',
  'title',
  'h2',
  'figure',
  'display',
  'hero',
] as const;

const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

const GROUNDS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['hover', 'bg-hover'],
  ['band', 'bg-band'],
] as const;

const INKS = [
  ['text', 'text-text'],
  ['muted', 'text-muted'],
  ['faint', 'text-faint'],
  ['accent', 'text-accent'],
  ['pos', 'text-pos'],
  ['neg', 'text-neg'],
  ['warn', 'text-warn'],
] as const;

function TokenProofs() {
  return (
    <>
      <Section title="Type ramp" note="Every step, its name and what it renders at. A step missing here is a step nothing can use.">
        <div className="space-y-3">
          {TYPE_STEPS.map((step) => (
            <div key={step} className="flex items-baseline gap-4">
              <code className="num text-micro text-muted w-20 shrink-0">{step}</code>
              <span className={`text-${step}`}>The broker&rsquo;s numbers</span>
            </div>
          ))}
        </div>
        <Note>
          Sizes are calibrated to Hanken specifically: its x-height measures 0.49em against
          system-ui&rsquo;s 0.445em, so it sets ~10% optically larger at the same px.
        </Note>
      </Section>

      <Section title="Spacing ramp">
        <div className="space-y-2">
          {SPACE_STEPS.map((s) => (
            <div key={s} className="flex items-center gap-4">
              <code className="num text-micro text-muted w-20 shrink-0">{s}</code>
              <div className="bg-accent h-3" style={{ width: `calc(var(--spacing) * ${s})` }} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Ground stack"
        note="THE ONE THAT CATCHES THE INVISIBLE DIFFERENCE. --color-band exists because hover on a card was a difference you could prove and could not see. If two of these look identical here, that is the finding."
      >
        <div className="border-border flex overflow-hidden rounded-[var(--radius)] border">
          {GROUNDS.map(([name, cls]) => (
            <div key={name} className={cn(cls, 'flex-1 p-6')}>
              <span className="text-micro text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Elevation" note="Dark needs roughly 4x the alpha of light, so these are per-mode literals rather than one shadow reused.">
        <div className="flex flex-wrap gap-6 p-2">
          {(['--shadow-sm', '--shadow-card', '--shadow-press'] as const).map((s) => (
            <div
              key={s}
              className="bg-surface grid h-20 w-40 place-items-center rounded-[var(--radius)]"
              style={{ boxShadow: `var(${s})` }}
            >
              <code className="num text-micro text-muted">{s}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Contrast"
        note="Every ink on every ground. `faint` is aliased to `muted` precisely because this check failed once at 3.43:1, under the 4.5 floor, while rendering timestamps and axis labels."
      >
        <div className="scroll-thin overflow-x-auto">
          <table className="text-small w-full border-collapse">
            <thead>
              <tr>
                <th className="text-caption text-muted p-2 text-left">ink</th>
                {GROUNDS.map(([g]) => (
                  <th key={g} className="text-caption text-muted p-2 text-left">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INKS.map(([ink, inkCls]) => (
                <tr key={ink}>
                  <td className="text-caption text-muted p-2">{ink}</td>
                  {GROUNDS.map(([g, groundCls]) => (
                    <td key={g} className={cn(groundCls, 'p-2')}>
                      <span className={inkCls}>Aa 0.00</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          Read this by eye first: anything that disappears is a failure regardless of what a
          calculator says. `faint` and `muted` are the same ink by design, so those two rows
          matching is correct, not a bug.
        </Note>
      </Section>
    </>
  );
}

// ── the rack's own furniture ─────────────────────────────────────────────────────────────────

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-t pt-8">
      <h2 className="text-h2">{title}</h2>
      {note ? <p className="text-small text-muted mt-1 max-w-prose">{note}</p> : null}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="num text-micro text-muted w-24 shrink-0">{label}</code>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-muted max-w-prose">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-muted">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-caption focus-visible:ring-accent rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:outline-none',
        on ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

export { ThemeToggle };
