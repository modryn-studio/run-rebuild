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

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
import { ProgressPanel, type Step } from '@/components/views/accounts/progress-panel';
import { FindingNotice } from '@/components/views/accounts/finding-notice';
import type { PreflightFinding } from '@/lib/intake/preflight';

// ── the bad-day fixtures ────────────────────────────────────────────────────────────────────
// Deliberately hostile, because the friendly version of each is what every demo already shows.
const SHORT = 'Session summary';
const LONG =
  'Session summary for the account nobody remembered to name before the import ran, covering a window that is longer than any label was designed to hold';
const ERROR_SHORT = 'That code has expired.';
const ERROR_LONG =
  'Cash History covers a window that does not overlap your Fills at all, so no fee could be resolved against any trade, and importing anyway would price every trade at zero fees and report a net that equals gross.';

const NAV_DEMO = ['Today', 'Accounts', 'Trades', 'Read'] as const;

type Density = 'normal' | 'long';
type ThemeMode = 'light' | 'dark' | 'both';
const WIDTHS = [375, 768, 1280, 1920] as const;
type Width = (typeof WIDTHS)[number];

/* SHIPS TO PRODUCTION, deliberately (Luke, 2026-08-13). It was dev-gated and that was wrong: the
 * rack's whole job is review, and "works on mobile" means a DEPLOYED build on a real phone. A route
 * that only exists on localhost cannot be opened on the device it is meant to be judged on.
 * Unlinked and `noindex` like the rest of the app, so nothing points at it. */
export default function KitchenSinkPage() {
  return <Rack />;
}


/* ── FINDING THINGS IN HERE ───────────────────────────────────────────────────────────────────
 *
 * Twenty-five sections in one column is a scroll, not a rack. Added 2026-08-15 when the intake's
 * four sections pushed it past the point where you could find anything (Luke: "it's become very
 * large and i need organization").
 *
 * WHAT TOP DESIGN-SYSTEM SITES ACTUALLY DO, and it is the same three things everywhere — Storybook,
 * Radix, Polaris, Carbon: a PERSISTENT GROUPED NAV, the current item MARKED, and the content in one
 * scrolling column. That is the whole pattern. What they add beyond it (per-component routes, a
 * search index, versioned docs, MDX) is infrastructure that pays for itself at hundreds of
 * components and dozens of contributors, and buys nothing at twenty-five and one.
 *
 * SO: NO ROUTER, NO SEARCH BOX. A search field over twenty-five items you can see at once is a
 * control that exists to look busy — the same reasoning that keeps a search out of the broker
 * picker. And a route per section would break the one property this page is FOR: side-by-side
 * adjacency is what catches three components disagreeing about a radius, and you cannot compare
 * across a navigation.
 *
 * GROUPED BY WHAT A THING IS, not by which file it lives in. `Nav row` and `The overlong list` are
 * compositions rather than primitives; the ramps and contrast tables are proofs rather than
 * components. Those are different questions and they were interleaved.
 */

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const GROUPS: { group: string; titles: string[] }[] = [
  { group: 'Controls', titles: ['Button', 'IconButton', 'ThemeToggle', 'Switch', 'Menu'] },
  { group: 'Inputs', titles: ['Input', 'Textarea', 'CodeInput'] },
  { group: 'Marks and feedback', titles: ['Icon', 'Tooltip', 'Spinner · LoadingMark · Wordmark'] },
  { group: 'Surfaces', titles: ['Card'] },
  {
    group: 'Compositions',
    titles: ['Nav row: the reference, and what ships', 'Nav row: what it replaced', 'The overlong list'],
  },
  {
    group: 'Intake (S4e)',
    titles: [
      'Intake · progress panel',
      'Intake · the thirteen refusals',
      'Intake · required-file checklist',
      'Intake · staged file rows',
    ],
  },
  {
    group: 'Tokens and proofs',
    titles: ['Type ramp', 'Spacing ramp', 'Ground stack', 'Elevation', 'Contrast', 'Ink roles', 'Edges'],
  },
];

/* ONLY THE FIRST PANE CARRIES THE ANCHOR IDS. In `both` mode every section renders twice, and two
 * elements with one id is a broken document — `getElementById` would return the light one and the
 * observer would watch a duplicate. The two panes scroll TOGETHER in one container at the same
 * vertical offsets, so anchoring the first also aligns the second. */
const AnchorCtx = createContext(true);

/** The rail. Sticky, its own scroll, and it never scrolls the page — only the content column. */
function SectionNav({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState<string | null>(null);

  /* SCROLL-SPY ON THE CONTAINER, not the window: the rack scrolls an inner element (it matches the
     app shell, so the document itself never moves) and an observer with no `root` would watch the
     viewport and never fire. */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const targets = [...root.querySelectorAll('section[id]')];
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // The topmost intersecting section wins, so scrolling up marks the one you arrived at
        // rather than whichever fired last.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A band near the top: a section counts as current once its heading reaches the upper third.
      { root, rootMargin: '0px 0px -66% 0px', threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [scrollRef]);

  return (
    <nav
      aria-label="Sections"
      className="scroll-thin border-border hidden w-56 shrink-0 overflow-y-auto border-r px-3 py-6 lg:block"
    >
      {GROUPS.map(({ group, titles }) => (
        <div key={group} className="mb-5">
          <p className="text-micro text-muted px-2 pb-1.5 uppercase">{group}</p>
          <ul>
            {titles.map((t) => {
              const id = slug(t);
              const on = active === id;
              return (
                <li key={t}>
                  <button
                    onClick={() => {
                      const el = scrollRef.current?.querySelector(`#${id}`);
                      el?.scrollIntoView({ block: 'start' });
                    }}
                    aria-current={on ? 'true' : undefined}
                    className={cn(
                      'text-small w-full truncate rounded-[var(--radius-sm)] px-2 py-1 text-left transition-colors',
                      on ? 'bg-hover text-text font-medium' : 'text-muted hover:text-text'
                    )}
                  >
                    {t}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* The rack shows the pieces; the demo shows the FLOW. Two different questions, and the one
          this page cannot answer deserves a door rather than a mention. */}
      <a
        href="/kitchen-sink/demo"
        className="border-border text-small hover:bg-hover mt-2 flex items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 transition-colors"
      >
        <Icon name="upload" size={14} className="text-muted shrink-0" />
        Add account, live
      </a>
    </nav>
  );
}

function Rack() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [width, setWidth] = useState<Width>(1280);
  const [density, setDensity] = useState<Density>('normal');

  const text = density === 'long' ? LONG : SHORT;
  const errorText = density === 'long' ? ERROR_LONG : ERROR_SHORT;

  /* The scroll container, handed to the rail so its observer watches the right element. */
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    /* h-dvh + an internal scroll region, matching the app shell. The rack sits OUTSIDE the
       shell (a review surface has no business carrying app nav), so without this the document
       scrolls and you get the platform's grey slab instead of `.scroll-thin`. */
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* A review tool, not a product control. Lives here and nowhere else. */}
      <header className="border-border bg-bg shrink-0 border-b">
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
      <div className="flex min-h-0 flex-1">
        <SectionNav scrollRef={scrollRef} />
        <div
          ref={scrollRef}
          className={cn('scroll-thin flex min-h-0 flex-1 overflow-y-auto', theme === 'both' ? 'divide-border divide-x' : '')}
        >
        {(theme === 'both' ? (['light', 'dark'] as const) : ([theme] as const)).map((mode, paneIndex) => (
          <AnchorCtx.Provider key={mode} value={paneIndex === 0}>
          <div className={cn('min-w-0 flex-1', mode === 'dark' && 'dark')}>
            <div className="bg-bg text-text min-h-full">
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
          </AnchorCtx.Provider>
        ))}
        </div>
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
        note="Four variants, three sizes. `outline` rests on a quiet accent/40 edge and firms to the full accent under the pointer; `secondary` rests on the hairline and firms to `border-strong`. `loading` disables and swaps the label, so no async action fires twice from a double click."
      >
        {/* `outline` was missing from this row until 2026-08-14 and that omission cost something
            real: it is the one variant whose edge was drawn with an ALPHA, and an alpha composites
            differently per mode. Side by side in both columns it reads 2.85:1 in light and 1.09:1
            in dark, i.e. no visible edge at all on the right. Four variants exist, so four render. */}
        <Row label="variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
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
          <Button variant="outline" disabled>
            Outline
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

      {/* NEVER RACKED UNTIL 2026-08-14, and it is the only primitive in `components/ui` that had
          not been. What one render found: a hand-rolled 44px bordered circle with its own focus ring
          and a scale-shrink press — three decisions the system had each since made differently,
          preserved intact in the one component nothing had ever looked at. Not a considered
          deviation; just the pre-consolidation copy, carried across from a build that had already
          replaced it. It now IS an IconButton, so it agrees with its neighbour above by
          construction rather than by matching classes. See theme-toggle.tsx for the three answers. */}
      <Section
        title="ThemeToggle"
        note="An IconButton with a mode-dependent mark. It toggles the real theme, so in `both` mode use the header chips to switch and this to look at the control."
      >
        <Row label="default">
          <ThemeToggle />
        </Row>
        <Row label="beside IconButton">
          <IconButton aria-label="Collapse">
            <Icon name="collapse" />
          </IconButton>
          <ThemeToggle />
        </Row>
        <Note>
          The adjacency is the check, and it is why this section exists at this width: these two are
          the same control class, so at rest they must both be bare glyphs, hover to the same chip,
          and press to the same inset. Any daylight between them is a defect in one of the two.
        </Note>
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

      <Section
        title="Textarea"
        note="The same states as Input, because these are one object at two heights. Any state Input renders and this does not is a place the pair can drift unnoticed, which is how it acquired three separate divergences last time."
      >
        <Row label="empty">
          <Textarea placeholder="Why this trade was excluded" />
        </Row>
        <Row label="filled">
          <Textarea defaultValue={text} />
        </Row>
        <Row label="disabled">
          <Textarea defaultValue="Locked" disabled />
        </Row>
        {/* The error state was missing while Input had one — the exact asymmetry this section's
            note warns about, found by reading the two side by side. */}
        <div>
          <Textarea defaultValue="Cash History does not overlap these fills." aria-invalid />
          <p className="text-small text-neg mt-2">{errorText}</p>
        </div>
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
        {/* NESTED IN A CARD, because that is the only place it is judgeable. Shown directly on the
            page it measured LIGHTER than its ground in both modes and read as raised, which is the
            opposite of its job: a recess in the sheet, not an object on it. */}
        <Card className="p-4">
          <div className={cn(slotSurface, 'p-6')}>
            <p className="text-body">Recessed slot, never raised. Shown inside a card, where it belongs.</p>
          </div>
        </Card>
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

      <Section
        title="CodeInput"
        note="Six digits, one real field under six drawn boxes, paste-aware. It keeps `--color-field` at rest where Input and Textarea do not: there is no placeholder and no label inside these, so the outline is the only thing saying a control is here."
      >
        {/* `w-72` (288px) RATHER THAN LETTING IT FILL THE RACK, because that is roughly the
            sign-in card's real content box (279px at 375, 288px above it). These boxes size by
            growing into their row, so shown at rack width they would render wider than they can
            ever be in production and the 48px cap would never engage. A rack that shows a control
            at a width it never has is not showing the control.

            `invalid` and `disabled` are real props that nothing rendered until 2026-08-14. The
            disabled one matters most: this is the component whose disabled state once left a
            trader typing into six boxes that could not receive it. */}
        <Row label="live">
          <div className="w-72">
            <CodeInput value={code} onChange={setCode} />
          </div>
        </Row>
        <Row label="invalid">
          <div className="w-72">
            <CodeInput value="123456" onChange={() => {}} invalid />
          </div>
        </Row>
        <Row label="disabled">
          <div className="w-72">
            <CodeInput value="1234" onChange={() => {}} disabled />
          </div>
        </Row>
        <Note>
          Type or paste a six digit code into the live one. The active box draws its own ring
          because the field underneath is transparent and the global outline would land on nothing.
        </Note>
      </Section>

      {/* ── THE NAV ROW DECISION, both candidates rendered rather than described ─────────────
          All three systems agree on the geometry: a 224px rail, an 8px row radius, 16px type, and
          `surface-2` as the active ground. They disagree on ONE thing, and only measurement showed
          it — the previous build was assumed to have copied the reference here and did not.

          Measured live 2026-08-13, the reference on its Accounts page and the previous build on
          localhost:

            reference   inactive 16/400 FULL INK   active 16/400 full ink + surface-2
            previous    inactive 16/500 muted      active 16/500 full ink + surface-2
            this build  inactive 16/500 muted      active 16/500 full ink + surface-2

          So the previous build diverged from the reference on weight AND on inactive colour, and
          this build inherited that divergence. `design-system.md` already flagged the rule as "the
          one thing to re-examine, not adopt", because it was tuned against a twelve-row sidebar and
          Run has four. Four rows are below. */}
      <Section
        title="Nav row: the reference, and what ships"
        note="ADOPTED 2026-08-13. Every row full ink at 400; the active row is distinguished by its ground alone, so the sidebar stops competing with the content it points at."
      >
        <div className="bg-bg w-56 rounded-[var(--radius)] p-3">
          {NAV_DEMO.map((r) => (
            <div
              key={r}
              className={cn(
                'text-nav text-text flex min-h-9 items-center rounded-sm px-3',
                r === 'Accounts' && 'bg-surface-2',
              )}
            >
              {r}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Nav row: what it replaced"
        note="Kept only as the comparison. Inactive muted at 500, active full ink at 500, plus the same ground: three signals where one does the job. This is what the previous build shipped."
      >
        <div className="bg-bg w-56 rounded-[var(--radius)] p-3">
          {NAV_DEMO.map((r) => (
            <div
              key={r}
              className={cn(
                // Hard-coded ON PURPOSE: this is a frozen record of what was replaced, so it must
                // not move when `--text-nav` does. It read 500 until the token dropped to 400.
                'flex min-h-9 items-center rounded-sm px-3 text-[16px] leading-6 font-medium tracking-[-0.01em]',
                r === 'Accounts' ? 'bg-surface-2 text-text' : 'text-muted',
              )}
            >
              {r}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="The overlong list"
        note="400 rows. Named in the blueprint because a list that reads fine at six is where layout and performance both give out."
      >
        <div className={cn(cardSurface, 'scroll-thin max-h-64 overflow-y-auto')}>
          {Array.from({ length: 400 }, (_, i) => (
            <div
              key={i}
              /* `rule`, the divider weight. These 400 rows were the bulk of the 438-border census
                 that found one token doing three jobs, and every one of them was drawn at the
                 weight of a card's edge. */
              className="border-rule text-small flex items-center justify-between border-b px-4 py-2 last:border-b-0"
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
] as const;

const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

const GROUNDS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['hover', 'bg-hover'],
  ['band', 'bg-band'],
] as const;

/* EVERY LINE THIS SYSTEM CAN DRAW, AND THE JOB THAT SETS ITS FLOOR.
 *
 * The `Contrast` table below proves SC 1.4.3 — ink on ground. Nothing proved SC 1.4.11 — the
 * NON-TEXT contrast of a control's own edge — and that omission is why a census of this build found
 * every single border in the rack painted at one value (`--color-border`, 1.30:1 on a white card in
 * light, 1.40:1 in dark) while `--color-rule` had zero call sites and `--color-border-strong` had
 * one. A ramp that exists only in the token file is not a ramp.
 *
 * THE FLOOR IS SET BY THE JOB, NOT BY THE TOKEN, which is the whole point of this column:
 *
 *   divider   separates siblings inside a container       decoration, WCAG exempts it, no floor
 *   edge      bounds an object, or rests under a          not required information, no floor
 *             LABELLED control (a secondary button)
 *   hover     firms an edge up under the pointer          no floor: you already found the control
 *   control   IS the control — the only thing saying      SC 1.4.11, 3:1
 *             one is there (a field, a focus ring,
 *             an invalid state, a switch track)
 *
 * So `rule` at 1.09 is CORRECT, `border` under a labelled button at 1.30 is CORRECT, and `border`
 * on an input at 1.30 is a defect. One number, three verdicts, and the same table has to be able to
 * say all three. Read the `job` column before you read the number.
 *
 * The first pass got this wrong in the direction that looks safe: it read "interactive" as the
 * category and put the secondary button on the 3:1 edge, which is a floor that does not reach it
 * and which took its hover from a 1.47x step to 2.94x. A rule over-applied is still a rule broken.
 */
const EDGES = [
  ['border', 'border-border', 'edge', 0],
  ['rule', 'border-rule', 'divider', 0],
  ['chart-axis', 'border-[var(--chart-axis)]', 'divider', 0],
  ['border-strong', 'border-border-strong', 'hover', 0],
  /* BACK IN THE TABLE, because it is now measurable. This row is what caught the parser bug: it
     was reported at 1.09:1 in dark, which is what an oklab lightness looks like when it is read as
     a red channel. Composited properly it is 2.20, and the two modes agree. */
  ['accent/40', 'border-accent/40', 'edge', 0],
  ['accent-hover', 'border-accent-hover', 'hover', 0],
  ['field', 'border-field', 'control', 3],
  ['accent', 'border-accent', 'control', 3],
  ['neg', 'border-neg', 'control', 3],
  ['switch-off', 'border-[var(--switch-off)]', 'control', 3],
] as const;

/* `faint` IS GONE FROM THIS TABLE because the token is gone (2026-08-14). It was an alias of
   `muted` with four call sites, and a second name for one value is the same failure as one name
   doing three jobs. Two ink tiers, and which one a string takes is now a question about its JOB -
   see the `Ink roles` proof below. */
const INKS = [
  ['text', 'text-text'],
  ['muted', 'text-muted'],
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
                    <ContrastCell key={g} ground={g} groundCls={groundCls} inkCls={inkCls} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          Ratios are computed from the colours the browser actually painted, not from a token map,
          so this cannot drift from what it describes. Read it by eye FIRST: anything that
          disappears is a failure regardless of what the number says. `faint` and `muted` are the
          same ink by design, so those two rows matching is correct, not a bug.
        </Note>
      </Section>

      <Section
        title="Ink roles"
        note="Two tiers, and which one a string takes is a question about its job rather than its importance. The Contrast table above proves an ink is legible; nothing proved it was in the right role, which is how thirty explanatory passages in this rack came to be set in the ink reserved for properties."
      >
        {/* `max-w-md`, because a specimen has to be legible as the thing it describes. Full-bleed,
            the right-aligned metadata sat 900px from the name it is a property of and off the edge
            of the pane in `both` mode - so the one comparison this section exists to make was the
            one thing you could not see. It is also the honest width: these appear in the product as
            a row inside a card, never as a 1280px band. */}
        <div className={cn(cardSurface, 'max-w-md p-6')}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-body-lg">Continental ES</span>
            {/* METADATA: a property of the row it sits on. Scanned, never read as a sentence. */}
            <span className="num text-small text-muted">7 trades · 14 Aug</span>
          </div>
          {/* PROSE: an explanation. Meant to be read, so full-strength ink at a size from the ramp. */}
          <p className="text-small mt-3 max-w-prose">
            Fees resolved to the cent against Cash History, so this net is the broker&rsquo;s number
            and not ours. Nothing here is derived from the commission column.
          </p>
        </div>
        <Note>
          Read the two together: the date and count recede because they are properties of the name
          beside them, and the paragraph does not, because someone has to read it. If the paragraph
          looks heavy, the fix is a smaller step on the type ramp, never a quieter ink. Muted was
          never carrying hierarchy here; it was only making sentences harder to read.
        </Note>
      </Section>

      <Section
        title="Edges"
        note="The same proof for lines instead of ink, and the floor comes from the job. A divider is decoration and WCAG exempts it, so faint is the design. A labelled button is identified by its label, so its edge is chrome and carries no floor either. Only a line that IS the control (a field's outline, a focus ring, a switch track) has to clear 3:1, and only those rows are marked."
      >
        <div className="scroll-thin overflow-x-auto">
          <table className="text-small w-full border-collapse">
            <thead>
              <tr>
                {/* `w-px` on the two label columns, or `w-full` splits eight columns evenly and
                    the five grounds - the part being measured - get squeezed to a third of the
                    table each side of the rack's split view. A width of 1px on a table cell is the
                    idiom for "shrink to your content". */}
                <th className="text-caption text-muted w-px p-2 text-left">line</th>
                <th className="text-caption text-muted w-px p-2 text-left">job</th>
                {GROUNDS.map(([g]) => (
                  <th key={g} className="text-caption text-muted p-2 text-left">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EDGES.map(([edge, edgeCls, job, floor]) => (
                <tr key={edge}>
                  <td className="text-caption text-muted w-px p-2 whitespace-nowrap">{edge}</td>
                  <td className="text-caption text-muted w-px p-2 whitespace-nowrap">{job}</td>
                  {GROUNDS.map(([g, groundCls]) => (
                    <EdgeCell key={g} groundCls={groundCls} edgeCls={edgeCls} floor={floor} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          The swatch is unfilled on purpose, so the number is the edge against the ground it sits
          on rather than against a fill that happens to be lighter. A control carrying its own
          `surface` fill has to clear the floor against both, and `surface` is a column here.
          `switch-off` is a FILL rather than a line and is drawn as one here anyway: the track
          carries no edge, so the fill is that control&rsquo;s boundary and the same 3:1 lands on it.
          A switch keeps its floor where a button gives its back, because a switch has no label
          inside it to do the identifying.
        </Note>
      </Section>

      {/* ── S4e: THE INTAKE ─────────────────────────────────────────────────────────────────
          Added 2026-08-15. The rack is where a component is reviewed, so one that is not in it has
          not been looked at — and the intake's states are unusually hard to reach by hand: a
          failure needs a deliberately broken export, and thirteen of them need thirteen. */}
      <Section
        title="Intake · progress panel"
        note="Every state the real panel can be in. The live one arrives from the server's NDJSON stream as each file lands; nothing here advances on a timer, and nothing here is on a timer either."
      >
        <Row label="running">
          <RackPanel steps={PANEL_RUNNING} />
        </Row>
        <Row label="failed">
          <RackPanel steps={PANEL_FAILED} />
        </Row>
        <Row label="done">
          <RackPanel steps={PANEL_DONE} />
        </Row>
        <Note>
          Failure is distinguished by SHAPE, not only colour: a cross mirrors the tick exactly, so
          the two terminal states read as opposites at a glance. A tinted disc with a dot in it
          would be the active bullet recoloured, and terracotta against pine is precisely the
          confusable pair. The detail line renders only on failure, because on success five labels
          each with a number under them read as a busy list.
        </Note>
      </Section>

      <Section
        title="Intake · the thirteen refusals"
        note="Every PreflightCode, with its real detail object. This is the only surface these ever reach: there is no confirm panel in the flow, so a refusal has exactly one place to be read."
      >
        <div className="flex flex-col gap-5">
          {RACK_FINDINGS.map((f) => (
            <div key={f.code} className="flex flex-col gap-1.5">
              <code className="num text-micro text-muted">{f.code}</code>
              <FindingNotice finding={f} />
            </div>
          ))}
        </div>
        <Note>
          Two of these are warnings rather than refusals (<code className="num">pnl_unreconciled</code>{' '}
          and <code className="num">statement_uncovered</code>) and they carry no alert mark, so the
          distinction is shape as well as ink. Read them as a set: every line has to say what is
          wrong and then what to do, and any line that leaves a trader with no action will send them
          back to retry the identical upload.
        </Note>
      </Section>

      <Section
        title="Intake · required-file checklist"
        note="Four required, and the optional fifth deliberately absent. A checklist that lists optional things reads as a wall of things you are failing to provide."
      >
        <Row label="none">
          <RackReqs met={[]} />
        </Row>
        <Row label="partial">
          <RackReqs met={['fills', 'position_history']} />
        </Row>
        <Row label="all">
          <RackReqs met={['fills', 'position_history', 'cash_history', 'orders']} />
        </Row>
      </Section>

      <Section
        title="Intake · staged file rows"
        note="What a dropped file looks like once its type is read from its header. The unrecognised row is the one worth looking at: it is named back to the trader rather than silently dropped."
      >
        <div className="flex max-w-md flex-col gap-2">
          <RackFileRow name="Fills.csv" type="Fills" />
          <RackFileRow name="Cash History.csv" type="Cash History" />
          <RackFileRow name={LONG_FILENAME} type="Position History" />
          <RackFileRow name="screenshot-2026-08-15.csv" type={null} />
        </div>
        <Note>
          The long name truncates from the right and keeps its type chip and its remove control,
          because those are the two things the row exists for. A file the detector does not
          recognise says so in <code className="num">neg</code> rather than being refused at the
          drop zone: the trader chose it, so it is named and left for them to remove.
        </Note>
      </Section>
    </>
  );
}

/* ── S4e INTAKE FIXTURES AND HARNESSES ───────────────────────────────────────────────────────
 *
 * NO FIXTURE HERE COULD BE MISTAKEN FOR REAL DATA, which is the rack's standing rule and matters
 * more in this section than anywhere else: these render money figures and day counts, and a
 * screenshot of a plausible one would read as a real trader's real loss. Every number below is
 * obviously synthetic (7s and 3s, round hundreds) and no account name is a real Tradovate name.
 */

const LONG_FILENAME =
  'Position History (9) copy final FINAL v3 exported 2026-08-15 from the reports tab.csv';

const PANEL_RUNNING: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  { id: 'position_history', label: 'Saving your trades', state: 'active' },
  { id: 'cash_history', label: 'Saving your fees', state: 'pending' },
  { id: 'orders', label: 'Saving your orders', state: 'pending' },
];

const PANEL_FAILED: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  {
    id: 'position_history',
    label: 'Saving your trades',
    state: 'failed',
    detail: 'Needs your Fills export too',
  },
  { id: 'cash_history', label: 'Saving your fees', state: 'pending' },
];

const PANEL_DONE: Step[] = [
  { id: 'read', label: 'Reading your files', state: 'done' },
  { id: 'fills', label: 'Saving your fills', state: 'done' },
  { id: 'position_history', label: 'Saving your trades', state: 'done' },
  { id: 'cash_history', label: 'Saving your fees', state: 'done' },
];

/* Every code, with a detail object shaped exactly like the real one — the copy reads numbers out of
 * these, so a fixture missing a field would render a sentence the real finding never produces. */
const RACK_FINDINGS: PreflightFinding[] = [
  { code: 'nothing_to_import', blocking: true, detail: { total: 0 } },
  { code: 'fills_empty', blocking: true, detail: { total: 77, otherRange: 'Mar 3 to Mar 7' } },
  {
    code: 'accounts_differ',
    blocking: true,
    detail: { fillAccounts: ['DEMOACCT0000001', 'DEMOACCT0000002'], total: 2 },
  },
  { code: 'rows_unnamed', blocking: true, detail: { blocked: 33, total: 777 } },
  {
    code: 'round_trips_unmatched',
    blocking: true,
    detail: { blocked: 7, total: 77, fillRange: 'Mar 3 to Mar 7', otherRange: 'Mar 3 to Mar 9' },
  },
  {
    code: 'fees_unmatched',
    blocking: true,
    detail: { total: 333, fillRange: 'Mar 3 to Mar 7', otherRange: 'Apr 1 to Apr 7' },
  },
  { code: 'fees_empty', blocking: true, detail: { total: 777, fillRange: 'Mar 3 to Mar 7' } },
  {
    code: 'fees_partial',
    blocking: true,
    detail: { blocked: 300, total: 777, fillRange: 'Mar 3 to Mar 5', otherRange: 'Mar 6 to Mar 7' },
  },
  { code: 'fees_implausible', blocking: true, detail: { perContractCents: 7_700, total: 333 } },
  {
    code: 'pnl_unreconciled',
    blocking: false,
    detail: { brokerCents: -70_000, ourCents: -69_700, diffCents: -300, comparedRoundTrips: 77 },
  },
  {
    code: 'statement_unreconciled',
    blocking: true,
    detail: {
      daysCompared: 7,
      absDiffCents: 60_000,
      days: [
        {
          accountName: null,
          sessionDate: '2026-03-03',
          brokerCents: -30_000,
          ourCents: 0,
          ourGrossCents: 0,
          ourFeeCents: 0,
          diffCents: -30_000,
          roundTrips: 0,
        },
        {
          accountName: null,
          sessionDate: '2026-03-04',
          brokerCents: 0,
          ourCents: 30_000,
          ourGrossCents: 30_000,
          ourFeeCents: 0,
          diffCents: -30_000,
          roundTrips: 7,
        },
      ],
    },
  },
  {
    code: 'statement_uncovered',
    blocking: false,
    detail: { uncoveredDays: ['2026-03-01', '2026-03-02'], uncoveredCents: -70_000, total: 7 },
  },
  { code: 'statement_unreadable', blocking: true, detail: { blocked: 3, total: 7 } },
];

/** The panel at a fixed width, so three of them stack without each setting its own. */
function RackPanel({ steps }: { steps: Step[] }) {
  return (
    <div className={cn(cardSurface, 'w-full max-w-md overflow-hidden')}>
      <ProgressPanel
        from={<Icon name="files" size={26} className="text-muted" />}
        to={<Wordmark className="text-[13px]" />}
        steps={steps}
      />
    </div>
  );
}

/* The checklist, rebuilt here rather than imported, and that is a deliberate exception to the
   rack's usual rule. `Req` is a private helper inside `file-upload-step.tsx` — exporting it purely
   so this page could render it would widen that module's surface for the benefit of a review page,
   which is the tail wagging the dog. Four rows of two icons is not a component worth sharing. */
function RackReqs({ met }: { met: string[] }) {
  const REQS = [
    ['fills', 'Fills'],
    ['position_history', 'Position History'],
    ['cash_history', 'Cash History'],
    ['orders', 'Orders'],
  ] as const;
  return (
    <div className="text-caption flex flex-wrap items-center gap-x-3 gap-y-1">
      {REQS.map(([key, label]) => {
        const has = met.includes(key);
        return (
          <span
            key={key}
            className="flex items-center gap-1"
            style={{ color: has ? 'var(--color-accent)' : 'var(--color-muted)' }}
          >
            <Icon name={has ? 'check' : 'unmet'} size={13} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** A staged file row. Same reasoning as `RackReqs`: it is markup, not a component. */
function RackFileRow({ name, type }: { name: string; type: string | null }) {
  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2">
      <Icon name="file" size={15} className="text-muted shrink-0" />
      <span className="text-body text-text min-w-0 flex-1 truncate">{name}</span>
      <span
        className="text-caption shrink-0"
        style={{ color: type ? 'var(--color-muted)' : 'var(--color-neg)' }}
      >
        {type ?? 'Not recognised'}
      </span>
      <span className="text-muted shrink-0">
        <Icon name="close" size={14} />
      </span>
    </div>
  );
}


/* THE CELL COMPUTES ITS OWN RATIO FROM WHAT IT ACTUALLY RENDERED.
 *
 * It used to print the literal string `Aa 0.00`, which is worse than printing nothing: the section
 * looked like a proof, was named a proof in the spec, and asserted a number it had never measured.
 * Every contrast failure in this palette was sitting in that table the whole time, unreadable.
 *
 * It reads the COMPUTED colours off the rendered node rather than a token map, so it measures what
 * the browser painted - including anything a mode, an alpha or a cascade did on the way. That is
 * the only version of this check that cannot drift from the thing it describes.
 */
function ContrastCell({
  ground,
  groundCls,
  inkCls,
}: {
  ground: string;
  groundCls: string;
  inkCls: string;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const cell = ref.current;
    const span = cell?.querySelector('span');
    if (!cell || !span) return;
    const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((n) => {
        const x = n / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(rgb(getComputedStyle(span).color));
    const b = lum(rgb(getComputedStyle(cell).backgroundColor));
    setRatio((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  }, [ground, groundCls, inkCls]);

  // 4.5 is the AA floor for small text, and this table sets at 12px, so 4.5 is the right line.
  const pass = ratio === null || ratio >= 4.5;
  return (
    <td ref={ref} className={cn(groundCls, 'p-2 whitespace-nowrap')}>
      <span className={inkCls}>Aa</span>{' '}
      <span className={cn('num text-micro', pass ? 'text-muted' : 'text-neg')}>
        {ratio === null ? '' : `${ratio.toFixed(2)}${pass ? '' : ' FAIL'}`}
      </span>
    </td>
  );
}

/* THE SAME SELF-MEASURING TRICK AS `ContrastCell`, ON THE BORDER INSTEAD OF THE INK.
 *
 * It reads `borderTopColor` off the rendered swatch and the painted background off the cell around
 * it, so an alpha (`accent/40`), a mode, or a token that never reached the browser all show up as
 * the number rather than as a comment claiming otherwise. `--color-rule` was inlined instead of
 * emitted once already; that failure is invisible to every check except this one.
 *
 * IT COMPOSITES ON A CANVAS RATHER THAN PARSING THE COLOUR STRING, and that is a correction rather
 * than a flourish. The first version did `str.match(/[\d.]+/g).slice(0,3)` for the channels and
 * `[3]` for alpha, which is fine for `rgb()` and `rgba()` and silently catastrophic for anything
 * else. Tailwind emits `border-accent/40` as a `color-mix`, and `getComputedStyle` hands that back
 * as `oklab(0.476125 -0.079402 0.0116068 / 0.4)` — so the parser read an oklab LIGHTNESS of 0.476
 * as a red channel of 0.476/255 and reported the accent as near-black. The table said the outline
 * button's edge measured 1.09:1 in dark; it measures 2.20. A proof that reports a wrong number is
 * worse than no proof, which this file already learned once when the contrast table printed a
 * placeholder — same lesson, second surface.
 * Painting ground-then-edge into a 1x1 canvas and reading the pixel back gets the true composite
 * for ANY colour syntax, alpha included, with no parsing at all. The browser does the conversion.
 *
 * `floor` of 0 means the line has no floor to fail — a divider, an object's edge and a hover state
 * are all outside SC 1.4.11, and marking them would train the eye to ignore the marks that matter.
 */
function EdgeCell({
  groundCls,
  edgeCls,
  floor,
}: {
  groundCls: string;
  edgeCls: string;
  floor: number;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const cell = ref.current;
    const swatch = cell?.querySelector('div');
    if (!cell || !swatch) return;
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    // Paint ground, then edge on top, then read the pixel. A translucent edge is painted OVER the
    // ground, so the honest number is the composite the eye gets, and letting the browser do the
    // conversion is what makes any colour syntax (rgb, oklab, color-mix) come out right.
    const paint = (over: string, under: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = over;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((n) => {
        const x = n / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const groundStr = getComputedStyle(cell).backgroundColor;
    const ground = paint(groundStr, groundStr);
    const edge = paint(getComputedStyle(swatch).borderTopColor, groundStr);
    const x = lum(edge);
    const y = lum(ground);
    setRatio((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05));
  }, [groundCls, edgeCls]);

  const fail = floor > 0 && ratio !== null && ratio < floor;
  return (
    <td ref={ref} className={cn(groundCls, 'p-2 whitespace-nowrap')}>
      <div className={cn(edgeCls, 'mb-1 h-5 w-10 rounded-[var(--radius-xs)] border')} />
      <span className={cn('num text-micro', fail ? 'text-neg' : 'text-muted')}>
        {ratio === null ? '' : `${ratio.toFixed(2)}${fail ? ' FAIL' : ''}`}
      </span>
    </td>
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
  const anchored = useContext(AnchorCtx);
  return (
    /* `scroll-mt` so a jumped-to heading clears the sticky header rather than hiding under it. */
    <section id={anchored ? slug(title) : undefined} className="border-border scroll-mt-6 border-t pt-8">
      <h2 className="text-h2">{title}</h2>
      {/* FULL-STRENGTH INK, NOT `muted` (2026-08-14). This is the argument a reviewer is here to
          read, and it was set in the ink reserved for a property of the object beside it. The tell
          was already in this line: `max-w-prose` names the job correctly and the colour contradicted
          it. Twenty-one of these plus nine `Note`s, all muted, made the rack the worst instance of
          the inversion in the codebase. Nothing competes with the 24px h2 above, because hierarchy
          here is carried by size — see the ink note in globals.css. */}
      {note ? <p className="text-small mt-1 max-w-prose">{note}</p> : null}
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

/* TWO CHANGES, AND THE SECOND IS THE ONE NOBODY WOULD HAVE CAUGHT (2026-08-14). Full-strength ink
   for the reason stated on `Section` above. And `text-small` rather than `text-caption`: caption is
   11px with `letter-spacing: 0.02em`, which is a LABEL step - tracked out slightly so a short string
   in caps or a column header reads as a tag. These are the longest passages in the rack, some of
   them several sentences, and they were set at 11px on a label's letter-spacing. Wrong tier and
   wrong size, from the same habit of treating explanation as chrome. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-small max-w-prose">{children}</p>;
}

/* `role="group"` + `aria-label` rather than a bare span beside some buttons. Three unlabelled
   toggle groups in one header is a reasonable thing for a review tool to get right, given the rack
   exists to check exactly this class of thing in everything else. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-caption text-muted" aria-hidden>
        {label}
      </span>
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
    /* `aria-pressed`, because the selected state is carried by a ground change and nothing else —
       a screen reader had no way to know which theme, width or density was active. Same spelling
       `Switch` already uses for the same reason. */
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'text-caption focus-visible:ring-accent rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:outline-none',
        on ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

/* THE RE-EXPORT THAT HID A MISSING SECTION. This file carried `export { ThemeToggle }` at the
   bottom and imported the component at the top, but never rendered it - and the re-export is what
   made the import count as used, so no lint rule ever fired. A primitive was absent from the rack
   and the one signal that would have said so had been silenced by a line nothing consumed (nothing
   imports from a page module; checked). Removed 2026-08-14, and the component is racked above. */
