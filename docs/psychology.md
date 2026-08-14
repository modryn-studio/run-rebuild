# Psychology — Run

> Why the product changes behaviour, what it must never do, and what is still unproven.
> Researched 2026-08-14 across four parallel briefs: trader-psychology evidence, analogous
> behaviour-change products, competitor teardown, and derivatives-counsel review.
>
> **This document does not change `spec.md`.** Where the research recommends amending a locked
> file, it is recorded here under [Recommended changes](#recommended-changes-to-locked-docs) as a
> proposal for Luke, not as a decision.

Luke's prompt was "kind of like how Duolingo makes their product into a game so people keep coming
back." The answer the research returned is that **Run cannot use Duolingo's model, and the reasons
are three independent ones that happen to agree.** That agreement is the most important finding in
this document, because it means the position is not a taste preference and does not depend on any
single body of evidence being right.

---

## 1. Three disciplines, one answer

| Discipline | Finding | Why it rules out engagement mechanics |
|---|---|---|
| **Economics** | Duolingo monetises through subscriptions and ads. Engagement *is* the revenue, and more engagement is also more learning. | Run has no such alignment. The user's success is fewer, better trades; Run's insight succeeding means the named behaviour **stops**. Von Ahn can say "always go with engagement" and be right about his business. Run's equivalent sentence is "always go with more trading," which is the product's kill signal. |
| **Psychology** | Kluger & DeNisi (1996), 607 effect sizes: feedback improves performance on average (d=.41) but **makes it worse in over a third of cases**, and effectiveness falls as attention moves from the *task* toward the *self*. | Every scored, streaked or graded mechanic is a self cue by construction. |
| **Law** | *CFTC v. Vartuli*, 228 F.3d 94 (2d Cir. 2000): speech protection was stripped because the product's output was used "in an entirely mechanical way, as though it were an audible command to a machine." The court judged the product **as sold** — the marketing was the exhibit. | **A habit loop is by definition a mechanism for producing response without deliberation.** The more effective the mechanic is at bypassing deliberation, the weaker Run's speech position becomes. |

The third row is the one nobody expected. Gamification is not merely wrong for Run
psychologically; **it is legally corrosive**, and the corrosion runs through the marketing copy as
much as the UI.

**The corollary is the useful half:** the design that surfaces the trader's own words, keeps the
decision with the human, and refuses to be obeyed is *also* the design that satisfies *Vartuli*.
The behavioural fence and the legal fence point the same way. Where they ever diverge, the legal
one binds.

---

## 2. The if-then, and why two briefs collided into one answer

This is the single most actionable finding, and it arrived as a conflict.

**Psychology said:** naming a pattern buys a small downstream behaviour change (Webb & Sheeran
2006: d=0.66 on intention produces only d=0.36 on behaviour). An **implementation intention** —
"if situation Y, then I will do X" — buys **d=0.65** (Gollwitzer & Sheeran 2006, 94 tests, >8,000
participants), the largest well-replicated effect in the entire brief. Run ships the diagnosis
without it.

**Counsel said:** if Run states the if-then, Run is the advisor.

**The resolution is better than either alone.** The implementation-intention effect comes from *the
subject forming the conditional*, not from being handed one. So:

> **Run supplies two real numbers. The trader draws the line.**
> If Run draws it, Run is the advisor. If the trader draws it, Run is a mirror.

Best psychology and best law, same design. If the conditional is to be written down, the trader
writes it into their own record and Run reflects it back later.

### The sentence, ruled clear

> On the 4 sessions where your size after three losses stayed flat, you finished green 3 times.
> On the 12 where it went up, 9 lost.

Counsel's verdict: **clear, and safer than the formulation currently in `problem-brief.md`.** It
has no object in the futures market, every clause is a completed fact, and there is no imperative.

**On four conditions:** past tense throughout; two *real* populations, never a counterfactual;
post-session delivery only; and the if-then left to the trader.

---

## 3. The fence is retrospective, not descriptive

Run's standing doctrine is *"conditional and descriptive, never prescriptive."* Counsel's finding
is that this is a **proxy that mostly tracks the right answer and will eventually mislead** — the
team will one day approve something descriptive in grammar and prospective in function.

> **The operative axis is retrospective versus prospective.**

Six ways a descriptive clause acquires a prospective object, in order of how likely Run is to do it
by accident:

1. **The present-tense bridge.** *"…9 lost. You're at three losses now."* The second clause converts
   the first into a prediction about the current session. **The most likely accidental crossing in
   the product**, and any live-narration or red-zone feature produces it by default.
2. **Aggregation into a general claim.** *"Traders who size up after three losses lose 75% of the
   time."* The object becomes the market rather than this user's record.
3. **The counterfactual dollar.** *"Had you stayed flat, you'd be up $4,200."* Asserts a result never
   achieved — the structure of hypothetical performance. It is also arithmetically false, since
   different size changes fills, margin, and whether the trade is taken at all. **Run's own reconcile
   doctrine independently forbids it, which is a good sign both rules are right.**
4. **Implied recommendation by selection.** *"Your best sessions all had one thing in common…"*
5. **Optimization framing.** *"Here's the version of you that works."*
6. **Trigger-shaped delivery.** The *same sentence* pushed at 8:25am. Words unchanged, legal object
   entirely changed. **Timing is a legal control, not a UX preference.**

Note: *"consider sizing down"* is **not** safer than *"size down."* A hedged imperative is still an
imperative, and the hedge reads as an attempt to disguise it.

### The shelter Run does not have

Every impersonality-based exemption in the CEA is closed to Run, because they all require advice
*not* tailored to particular clients, and Run's output is tailored by construction. 17 CFR
4.14(a)(9), the §1a(12)(B) publisher exclusion, the 15-client de minimis — all unavailable.

> **Run is not protected by an exemption. Run is protected by not being advice at all.**

This inverts the usual intuition: "buy NQ at 21,450" blasted identically to 5,000 subscribers sits
*inside* 4.14(a)(9). Run's gentlest personalised observation does not. **Prescriptive-but-impersonal
is sheltered; descriptive-but-personal is not.**

Stronger than an exemption in one way — an exemption is lost by a single feature, a definitional
argument fails only if the subject matter changes. Weaker in another: no filing, no bright line, no
comfort letter. **Every feature decision re-tests the same question and there is no fallback.**

---

## 4. What the field actually ships, and why it is an opening

Every headline mechanic in this market is a self cue:

| Product | Mechanic | Points at |
|---|---|---|
| TradeZella | **Zella Score** — six metrics, published weights | SELF |
| TradeZella | **Today's Score** + rule-adherence heat map | SELF |
| TradeZella | **Sentiment Agent** — infers frustration/FOMO from journal entries *and click patterns* | SELF, and unprompted |
| Edgewonk | **Tiltmeter** — goes red when you break your own rules | SELF |

Nobody arrived there by reading the literature. They arrived there because one number is easy to
render on a dashboard. **They cannot fix it without deleting their main screen.**

### The Zella Score is self-refuting, and the proof is arithmetic

TradeZella publishes the weights: Profit Factor 25%, Avg Win/Loss 20%, **Max Drawdown 20%**, **Trade
Win % 15%**, Recovery Factor 10%, Consistency 10%.

- **Win % and Max Drawdown are 35% of the score, and both improve in the short run by cutting
  winners early and letting losers run back** — the most destructive habit in discretionary trading.
  Profit Factor and Avg Win/Loss push the other way but are lagging and noisy over a week, while win
  rate responds immediately. A trader optimising against weekly feedback finds the fast lever first.
- **Max Drawdown is minimised by not trading.** A trader who stops entirely holds a good score. The
  composite cannot distinguish discipline from inactivity.
- **All six inputs are P&L-derived outcome statistics.** Not one process or rule-adherence input, in
  a score marketed on the language of discipline.

So `spec.md`'s claim is supported, but the real mechanism is sharper than *"a score invites gaming
the score"*:

> **A composite built from outcomes cannot be a discipline measure. A trader who follows their plan
> perfectly through a losing month watches their score fall — which teaches the wrong lesson at the
> moment they are most fragile.**

TradeZella's own generated takeaway on Luke's 187 trades reads *"…rather than increasing trade
frequency to raise your Zella Score."* **The score's existence forced the product to name trade
frequency as a lever, in writing, to a futures trader.** That is not a copy failure. It is the
score's architecture producing the sentence it had to produce.

---

## 5. Accuracy is the retention argument

**Attig & Franke (2019)**, 159 abandoned activity-tracker users, ranked reasons for quitting:

| Reason | % |
|---|---|
| Loss of intrinsic tracking motivation | 52 |
| Tracking routine disruption | 43 |
| Change in priorities | 42 |
| **Perceived measurement inaccuracy** | **36** |

Inaccuracy correlated **−.44** with perceived usefulness and was specifically tied to *permanent*
rather than temporary abandonment.

> *"Never show a number you cannot reconcile"* has been argued internally as correctness. **It is
> also the anti-churn argument, and that is the stronger commercial framing.** A trader who catches
> one wrong number does not complain. They leave and do not come back.

And **zero logging burden attacks the top two causes directly** — a broker-sourced record has no
routine to disrupt. Edgewonk's per-trade emotion tagging *is* a routine, and therefore a fragility.

---

## 6. What to steal

1. **Tiimo's re-entry rule — architectural, cheap now, expensive later.**
   > "The tool always reopens exactly where you left it, without judgment about gaps between
   > interactions, whether that's hours or weeks."

   **No state in Run may represent absence.** No "you haven't imported in 9 days," no backlog, no
   catch-up. This is the direct mitigation for the ostrich effect (§7) and it must be decided before
   several surfaces acquire an idea of "current."

2. **Tiimo's sentence shape: a disproven self-judgment replaced by a causal fact.**
   *"I thought I was just lazy on Mondays. But tracking showed I wasn't sleeping well on Sunday
   nights."* That is a deliberate SELF→TASK relocation, and it is nearly Run's daily read already.

3. **Monarch's four properties, as an explicit constraint on the LLM's sentence.** Every clause about
   a *transaction*, never the person; specificity substituting for judgment; comparison only to the
   user's own prior period; ending on a **position**, not a grade. This pairs with the existing rule
   that the LLM never computes a number — it should also never render a verdict.

4. **Treat a burst as a signal, not a win.** Duolingo's own data: *"learners who binge on Duolingo
   lessons were much more likely to abandon the app."* Even inside a more-is-better business, a surge
   is a warning. For Run a spike in trade count or size is a risk signal, and Run should be one of
   the few products that names a surge in its own subject matter rather than celebrating it.

5. **Delete the volume dimension from any metric.** Duolingo made the streak XP-based, users farmed
   easy lessons, and the fix was removing quantity entirely — one lesson a day. Goodhart observed and
   corrected inside a product. **Any Run number with a volume component will be met with volume.**

---

## 7. What Run must never build

- **Anything loss-aversion-shaped.** Yu-kai Chou, a *pro*-gamification authority: *"Broken streaks
  don't create restart moments. They create quit moments."* Fatal here specifically, because Run's
  user is already in a loss-aversion spiral in the domain the product observes. Manufacturing a
  second one — about the journal — while the first is live about the money compounds the disease.
- **Any comparison to other traders.** The one clean *null* result in the research: Auer & Griffiths
  found that normative feedback comparing a gambler's time and money to other players **did not
  change behaviour**, while the same-data self-appraisal version did. Comparison to others is a SELF
  cue. Prop-firm culture will keep asking for this.
- **Anything that rewards opening the app.** Trophies for sessions are trophies for screen time next
  to an open position.
- **A streak that counts trading days.** Counsel's framing: engagement mechanics may reward *review*,
  never *trading*. A streak counting trading days is a prospective inducement wearing a game's
  clothes, and it is the mechanic that would take Run across the line in §3.

---

## 7b. Reconciling with the prior recon — one live conflict

`docs/docs from run-trading/analogous-products.md` already covered this feature-world for the old
build, and it was not read before this research was commissioned. That was a process error; the
overlap is recorded here rather than left for someone to trip over.

**Where it agrees and adds:** it already names Whoop and Oura as *"the GOLD standard for the feel"*
— calm, premium, habituating, present-tense — which partly closes a gap flagged below. It also names
chess insights (Chess.com Insights, Aimchess) as *"nearly 1:1"* with the cross-session
repeating-weakness surface, which is a better-developed analogue than anything the new research
found. Both stand.

**Where it conflicts, and it is a real conflict.** The prior doc recommends mining poker
LeakTracker's pattern of flagging your leaks **"vs winning players"**, calling *"you vs. a winning
baseline"* a proven, paid convention. The new research says the opposite twice over: Auer &
Griffiths found normative comparison against other players produced a **null result** where the
same-data self-appraisal version worked, and Kluger & DeNisi classify social comparison as a self
cue — the harmful side of the axis.

**The resolution is the distinction the rest of this document already runs on**, and it dissolves
most of the conflict:

| Shape | Points at | Verdict |
|---|---|---|
| *"Winning players defend the big blind 40% of the time. You defend 22%."* | TASK — a named behaviour with a number to move | A baseline used as a **diagnostic**. Defensible. |
| *"You are in the bottom quartile of traders."* | SELF — a standing | A baseline used as **social pressure**. Never. |

Auer & Griffiths' null was measured on the second shape — time and money spent versus other players,
a standing rather than an action. So the prior doc's instinct survives if and only if a baseline
names a behaviour rather than ranking a person.

**Mostly moot for v1 regardless:** Run's corpus is cross-*firm* for one trader, not cross-trader. It
has no other-trader baseline to show and does not propose building one. The conflict is live for
whenever that changes, and the rule above is the answer when it does.

---

## 8. The measurement Run is not yet taking

`History` as specified — *"Run told you about this pattern last month. Did it get better?"* — cannot
actually prove the read works. It is confounded by regression to the mean and by survivorship:
traders who blow up stop uploading, so surviving accounts improve mechanically.

**The fix is nearly free.** Run's engine will surface several candidate patterns per trader and name
one. **Track the unnamed candidates too, and do not show them.** Same trader, same period, same
market conditions — a within-subject control. If named patterns improve and matched unnamed ones do
not, that is causal evidence the read works. If they improve identically, Run learns early that the
read is decoration. Costs a table and a nightly job, and it would make Run the only journal in the
category with a real measurement.

---

## 9. Open questions

Deliberately **not** added to `blueprint-instrumentation.md`, whose Part 1 carries the rule *"do not
add questions after phase 5 — late questions are conclusions looking for support."* These are live
uncertainties, recorded here.

| # | Question | Why it matters |
|---|---|---|
| P1 | **Does a specific situational cue change behaviour where cumulative P&L does not?** | The load-bearing assumption. Day traders continue after a **ten-year** negative record (Barber et al.); Chague et al. find no learning in Brazilian futures day traders. This population has already ignored the loudest quantified feedback there is. Run's escape — that global/self/outcome feedback is a different class from specific/situational/task feedback — is theoretically supported and **empirically untested in traders**. |
| P2 | **Do traders quit the journal after losses, or after they become profitable?** | Unresolved contradiction. The ostrich effect says losses (Sicherman et al., 1.1M investors, 852M records: logins fall **9.5%** the day after a decline). Steenbarger — the field's most credible voice — says traders abandon once profitable. **Both are credible and they imply opposite designs.** Run currently assumes ostrich. |
| P3 | **Does the daily cadence produce reflection or brooding?** | Repeating an unfixed pattern with a *rising cumulative cost* is the textbook brooding profile: passive, abstract, consequence-focused. Proposed mitigation: **the cost figure leads on the first Finding and never again**; after that the headline is what yesterday did. Concrete beats cumulative. |
| P4 | **Does Tiimo's own Streaks feature reset on a missed day?** | Their design writing rejects streaks; their product ships one. Their page deliberately does not say what happens on a miss, leaning accumulation-only ("your effort is always counted") with no mention of revocation — inference, not confirmation. If it never resets, "a streak with no loss state" may be a legitimate mechanic. If it resets, their own critique applies to them. iOS only; needs an install. |
| P5 | **Consumer protection — FTC Act §5, state UDAP, auto-renewal, substantiation.** | Counsel's own flagged gap, and **the regime most likely to actually reach Run**, since it does not depend on registration status. Marked **unpriced, not low-risk.** Close before any engagement mechanic ships attached to a paid subscription. |
| P6 | **Topstep consistency-rule gaming.** | The one place in this market where gaming an *imposed* discipline metric is documented at scale. Uncovered. |

### Honest gaps in the research

- **No real user voice.** Reddit is policy-blocked in this environment; Trustpilot, G2 and the app
  stores were not reached. Competitor user reaction rests on a single forum thread.
- **Tradervue, TraderSync, TradesViz, Chartlog, Topstep** — no first-hand coverage.
- **Whoop / Oura orthosomnia** — the *products* are covered in the prior recon (§7b), but the
  **orthosomnia literature** is not: tracker-induced anxiety about a daily readiness number is the
  strongest available medical evidence for the anti-score position, and nobody has pulled it.
- **Full texts behind 403s:** the *one sec* CHI paper, the L@S 2022 Duolingo gamification-misuse
  paper, Edgewonk's own Tiltmeter documentation.

### Three fabricated statistics, confirmed

This category markets on invented evidence, and it is worth knowing by name:

1. *"A 2019 study in the Journal of Behavioral Finance found systematic trade review improved
   risk-adjusted returns 12–18%."* **Does not exist.** Crossref indexes 122 articles in that journal
   across 2018–2020; zero match. Two web searches surfaced exactly one carrier, an SEO content page —
   and the search layer restated it as established fact both times, unprompted.
2. *"80% of traders abandon their journal within two months."* Traces to a journal vendor's own SEO
   blog. No study, no authors.
3. *"A 2020 UC Davis study found streak-badge recipients 18% more likely to quit within 24 hours."*
   No primary source located. Treat as fabricated until shown otherwise.

Also: affiliate content invented TradeZella features that TradeZella does not have — badges,
leaderboards. **Anyone researching this market from search results is reading fiction.** That is an
Ogilvy position, and a standard Run must then hold itself to: if Run's copy ever quotes an effect
size for the read, it must be Run's own measured number.

---

## Recommended changes to locked docs

**Not made. Luke's call.**

| File | Proposed change | Why |
|---|---|---|
| `spec.md` §6 | Change the scoring-exclusion reason from *"a score invites gaming the score"* to the self-vs-task formulation | The current reason is weak and will not adjudicate the *next* feature. "Does this invite gaming?" and "does this point at the person rather than the situation?" give different answers for, e.g., a "your worst day" widget. Same exclusion, a rule that generalises. |
| `spec.md` §6 | Add an explicit carve-out: a **single generated descriptive conditional** is not a rules engine | Rules engines, checklists, streaks and intent-tracking all deserve to be out. One sentence was excluded by category rather than by argument, and it is the only large-effect intervention in the literature. P11 already licenses "pace against a stated intent." |
| Advice doctrine | Restate as **retrospective vs prospective**, not conditional vs prescriptive | The current phrasing is a proxy that will eventually approve something descriptive in grammar and prospective in function. |
| `problem-brief.md` | Name P1 as the product's load-bearing assumption, beside the kill signal | It is currently an unstated premise. |
| `spec.md` session rationale | Add the behavioural justification for the 17:00 CT boundary | Losses inside an open session behave like *paper* losses even though cash-settled (Imas 2016 vs Coval & Shumway 2005). The session is plausibly the trader's mental account, which is why "three losses in a session" is coherent and "three losses this week" is not. |

### Priced legal calls

| Item | Priced | Call |
|---|---|---|
| v1 journal + retrospective daily read | Soft | No opinion needed |
| The contrast sentence (§2) | Soft | Clear, on the four conditions |
| Engagement mechanics on a paid subscription | **Unpriced** | P5. Close before ship |
| Real-time red-zone / pre-trade intervention | **HARD** | Written opinion **before** engineering |
| Risk-control writes / armed lockouts | **HARD** | Written opinion first; settle **who holds the trigger** in the spec |
| Adding equities or options | **HARD** | Different regime entirely |

**And the gatekeeper nobody named:** NFA Bylaw 1101 forbids an NFA Member from handling futures
business for a non-Member required to be registered — strict liability by its terms. Tradovate is an
NFA Member.

> **Run's real gatekeeper is not the CFTC. It is Tradovate's compliance desk**, and the integration
> request is the moment they must form a view. Sequence the analysis before the request, not after.

---

## Sources

**Trader behaviour:** [Coval & Shumway, *JF* 2005](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.2005.00723.x) · [Locke & Mann, *JFE* 2005](https://www.sciencedirect.com/science/article/abs/pii/S0304405X0400203X) · [Imas, *AER* 2016](https://www.aeaweb.org/articles?id=10.1257/aer.20140386) · [Barber & Odean 2000](https://faculty.haas.berkeley.edu/odean/papers%20current%20versions/individual_investor_performance_final.pdf) · [Chague et al. 2020](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101) · [Barber et al., day-trader learning](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trading%20and%20Learning%20110217.pdf) · [Lo, Repin & Steenbarger 2005](https://www.nber.org/papers/w11243)

**Feedback and behaviour change:** [Kluger & DeNisi, *Psych Bull* 1996](https://mrbartonmaths.com/resourcesnew/8.%20Research/Marking%20and%20Feedback/The%20effects%20of%20feedback%20interventions.pdf) · [Webb & Sheeran 2006](https://pubmed.ncbi.nlm.nih.gov/16536643/) · [Gollwitzer & Sheeran 2006](https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes) · [Kahneman & Klein 2009](https://edbatista.com/wp-content/uploads/files/conditions-for-intuitive-expertise-kahneman-klein.pdf) · [Deci, Koestner & Ryan 1999](https://home.ubalt.edu/ntygmitc/642/Articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf) · [Sicherman et al., ostrich effect, *RFS* 2016](https://cepr.org/voxeu/columns/ostrich-us-selective-attention-personal-finances)

**Abandonment and tracking harm:** [Attig & Franke 2019](https://www.sciencedirect.com/science/article/abs/pii/S0747563219303127) · [Etkin, *JCR* 2016](https://academic.oup.com/jcr/article-abstract/42/6/967/2358309) · [Eysenbach, Law of Attrition](https://www.jmir.org/2005/1/e11/) · [Levinson et al., tracking in eating disorders](https://www.sciencedirect.com/science/article/abs/pii/S1471015317301484) · [gamification S-curve, *Front. Psychol.* 2025](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1671543/full)

**Analogous products:** [Tiimo AI Co-Planner design](https://www.tiimoapp.com/resource-hub/ai-co-planner-design) · [Tiimo routines for ADHD brains](https://www.tiimoapp.com/resource-hub/designing-routines-for-adhd-brains) · [Duolingo on streaks](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/) · [Mazal, Duolingo growth](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) · [Gamification misuse, L@S 2022](https://arxiv.org/abs/2203.16175) · [Chou on streak burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/) · [Auer & Griffiths, personalised feedback](https://irep.ntu.ac.uk/id/eprint/29002/1/Behavioural%20Tracking%20and%20the%20Effects%20of%20Responsible%20Gaming%20Tools%20and%20Personalized%20Feedback%20in%20Online%20Gambling.pdf) · [one sec research](https://one-sec.app/research/)

**Competitors:** [Zella Score weights](https://help.tradezella.com/en/articles/10305642-introducing-the-all-new-zella-score) · [Steenbarger, When Trading Journals Don't Work](https://www.trade2win.com/threads/when-trading-journals-don-t-work.16610/) · [Choi, Hecht & Tayler, surrogation, *JAR* 2012](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1475-679X.2012.00465.x)

**Regulatory:** [CFTC v. Vartuli, 228 F.3d 94](https://caselaw.findlaw.com/court/us-2nd-circuit/1204265.html) · [17 CFR 4.14](https://www.ecfr.gov/current/title-17/chapter-I/part-4/subpart-A/section-4.14) · [CFTC adopting release, Rule 4.14(a)(9)](https://www.federalregister.gov/documents/2000/03/10/00-5823/exemption-from-registration-as-a-commodity-trading-advisor) · [NFA Bylaw 1101 FAQs](https://www.nfa.futures.org/faqs/members/nfa-bylaw1101.html) · [Robinhood $7.5M settlement](https://www.bostonglobe.com/2024/01/18/business/robinhood-agrees-pay-75-million-settle-complaints-over-its-sales-practices/)

**Prop context:** [Heimer & Imas, *RFS* 2022](https://academic.oup.com/rfs/article-abstract/35/4/1643/6308957) · [Kirchler, Lindner & Weitzel, *JF* 2018](https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.12701) · [FPFX 300,000-account data](https://www.financemagnates.com/forex/analysis/exclusive-only-7-of-300000-prop-trading-accounts-achieved-payouts/)
