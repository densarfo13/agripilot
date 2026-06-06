# UX_FRICTION_REPORT.md

**Sprint #180 — Phase 1: friction audit across grower-facing surfaces.**
Date: 2026-06-03

Audit covered Home, Scan result, Notifications dropdown, My Farm,
My Grow, Bottom Nav, and intelligence cards. Findings ranked
High / Medium / Low. Honest list — not all surfaces are in trouble.

---

## High severity

### H1 — Home stacks three competing primary actions

**Surface:** `src/pages/Home.jsx`
**Symptom:** `ImmersiveHomeHero` + `TodaysActionCard` + `TopActionCard`
(+ sometimes `DailyFarmPlanCard`) all render above the fold with no
priority. The farmer opens the app and sees 3 "do this" bands; the
spec says ONE action.
**Fix path:** Reorder Home to render exactly ONE primary card on the
first viewport — derived from Today's Action Engine (`__todaysActionHealth`)
— and demote the others to a "More for today" collapsed section.
**Status:** **Not yet shipped.** Pilot-blocking for the "Today's Action"
contract.

---

## Medium severity

### M1 — Intelligence cards don't show "Why we think this"

**Surface:** `IntelligentScanResult.jsx`, RegionStrip, OutcomeIntelligence cards
**Symptom:** Confidence percentage + tone present. Reasoning chain is
NOT surfaced. Farmer sees `Likely match — 78%` with no narrative
("we saw leaf-spotting AND it's the wet season in your region…").
**Fix path:** Add a `whyWeThinkThis` field to the scan envelope (derive
from sourceResults + regional pressure + leaf-color analysis) and render
it under the confidence label. Wire `OutcomeIntelligenceCard` to read
its existing `evidence[]` array and surface the strongest 1-2 reasons.
**Status:** `whatWeNoticed` + `whyItMatters` already shipped in scan v5 (#176);
the missing piece is a per-card reasoning line for non-scan surfaces.

### M2 — Treatment + NeedsReview can render in opposite order on small phones

**Surface:** `IntelligentScanResult.jsx`
**Symptom:** On viewports < 360 px the `NeedsReviewActions` card occasionally
appears between treatment and the action row, splitting "what to do" from
"the buttons". Not a dead-end; just an order glitch.
**Fix path:** Pin `NeedsReviewActions` below the permanent action row
(Create task / Scan again / Save for review) so the buttons are always
adjacent to the recommendation text.
**Status:** Easy fix; queue for sprint #181.

---

## Low severity

### L1 — Scan result has 9 stacked sections

**Surface:** `IntelligentScanResult.jsx`
Result page renders Plant + Top Matches + What we noticed + Why it
matters + Flower (conditional) + Crop Health + Treatment + Region + Soil
+ Satellite + Action row + NeedsReview. The first 4 sections fit the
fold; the rest scroll. Spec says above-the-fold needs Plant + Confidence
+ Issue + Action — and that's already true. Lower-priority detail below
is fine.

### L2 — Notification dropdown caps at 20 items

**Surface:** `NotificationBell.jsx` line ~23 (MAX_RENDERED)
The dropdown shows the most-recent 20. Beyond 20, the panel truncates
without a "see all" link. Not a dead-end (the full list is reachable
from /notifications) but the cap is silent.
**Fix path:** Add a "View all" footer link when count > 20.

### L3 — Bottom nav: 5 tabs (compliant)

**Surface:** `RoleAwareBottomNav.jsx`
Farmer view: Home / My Grow / Tasks / Progress / Scan. Within the
spec's "max 5" rule. NGO and Buyer variants also compliant.

### L4 — My Farm first-fold content (compliant)

**Surface:** `src/pages/farmer/MyFarmPage.jsx`
Renders Farm Selector → Identity → Setup (conditional) → Details →
Actions. Matches the Phase 5 spec (farm snapshot, crop count, health
alerts, recent scans, upcoming tasks visible above the fold).

### L5 — Notifications dropdown works (compliant)

Portal-rendered, scrolls correctly, mark-read + mark-all-read present,
mobile anchor uses safe-area gutters. No clipping detected on iPhone
Safari or Android Chrome shells.

---

## Already shipped (no new work)

| Prior sprint | Closed friction |
|---|---|
| #146 | Notification dropdown portal + mobile layout |
| #173 | Today's Action engine + KPI funnel |
| #176 | Scan dead-ends (Plant: — / Unknown Plant — for IntelligentScanResult) |
| #177 | Scan envelope fallback (empty plantName floor) |
| #178 | Universal scan classifier (11 object types, 18 issues) |
| #179 | ScanCommandCard Plant: — fix + repo-wide gate |

---

## Rollup

- **High:** 1 finding (Home single-action) — pilot blocker
- **Medium:** 2 findings (trust narrative; render order)
- **Low:** 5 findings, 3 compliant — informational only

The pilot-blocking item is **H1** alone. Everything else is polish or
already shipped.
