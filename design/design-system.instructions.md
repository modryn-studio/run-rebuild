---
applyTo: '**/*.tsx'
---

# Design System

## Low Cognitive Load — Enforce in Every Component

Every element that requires mental processing is a tax on the user. Keep it zero.

**Reference standard:** Screen = one action, nothing else visible. Before building any screen or component, ask: what is the ONE action here, and what can be hidden until needed?

**Before writing JSX, stop and answer:**

1. What is the single action on this screen? (4 words max — if you can't, the screen has too much)
2. What elements can be gated behind state instead of shown upfront?
3. Is there any copy I'm about to write that the UI itself should communicate?

**Hard rules for TSX:**

- One primary action per screen. If a component introduces a second, push back.
- No `<p>` or `<span>` copy that explains how the UI works — the UI explains itself.
- No tooltips. Redesign the element if you think you need one.
- Labels identify, they don't instruct. `"Market"` not `"Choose the market you want to target."`
- Don't render an element until it's needed. Gate on state, not on the user reading instructions.
- Empty states: one minimal hint toward the next action. Not a paragraph.
- Error messages: one sentence. What to do, not the technical failure description.
- Secondary paths are links, not content. If something is optional, it's a small link — not a section on the page.

## Shared UI Primitives

All interactive elements use primitives from `src/components/ui/`. Never write raw `<button>`, `<input>`, or `<textarea>` — import and use the shared components.

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
```

**Button variants:** `primary` (default, filled accent) | `secondary` (outlined, accent on hover) | `ghost` (text-only)
**Button sizes:** `sm` | `md` (default) | `lg`

All buttons default to `type="button"`. Pass `type="submit"` explicitly for form submissions.

**Shape is always the caller's job — never set `rounded-*` inside a primitive.**
The primitives own structure and token contracts. Shape is a brand decision that belongs in the component using the primitive, not inside it. The rule: if every caller is overriding the same base class, the base class is wrong.

```tsx
// ✅ correct — shape set at the call site, primitive stays neutral
<Button className="rounded-none px-6">Submit</Button>
<Input className="rounded-lg" />

// ❌ wrong — never add rounded-* to button.tsx / input.tsx / textarea.tsx base classes
```

Exception: intentionally non-standard shapes (circular icon buttons, custom media controls) — these stay as raw `<button>` elements and should be noted in a comment.

## Brand Tokens

Use named utilities generated from `@theme` in `globals.css`. Never use `[var(--color-*)]` arbitrary syntax.

```tsx
// ✅ correct
<div className="bg-accent text-white border-border bg-surface text-muted" />

// ❌ wrong — verbose, not idiomatic TW v4
<div className="bg-[var(--color-accent)] border-[var(--color-border)]" />
```

Core tokens: `bg-accent`, `bg-bg`, `bg-surface`, `border-border`, `text-text`, `text-muted`, `text-accent`, `bg-secondary`

## Responsive Patterns

Page-level horizontal padding: `px-4 sm:px-6` — never `px-6` alone (mobile gets no breathing room).
Vertical section spacing: `py-12 sm:py-16` or `py-16 sm:py-20`.
Body text: `text-[15px] sm:text-base` or `text-sm sm:text-base` on dense copy blocks.

## Mobile Keyboard Safety

The layout uses `interactiveWidget: 'resizes-content'` in the `viewport` export (`src/app/layout.tsx`). This tells the browser to shrink the layout viewport when the on-screen keyboard opens, so `h-dvh` containers automatically exclude keyboard height. **Do not add `keyboardOffset` / `visualViewport` padding hacks to individual components** — the viewport contract handles it at the root level.

For mobile nav chrome (tab bars, bottom bars) that should disappear when the keyboard opens, track keyboard state in the page and pass it down:

```tsx
// In the page component — mobile only (guard with innerWidth check):
const [keyboardOpen, setKeyboardOpen] = useState(false);
useEffect(() => {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  if (window.innerWidth >= 768) return; // desktop/tablet: tab bar is already hidden
  const vp = window.visualViewport;
  const update = () => {
    const offset = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
    setKeyboardOpen(offset > 120);
  };
  update();
  vp.addEventListener('resize', update);
  vp.addEventListener('scroll', update);
  return () => {
    vp.removeEventListener('resize', update);
    vp.removeEventListener('scroll', update);
  };
}, []);

// In the tab bar / bottom chrome — use max-h to animate cleanly:
<div
  className={cn(
    'bg-sidebar shrink-0 overflow-hidden transition-[max-height] duration-150 md:hidden',
    keyboardOpen ? 'max-h-0' : 'max-h-32'
  )}
/>;
```

**Enter key on mobile:** Never wire Enter to send in a textarea when the feature is used on mobile. Use `isTouchDevice` state (set in `useEffect` after mount) to gate the send path — touch devices use the send button only.

```tsx
const [isTouchDevice, setIsTouchDevice] = useState(false);
useEffect(() => {
  setIsTouchDevice('ontouchstart' in window);
}, []);

const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
    e.preventDefault();
    handleSend();
  }
};

// Also set enterKeyHint to signal the correct key label to the soft keyboard:
<textarea enterKeyHint={isTouchDevice ? 'enter' : 'send'} />;
```

## Touch Targets

All tappable elements must be at least 44×44px. Primary action buttons: `h-12`. Secondary buttons: `min-h-11`. Never use `py-1` or `h-8` on mobile-visible buttons.

## Class Merging

Use `cn()` from `@/lib/cn` when combining base classes with conditional or override classes:

```tsx
import { cn } from '@/lib/cn';
<div className={cn('base-classes', condition && 'conditional-class', className)} />;
```
