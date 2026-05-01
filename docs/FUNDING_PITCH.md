# Farroway — Funding Pitch

A concise, investor-ready pitch covering the five pillars of the
ask. Each section is short by design — the live demo + metrics
dashboard at `/internal/metrics` carry the proof.

---

## 1. Problem

Smallholder farmers across Africa, India, and emerging US backyard
markets share three blockers:

1. **No daily guidance.** They know the crop, not the schedule.
   Generic agronomy content doesn't account for *their* plant,
   region, or week.
2. **No buyer reach.** A harvest-ready batch sits unsold while a
   buyer two villages over is searching for that exact crop.
3. **No price signal.** Without an aggregated demand view they
   either underprice or hold too long.

The cost is concrete: lost yield, lost income, abandoned plots.
USAID, FAO, and World Bank reports converge on the same gap —
last-mile decision support for the 500M smallholders that produce
30% of the world's food.

## 2. Solution

Farroway is a mobile-first decision and marketplace surface that
captures four signals — **crops, location, listings, buyer
interest** — and turns them into action:

- **Daily plan** — 1 priority + 1-2 optional tasks, value-led copy,
  one daily notification, streak-tracking.
- **Marketplace** — farmer lists in 30 seconds; buyer browses
  region-scoped feed; one-tap "I'm interested" reaches the farmer
  through Farroway notifications.
- **Insights digest** — money-prioritised action cards (demand,
  price, activity) with tone-coded urgency and 24h completion
  state.
- **Trust + monetisation** — verified-listing chips, boost
  placements, assisted deals — every paid layer is purely
  additive and never blocks the free flows.
- **Multi-market by default** — six pilot markets configured
  (Ghana, Kenya, Nigeria, Tanzania, India, US) with currency,
  unit, and language localisation; replication is a config swap,
  not an engineering project.

Local-first storage means the entire stack works offline. Backend
sync is opt-in.

## 3. Traction

Current state of the build (all flags listed below default ON
unless marked otherwise):

- **101 commits** since pilot scaffolding.
- **12 feature flags** shipped, 8 active in production by default.
- **6 markets** configured with seed data + per-region funnel
  partition.
- **6 launch languages** at 100% i18n coverage:
  English, French, Swahili, Hausa, Twi, Hindi.
- **497–505 JSX files** under the raw-crop-render guard, all
  routing through canonical helpers.
- **Crop-type drift baseline** held at 272 references across 100+
  commits — proof that the team migrates rather than sprawls.

The live demo runs entirely in the browser; pilot devices on
flaky connections never lose data.

## 4. Revenue

Three revenue streams, all live in the codebase, all opt-in for
the user:

| Stream            | Mechanism                                            | Pricing variant ladder       |
|-------------------|------------------------------------------------------|------------------------------|
| Boost listing     | 24h paid placement at top of buyer feed              | A: $5  B: $7  C: $10 (sticky)|
| Assisted deal     | "Get help closing deal" — operator-led close support | A: free  B: $5  C: $10        |
| Buyer priority    | Opt-in toggle for buyers — boosted-first ordering    | flat (free in pilot, paid v2)|

Sticky A/B/C variants assign deterministically per stable user id
and emit a `pricing_exposure` event so price-sensitivity is
measurable from day one.

Operator tools at `/operator` give NGO and government partners
per-market funnel visibility, supporting paid SaaS contracts as a
fourth stream.

## 5. Growth

Self-sustaining loop:

```
  Scan plant ──▶ Share result (with referral URL)
                       │
                       ▼
            Friend lands at /?ref=CODE
                       │
                       ▼
        signup_via_invite event fires
                       │
                       ▼
     New user lists / buys / scans → loop repeats
```

Pilot focus is **Greater Accra, Ghana** with ladder expansion to
Kenya and Nigeria — both already configured in `marketCatalog`.
Build-time env override picks the focus per pilot:
`VITE_FARROWAY_GROWTH_REGION="Country:Region"`.

Growth events tracked end-to-end:
`share_clicked`, `share_completed`, `invite_sent`, `invite_rewarded`,
`signup_via_invite`, `sell_prompt_view`, `sell_prompt_click`.

## 6. Team

- Single founder + Claude-paired build pipeline.
- 6 launch languages localised end-to-end.
- 100+ commits over 60-day pilot scaffold.

## 7. The ask

Funding to (a) operator hires in pilot markets, (b) backend
billing integration to swap the local pricing-variant scaffold
for real revenue, and (c) sales pipeline to the NGO + government
partner segment that the operator dashboard already supports.

---

*The metrics dashboard at `/internal/metrics` shows live numbers
in any market the investor selects. The on-device pilot is fully
runnable offline.*
