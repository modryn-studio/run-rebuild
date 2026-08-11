---
name: seo
description: >
  Technical SEO + metadata audit and fix for example.com: the OG card, title/description, canonical,
  robots and indexability, structured data, and the Search Console / Bing walkthrough. Knows which
  surface is public (the door) and which is permanently noindex (the app). Trigger on "run seo",
  "seo audit", "get us on Google", "fix the OG card", "submit the sitemap".
argument-hint: "[optional: 'door' | 'app' | 'beta-flip' to scope the run]"
---

<!-- Sync: your-project-native. Adapted from the boilerplate's seo.prompt.md + seo.instructions.md
     (modryn-boilerplate/.github/). This copy is a reusable template, not a record of one product's
     audit — replace the bracketed specifics for the project at hand before running it. -->

# /seo — technical SEO for example.com

**Governing principle (Rams):** never assert to a machine something the page does not show a person.
Every rule below follows from it. Markup that claims structure the page lacks, alt text on a
decorative image, review schema with no visible reviews, an OG card for a page nobody can reach:
same failure, different size.

## Two surfaces, and they get opposite treatment (if this project has both)

Many builds on this boilerplate have a small public marketing surface (a door) sitting in front of an
authenticated app. If this one does, decide which you're touching before auditing — they get opposite
metadata treatment:

| | **The door** (public) | **The app** (authenticated) |
|---|---|---|
| Routes | landing, about, privacy, terms — whatever is meant to be reachable logged out | everything behind auth: dashboard, admin, onboarding, all `/api/*` |
| Indexable | Per the decision in Step 0 | **Never.** Permanently `noindex` |
| Metadata | Full: title, description, OG, canonical | Short functional title only, `robots: {index:false, follow:false}`, **no `openGraph`** |
| OG card | Root card only | None. A preview card for an authenticated route is an information leak, not a win |

If this project has no separate public surface yet — this boilerplate ships with everything under one
`robots: {index:false, follow:false}` in the root layout by default — skip the table and go straight
to Step 0.

## Step 0: the indexability decision (do this before generating anything)

**Record the decision here, with who made it and why**, so a future run of this skill doesn't
silently reverse it. The default this boilerplate ships with is `robots: { index: false, follow:
false }` in `src/app/layout.tsx` — everything dark until there's a deliberate reason to flip it
(see `CLAUDE.md`: "remove it when the project genuinely goes public — not before").

If flipping it on for the door routes: confirm what's actually gating the app surface. A `robots`
meta tag only controls whether Google *indexes* a page — it does nothing to stop a crawler from
*reaching* one. If this project uses a rewrite/proxy layer to keep the app dark regardless of the
route requested, verify it's still doing that job (`curl` a few authenticated routes and confirm they
don't return real app markup) before treating indexing as safe to turn on.

**Still true regardless of the decision:**
- `sitemap.ts`, if present, lists only the public/door routes. Don't add app routes to it even though
  indexing is on. (Check whether `sitemap.ts` actually exists — `robots.ts` in this boilerplate
  already points at `/sitemap.xml`; if there's no file generating it, that's a dead link to fix
  before anything else here.)
- The app surface stays **permanently** `noindex`. If it becomes reachable at a shared route with the
  door, `robots.ts` needs explicit `disallow` entries for it, or the sitewide flip has nothing left
  catching what the sitemap doesn't cover.
- `llms.txt`, `manifest.ts`: fine to defer regardless of the indexing decision, see "Notes" below.

## Step 1: audit

Report PASS / MISSING with a file path for each. Do not fix while auditing; list first.

**Door / public metadata**
- [ ] `metadataBase` set to `site.url` in root layout
- [ ] Root `title` is a written line, with `title.template` set so every page title stops
      hand-assembling
- [ ] `description` is a real 110-160 char meta description
- [ ] `openGraph` block: `title`, `description`, `url`, `siteName`, `type`. Let a generated
      `opengraph-image.tsx` supply `images` rather than hand-setting it
- [ ] `twitter` block: `card: 'summary_large_image'`, plus a site handle if one exists
- [ ] `alternates.canonical` set, per page — and confirm `site.url` matches whichever host the deploy
      actually serves (apex vs `www`), so links don't take a needless redirect hop
- [ ] An OG image route or static asset exists and renders — verify live, not just in code (see
      Step 2 for the font-loading gotchas a dynamic `ImageResponse` route can hit)
- [ ] `<html lang="...">` set
- [ ] Favicons present, including a dark-mode variant if the brand mark needs one
- [ ] `package.json description` filled in

**App / authenticated surface (if one exists)**
- [ ] Every authenticated route exports `robots: {index:false, follow:false}` and no `openGraph`
- [ ] No authenticated route (admin, settings, internal previews) emits an OG card

**Separate decisions, not blocked by indexing**
- [ ] `src/app/sitemap.ts` — confirm it exists if `robots.ts` advertises one; a robots file pointing
      at a sitemap that doesn't exist is a real 404 a crawler will hit
- [ ] `src/app/manifest.ts` — defer unless there's a product reason to need it now (e.g. an install
      prompt matters to the core flow)
- [ ] `public/llms.txt` — optional, low priority (see Notes)
- [ ] Structured data — see Step 5

## Step 2: the OG card (usually the highest-value item on this list)

While a page is `noindex`, the card does **zero** search work. Its whole job is the preview when the
URL is pasted into a DM, a Discord, or an email — often the product's actual first 60 seconds in
front of a stranger. Build it before anything else here.

**Spec (Rams).** One card. No dark variant (there's no `prefers-color-scheme` negotiation for OG
images, so a dark variant could never be served — pick whichever mode is the higher-contrast object
in a social feed, usually light).

- Canvas 1200x630. Flat background, pulled from the project's actual `--color-bg` / `--color-surface`
  token in `globals.css` — not a guess. 80px margins, safe box centered (platforms crop this ratio
  inconsistently).
- **Everything on one left axis.** Left-aligned with empty space on the right reads as a document;
  centered reads as a poster. Don't fill the empty field.
- **One sentence**, in the project's display type role, using the real tagline from `site.ts` — not
  placeholder copy. Ragged right, max 2 lines, short enough to set large.
- **Wordmark**, bottom-left on the same axis, using the project's actual wordmark component/mark.
- **One hairline border** on the outer edge, in the project's real border token — without it the card
  has no boundary on light chrome (iMessage, Slack light, Notion) and bleeds into the container.
- **`alt` is real content alt**, read aloud on X and Mastodon — the card's own line, never "OG image".

**Not on the card, each with the job it would fail:** a product screenshot (small UI is grey mush at
card size) · a logomark beside the wordmark, if the brand doc rules that combination out elsewhere ·
the domain (the platform prints it in its own chrome) · a CTA or button shape (nothing on a static
image is clickable; a drawn button is dishonest) · a "beta" or status badge, if the design system bans
badge clutter · gradient, glow, or texture, if the design system bans them · a second supporting line
· the interactive accent color (its job is interactive moments; nothing on a static image is
interactive).

**Satori caveats, if the OG image is a dynamic `ImageResponse` route:** fonts must be static buffers,
so `next/font` won't work inside it. A variable font's optical-size axis is not resolved by Satori, so
either ship a static display cut or accept sturdier hairlines than the app uses. There's no
`text-balance`, so break the line by hand. CSS variables aren't read inside the route, so export one
shared hex constant rather than typing colors twice.

**Two classes of bug worth checking live, not assuming away, if building this from scratch:**

1. **Font fetch format.** Getting a Satori-parseable font out of Google Fonts' CSS2 endpoint typically
   needs an old-Chrome `User-Agent` override so the endpoint stops serving WOFF2 (which Satori can't
   parse). What it serves instead isn't guaranteed to be TTF — verify the actual response and widen
   the parsing regex to accept whatever font format the endpoint actually returns, rather than
   hardcoding one.
2. **Generated routes with no file extension, behind a path-based allowlist/rewrite.** A route like
   `/opengraph-image` is served at a path with no dot in it and a cache-busting hash in the *query
   string*, not the path. If this project runs any middleware or proxy that allowlists by exact
   pathname or skips paths containing a dot, that class of route can get silently rewritten instead of
   served. Verify with `curl -sD - -o /dev/null <url>` — confirm `content-type: image/png` and no
   rewrite header — rather than eyeballing the code.

## Step 3: copy rules for metadata (Ogilvy)

Metadata strings are on-screen copy: they appear in the tab strip, in bookmarks, and are announced as
the page's accessible name. Full brand voice applies (see `CLAUDE.md`: no em dashes, and whatever
other voice rules this project's brand doc sets).

- **The short answer, not the keyword.** The first ~60 words should answer the question the page is
  titled for, in one complete sentence a stranger could quote with no surrounding context. If a
  target phrase doesn't fall naturally into that sentence, the page is aimed at the wrong phrase.
- **Character counts are a ceiling, never a minimum.** The first ~40 characters carry the claim;
  everything after gets cut on mobile. A shorter title that earns the click beats a longer one that
  merely fits.
- **The description sells; it doesn't summarize.** Carry a concrete detail, not an echo of the title
  — two sentences of selling, and an echoed title throws one away.
- **Title and OG title are different jobs.** Default them to the same value, but a search title is
  read by someone who already has intent (it should *answer*); a social title is read while scrolling
  with none (it should *create the question*). The homepage is usually where they should differ.
- **Promise-match.** Title and description are a promise; the page's first screen has to keep it in
  the same words.
- **Never the product name alone.** A bare name gives a stranger no reason to click.
- **Watch for fear-first titles that win the click and lose the segment.** They can out-convert
  everything else in a test while recruiting the wrong audience for retention — check what the brand
  doc says the target segment actually is before shipping one.

If `site.ts` only has one `description` field doing double duty as both the on-page tagline and the
SEO meta description, and those two jobs start pulling in different directions (short display copy
vs. a real 110-160 char meta description), split it into two fields rather than compromising both.

## Step 4: markup and accessibility

These are accessibility rules, not SEO rules — merging the two categories is a common source of bugs
(an alt-text rule that instructs a WCAG failure is the classic one). They live here for now.

- **Alt matches the image's job.** Content images describe what the image *conveys in context*.
  **Decorative images take `alt=""`** (required, never omitted): a described decorative image fails
  WCAG 1.1.1, and an *omitted* `alt` makes assistive tech fall back to the filename. Inline SVG icons
  take `aria-hidden`; the accessible name lives on the control. `aria-hidden` never sits on anything
  focusable without also removing it from tab order.
- **Landmarks, then plain elements.** One `<main>`. `<nav>`/`<header>`/`<footer>` for page-level
  groups, distinguished by accessible name when repeated. `<section>` **only** when given an
  accessible name (otherwise it's a `<div>` with extra characters). `<article>` only for content that
  would stand alone if syndicated. Prefer heading + `<div>` over an unnamed `<section>`.
- **Everything interactive is a `<button>` or an `<a>`,** never a `<div>` with `onClick`.
- **Heading level comes from the document outline; size comes from the type scale.** Never pick `h3`
  for its size. The app shell should carry zero headings of its own — the `<h1>` belongs to the view
  inside `<main>`. The wordmark is not an `h1`. Dialogs start their own outline: title is an `<h2>`
  referenced by `aria-labelledby`, outside the page sequence.
- **Content is in the server-rendered HTML** (headings, body copy, links, the primary CTA label).
  Verify with `curl` against the built page, not devtools. No layout shift on hydration — the one
  script allowed to block is a pre-hydration theme script, without which the page flashes the wrong
  mode (this boilerplate's `ThemeProvider` does this by design).
- **Links.** Link text identifies its destination alone (ten links reading "View" are ten identical
  links in a screen reader's list). Navigation is a `<Link>`, an action is a `<button>`. Icon-only
  controls carry `aria-label`. Inline links in body copy need a non-color affordance (underline) if
  the accent-on-background contrast is a hue difference rather than a luminance one (WCAG 1.4.1). New
  tabs are announced, not just `target="_blank"`. Focus is visible everywhere via the global
  `:focus-visible` outline only, never a stacked component ring.

## Step 5: structured data

On the **specific public page it describes**, not the root layout, and only once that page is
actually indexable and the schema type matches what's on the page. A product-page schema block in the
root layout lands on every authenticated route too (e.g. `/admin`, `/login`) and asserts product-page
structure behind a login.

**Never add `aggregateRating` or review markup unless real, visible ratings exist on that page.**
Fabricated review markup is a manual-action risk and is the governing principle violated at scale.

## Step 6: external setup (needs a live URL)

**Google Search Console.** search.google.com/search-console. If the site is a standalone domain, add
a Domain property (DNS TXT verification at the registrar or DNS host); otherwise a URL-prefix property
works. Do this even while `noindex` is on — it starts the clock and costs nothing. Submit the sitemap
only once indexing is actually turned on.

**Bing Webmaster Tools.** bing.com/webmasters — "Import from Google Search Console" pulls the site and
verification automatically, and also covers Yahoo and DuckDuckGo. Do it after GSC.

**Validation:** OG preview at opengraph.xyz · rich results at search.google.com/test/rich-results ·
DNS at whatsmydns.net. Check the OG card against a **light** chrome (Slack light or iMessage) as well
as a dark one.

## Notes

- **`llms.txt`** is optional and low-priority, not a ranking mechanism. Measured reality as of 2026:
  the large majority of published `llms.txt` files receive close to zero AI-crawler requests, and
  major search engines have stated it isn't required. Worth ten minutes at some point; never a
  priority.
- **Programmatic "best X for Y" pages** are worth thinking twice about in any saturated,
  affiliate-heavy search vertical — check what the actual competitive landscape looks like for this
  product's keywords before investing in pSEO. One well-written piece drawing on data only this
  product has is often the better play.
- **FAQPage schema on how-it-works pages** is a smell if the product needs one to be understood — if
  it does, the product isn't ready, not the schema. Trust questions (what data is collected, what
  happens on account deletion) are a legitimate and permanent use of FAQ schema.

Report at the end as: fixed, deferred (with the reason), and needs a decision. Commit only when asked.
