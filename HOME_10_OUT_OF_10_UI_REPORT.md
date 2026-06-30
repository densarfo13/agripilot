# Home 10/10 UI — Report (honest)

## Addendum — contradiction fixes (from your screenshots)

Your screenshots exposed a **real P0 bug** I could not have seen from code: three components on
Home disagreed about farm state. The hero said **"Add your crop"** directly above a card reading
**"My New Farm / onion"**; another card said **"Add your location"** while "Farm Setup" showed
**✓ Location Added ✓ Crop Selected**. Root causes + fixes:

- **`DecisionHero.jsx`** read only `farm.crop`, so a crop stored under `cropName` ("Onion") fell to
  the empty-state "Add your crop." → now uses `resolveCompletionCrop(farm)` (the single resolver).
- **`Home.jsx`** completion ladder keyed "location added" off *live-weather success* (`hasLocation`),
  so a failed weather fetch showed "Add your location" even with a stored location. → now keyed off
  the farm's **stored** location (coords/label), consistent with the setup card.

Verified: build:safe 393 green (incl. production build) + a post-edit DOM check confirming both
stale CTAs ("Add your crop", "Add your location") are gone from the rendered page. (A clean preview
screenshot was blocked by a transient Vite dev "duplicate React" glitch — the production build is
the authoritative check.)

Still pending (authorized, next sprint): the §5 three-readiness-cards → one consolidation (Farm
Setup / Recommendation confidence / Farm readiness all showed the same checklist with different
percentages — confirmed in your screenshots) + §9 spacing/contrast polish.

---


## Code Changed
- **`src/pages/Home.jsx`** — §2 smart greeting: the generic headline **"Today on Farroway" →
  "Here's what needs attention today."** (`home.headline.attention`). The greeting line already
  renders the time-of-day + role ("Good morning, Farmer."); no reliable user *name* exists in app
  state, so a name is not fabricated (spec's stated fallback).
- **`scripts/check-home-no-internal-terms.mjs`** — extended to lock §2 (Home must use the new
  headline, must not use "Today on Farroway") on top of the §4 internal-term lock from last sprint.

## Screens Changed
- **Home header** — action-oriented headline instead of a brand title.

## Tests Added
- Gate assertions for the headline (`home.headline.attention` present, "Today on Farroway" absent).
  Existing Home gates (`check-home-next-step`, `check-farm-brain`, `check-empty-state-guidance`,
  `check-home-no-internal-terms`) all green.

## Build Results
`npm run build:safe` → **PASS, 393 steps green**.

## UX Improved
The header now answers "what should I do?" rather than naming the app. Combined with the prior two
sprints (stale-"Add your crop" fix; removal of "FarmBrain Confidence"/"Farm data quality" jargon
from every locale), the worst credibility issues on Home are resolved + gated.

## Remaining Risks — and an honest blocker
I tried to do this the right way and **render the Home in the preview to actually see it**. The app
boots through three gates — language/country **setup → /login → onboarding** — and the authenticated
Home requires a real backend (`/me`); seeding a session in the sandbox tripped the error boundary.
So I **could not visually verify** the deeper polish, and I will not claim a score from a screenshot
I didn't get.

The big-ticket spec items remain **deliberately not done**, for concrete reasons:
- **§1/§3 one-hero consolidation** — Home renders three hero-ish surfaces (DecisionHero +
  ImmersiveHomeHero + CommandCenterDeck). Collapsing to one is the highest-impact change, but it's
  the "redesign" the spec forbids **and** it ripples through the canonical-home guard + design-system
  trusted-set gate. Needs explicit sign-off to change those gate contracts.
- **§5 collapse 3 readiness cards → 1 "Farm Health"** — those three cards are required by *testid*
  by two gates (sprint-#209 contract). Real work, but it's a gate-contract change, not a polish.
- **§9 visual polish (spacing/shadows/contrast), §10 micro-interactions** — genuinely need eyes on
  the rendered screen. **Best path: a screenshot from your phone or production**, and I'll target the
  exact issues instead of guessing at pixels.

## Home Score Estimate
Honest, from code review (not a render): **~7/10.** Decision-first structure, honest copy, no jargon,
no stale CTAs — the fundamentals are sound. The gap to 9–10 is the *visual* layer (one hero, fewer
cards, premium spacing), which I can't responsibly self-score without seeing it rendered.

**To get to 10/10, I need one of:** (a) a screenshot of the current Home from your device/production,
or (b) your go-ahead to rewrite the two gate contracts so I can do the §1/§5 card consolidation.
Either unblocks the real visual work in the next sprint.
