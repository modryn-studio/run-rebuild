---
name: launch
description: >
  Distribution for example.com: the release gate, sharing surfaces, social links, and the day-by-day
  posting sequence. Enforces the gate first, so nothing ships to a public channel before the product
  can carry the visit. Trigger on "run launch", "launch checklist", "where do I post", "are we ready
  to announce", "ready to go public".
argument-hint: "[optional: 'gate' to only re-check readiness, 'day-1' to run the posting sequence]"
---

<!-- Sync: your-project-native. Adapted from the boilerplate's launch.prompt.md
     (modryn-boilerplate/.github/prompts/). This copy is a reusable template, not a record of one
     product's launch — fill in the bracketed specifics for the project at hand before running it. -->

# /launch — distribution for example.com

Run this **after** `/seo`. That one handles the technical surface; this one is about getting eyes on
the product, and about not spending them early.

## Step 0: the gate (check this first, every run, and stop here if it fails)

**Define the gate for this product before anything else runs.** The shape is always the same: a
stranger, not the founder, can reach the product unassisted, in production, with nobody on the call,
and come away having learned or gotten something true and specific — not a waitlist confirmation.
Write the concrete version for this product (who the stranger is, what they do, what they walk away
with) and record it here so every future run of this skill checks the same bar.

Until that passes, **every public channel below is held.** Not delayed out of caution: spending the
one shot at a first impression on an audience that isn't ready to convert teaches them the product is
vapor, and the internet's most skeptical audiences do not come back for a second look.

What's usually missing at this stage is not eyeballs, it's the **real thing the product needs to
prove itself** — real users' real data, a working integration, whatever "it actually works for you"
requires. A handful of real cases beats thousands of pageviews, because most products can't prove
their value proposition against fake data.

**Allowed while the gate is closed** (this is recruiting, not launching):
- One-to-one outreach to people you already know, asking them to be an early user
- Existing relationships, small-N conversations, partner and vendor meetings
- Direct links shared privately

**Held until the gate opens** (all of it, one gate, no partial release):
Reddit niche subs · r/SideProject · X · Ship or Die · Dev.to · Indie Hackers · Hacker News ·
Product Hunt — or whichever subset of these is the actual audience for this product.

State PASS or HELD explicitly at the top of every run of this skill, with the one thing still missing.

## Step 1: audit the sharing surface

Report PASS / MISSING with file paths.

- [ ] `src/config/site.ts` — decide deliberately whether a `social` block belongs here yet. If no
      public profiles exist, leave it out rather than stub placeholder handles. **Never source a
      social URL from memory, another agent's summary, or a prior run of this skill** — confirm every
      handle directly against the live profile or against the project owner before it reaches a commit.
- [ ] If a public footer or nav exists, its social links are sourced from `site.social.*`, never
      hardcoded. Don't add the row until there's something real to link — an empty social row on a
      pre-launch page reads as an empty storefront.
- [ ] Root OG card exists and renders (see `/seo` Step 2). Check it against a **light** chrome as well
      as a dark one.
- [ ] `NEXT_PUBLIC_SITE_URL` / `site.url` point at the real production domain, so shared links don't
      take a redirect hop through the apex or a preview URL.
- [ ] The public pages a shared link can reach are the ones actually intended to be public. Confirm
      everything else stays behind auth, `noindex`, or whatever gate this project uses to keep
      internal surfaces dark.

## Step 2: the posting sequence (only once the gate is PASS)

Fill in the bracketed items for this product before running the sequence — the shape below is a
skeleton, not a specific product's history.

### Day 0 — prep, before anything is public
1. **Launch/build-log post**, if this project keeps one. Merge before posting anywhere so links
   don't 404.
2. **Flip any public listing or status flag to live**, if one exists.
3. **Social copy**, written in whatever voice/brand doc this project uses.
4. **Queue, do not post.** Draft posts for each target channel ahead of time.

### Day 1 — launch, 30 to 60 minutes apart
1. **The niche community most likely to already have this exact problem.** Lead with the problem,
   not the product: "I kept hitting [X], so I built this." Link the product, not the studio.
2. **A build-in-public channel** (r/SideProject, Indie Hackers, Ship or Die). The build process is
   on-topic here; link the log post if one exists.
3. **X / social**, with the OG card or a short clip attached.

### Day 2 — follow-up
1. **Reply to every comment from Day 1.** Genuine replies, not "thanks for the feedback."
2. **Cross-post** (Dev.to or similar) with a canonical URL back to the log post, if applicable.

### Week 1 — compound
1. **Read analytics for signups or real conversions, not pageviews.** Which channel produced the
   thing that matters, not just a visit.
2. **Hacker News**, only with a genuine technical insight, never a product plug.
3. **One piece of writing that only this product's own data or process could produce.** This is
   usually a better long-term SEO/distribution play than programmatic content — see `/seo`.

## Step 3: validate before posting

- OG preview at opengraph.xyz against the live URL, on light and dark chrome
- Every footer and nav link resolves (no `href="#"` reaching production)
- The primary signup/conversion path works end to end from a logged-out browser, in production, not
  localhost
