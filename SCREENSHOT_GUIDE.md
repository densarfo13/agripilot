# Farroway — App Store Screenshot Readiness Guide

**Brand:** Farroway · *Know what to do. Grow better.*
**Audience:** smallholder farmers · backyard growers · NGO operators · buyers
**Stores:** iOS App Store · Google Play
**Languages:** EN / FR / SW / HA / TW / HI

This guide is the operational checklist the launch team uses to capture
investor- and store-grade screenshots. Each row is a SHIP-BLOCKING
verification — if any check fails, the shot doesn't go up.

---

## How to capture

1. Use a **physical device** OR Capacitor's preview build, NOT browser dev-tools.
   Devicetools renders some safe-area gradients differently.
2. Set viewport to **1170 × 2532** (iPhone 15 Pro) and **1080 × 2400**
   (Pixel 7) — both stores' canonical screenshot sizes for portrait phones.
3. Authenticate as the **launch-demo user** (farmer cohort: `demo-gh-01`;
   backyard cohort: `demo-us-01`). Real names + farm photos already seeded
   via `npm run seed:demo`.
4. **Disable** dev tooling overlays (no `?devtools=1` query param, no
   feature-flag drawer). Toggle `import.meta.env.DEV === false` via
   `npx vite preview` (production-mode bundle).
5. Capture in **light mode AND dark mode** — Farroway is dark-mode native
   but stores prefer at least one light shot for the index page thumbnail.

---

## The 6 store screens

Capture one shot per row. Wording in the **Concept** column is the
marketing overlay text the store listing uses; do **NOT** add it
inside the app UI.

### Screenshot 1 — Home hero

| Item | Value |
|---|---|
| Route | `/dashboard` |
| Concept text | "Know what to do every day" |
| Verify | One primary action above the fold; weather header visible; "Check now ✓" CTA |
| Cohort | Farmer (Ghana) — heat-stress rule fires for visual contrast |
| Capture moment | Card faded in (220 ms after load), no scrim |

**Acceptance checks (spec §17):**
- [ ] One clear action visible without scrolling
- [ ] Weather header reads naturally (e.g. "🌤 Hot today — check soil early")
- [ ] CTA matches action ("Water now ✓" for heat-stress, NOT "Refresh crop stage")
- [ ] No setup banner above the action
- [ ] No competing button below the action
- [ ] Bottom nav present, Home tab active (green underline)

### Screenshot 2 — Daily action

| Item | Value |
|---|---|
| Route | `/dashboard` (after Done) |
| Concept text | "Simple daily steps for your farm or garden" |
| Verify | Done state visible: "Nice — you stayed ahead today 🌱" + tomorrow hook |
| Cohort | Backyard (US) — a cleaner, less-technical surface |
| Capture moment | Done card faded in (250 ms), green-tinted background |

**Acceptance checks:**
- [ ] Completion prompt with sprout emoji
- [ ] Tomorrow hook visible: "🌞 Check again tomorrow morning"
- [ ] No farmer-only language (no "yield", "income", "sell")

### Screenshot 3 — Scan

| Item | Value |
|---|---|
| Route | `/scan` → `/scan/result` |
| Concept text | "Scan your plant and get instant help" |
| Verify | Result card with status pill + explanation + suggested action |
| Cohort | Backyard (US) — "Needs attention ⚠️" result for visual contrast |
| Capture moment | Result revealed, ~280 ms after analyze finished |

**Acceptance checks:**
- [ ] Status pill colour-coded (red/amber/green) matches the status
- [ ] Explanation is one sentence, low-literacy friendly
- [ ] Suggested action is action-first ("Check underside of leaves today")
- [ ] No chemical dosage shown
- [ ] No "guaranteed diagnosis" language

### Screenshot 4 — Weather guidance

| Item | Value |
|---|---|
| Route | `/dashboard` |
| Concept text | "Advice based on weather and location" |
| Verify | Weather header reads context-specific rule (rain or dry) |
| Cohort | Farmer (Ghana) during rainy-season seed — `rainfallForecast=30` triggers `heavy_rain_warning` |
| Capture moment | Card faded in, header line: "🌧 Rain expected — hold watering today" |

**Acceptance checks:**
- [ ] Header line is rule-specific (not the generic "Good day for a quick check")
- [ ] Action card title matches the rule ("Skip outdoor work today")
- [ ] CTA matches: "Done ✓" (since the action is to NOT do something)
- [ ] Safety note visible if applicable

### Screenshot 5 — Progress

| Item | Value |
|---|---|
| Route | `/progress` |
| Concept text | "Stay on track and grow better" |
| Verify | Streak number + completed-actions count + emoji encouragement |
| Cohort | Backyard (US) with 3-day streak seeded |
| Capture moment | Static (no animation needed for screenshot) |

**Acceptance checks:**
- [ ] "🌱 You're doing great" vibe — encouraging, not analytical
- [ ] Streak count clearly visible
- [ ] Completed-actions count clearly visible
- [ ] Backyard cohort: NO Funding/Sell/Cost shortcuts visible
- [ ] Farmer cohort: Funding/Sell/Cost shortcuts visible BELOW the encouragement

### Screenshot 6 — My Grow

| Item | Value |
|---|---|
| Route | `/my-grow` (or `/my-farm` for farmers) |
| Concept text | "Manage your plants, farms, and gardens easily" |
| Verify | Identity card with farm photo + clean three-button action stack |
| Cohort | Farmer (Ghana) — Farms + Gardens tabs visible |
| Capture moment | Static |

**Acceptance checks:**
- [ ] Header reads "My Grow" (farmer) or "Your Garden" (backyard)
- [ ] Three primary actions visible: Edit · Add · Switch
- [ ] No duplicate switch controls
- [ ] No competing "Switch to Farm" button when Gardens tab already exists
- [ ] Help / contact link visible at bottom

---

## Backyard vs farmer wording — never mix

The spec §11 user-type-language rule is store-grade enforced by
the AI Task Engine v1's per-template wording split. For
screenshots:

| Cohort | Visible wording on store screens |
|---|---|
| Backyard | garden · plant · soil · water · scan your plant |
| Farmer | farm · crop · field · scout · scan crop |

If a screenshot mixes the two (e.g. "yield" appears on the Backyard
home), the cohort is wrong — re-seed with `npm run seed:demo --user=backyard`.

---

## Per-language verification

Each store has 6 language listings — capture all 6 sets unless a
specific listing is rolled-out incrementally. Toggle via the
in-app language picker:

```
EN → "Check now ✓"
FR → "Vérifier maintenant ✓"
SW → "Angalia sasa ✓"
HA → "Duba yanzu ✓"
TW → "Hwehwɛ nnɛ ✓"
HI → "अभी जांचें ✓"
```

Each CTA verb is provided by the engine's `ctaLabel` field per
rule + userType + locale. Native-speaker review of fr/sw/ha/tw/hi
remains a launch-readiness item (tracked in
`SOFT_LAUNCH_CHECKLIST.md` §8).

---

## Performance acceptance

The store team's `Lighthouse Mobile` audit must pass these gates
on the production build:

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.8 s |
| Largest Contentful Paint | < 2.5 s |
| Cumulative Layout Shift | < 0.1 |
| Total Blocking Time | < 200 ms |
| Time to Interactive | < 3.5 s |

Run `npx vite build && npx vite preview --port 4173` then point
Lighthouse at `http://localhost:4173/dashboard`.

---

## Final verdict gate

> Do not submit screenshots to the App Store / Play Store unless
> EVERY checkbox in §6 above is ticked AND the §17 acceptance
> checks in `SOFT_LAUNCH_CHECKLIST.md` pass green. The two
> documents are mutually-reinforcing: one captures the operator's
> in-app verification, the other captures the store-shot
> verification.

When both pass, **Farroway is store-ready**.

---

*Generated 2026-05-03 — refresh on every release-candidate cut.*
